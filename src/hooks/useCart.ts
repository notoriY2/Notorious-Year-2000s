// src/hooks/useCart.ts

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';

import { supabase } from '../lib/supabase';
import {
  Product,
  CartItem,
} from '../types/Product';

import {
  mapRowToProduct,
  ProductRow,
} from '../lib/mapProduct';

import { trackEvent } from '../lib/analytics';


/* =========================================================
   TYPES
========================================================= */

type DbCartItem = CartItem & {
  cartItemId: string;
};

interface CartItemRow {
  id: string;
  product_id: string;
  quantity: number;
  selected_size: string | null;
  selected_color: string | null;
  price_at_add: number;
  products: ProductRow;
}

/* =========================================================
   CONSTANTS
========================================================= */

const GUEST_CART_STORAGE_KEY =
  'notorious-y2-guest-cart';

/* =========================================================
   HELPERS
========================================================= */

const buildUniqueId = (
  productId: string,
  size?: string,
  color?: string
) =>
  `${productId}${size ? `-${size}` : ''}${color ? `-${color}` : ''}`;

/* =========================================================
   MAP SUPABASE ROW -> CART ITEM
========================================================= */

const mapCartRow = (
  row: CartItemRow
): DbCartItem => {
  const product = mapRowToProduct(row.products);

  return {
    ...product,

    // Preserve the price from when the product
    // was originally added to the cart.
    price: Number(row.price_at_add),

    quantity: row.quantity,

    uniqueId: buildUniqueId(
      product.id,
      row.selected_size ?? undefined,
      row.selected_color ?? undefined
    ),

    selectedSize:
      row.selected_size ?? undefined,

    selectedColor:
      row.selected_color ?? undefined,

    cartItemId: row.id,
  };
};

/* =========================================================
   LOCAL GUEST CART
========================================================= */

const addOrBumpLocal = (
  previous: CartItem[],
  product: Product,
  selectedSize?: string,
  selectedColor?: string
): CartItem[] => {
  const uniqueId = buildUniqueId(
    product.id,
    selectedSize,
    selectedColor
  );

  const existing = previous.find(
    item => item.uniqueId === uniqueId
  );

  if (existing) {
    return previous.map(item =>
      item.uniqueId === uniqueId
        ? {
            ...item,
            quantity: item.quantity + 1,
          }
        : item
    );
  }

  return [
    ...previous,
    {
      ...product,
      quantity: 1,
      uniqueId,
      selectedSize,
      selectedColor,
    },
  ];
};

/* =========================================================
   SAVE GUEST CART
========================================================= */

const saveGuestCart = (items: CartItem[]) => {
  try {
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify({ items, savedAt: Date.now() }));
  } catch (error) { console.error('Failed to save guest cart:', error); }
};

/* =========================================================
   LOAD GUEST CART
========================================================= */

const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const loadGuestCart = (): CartItem[] => {
  try {
    const stored = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Back-compat: old format was a bare array
    if (Array.isArray(parsed)) return parsed;
    if (!parsed?.items || typeof parsed.savedAt !== 'number') return [];
    if (Date.now() - parsed.savedAt > GUEST_CART_TTL_MS) {
      window.localStorage.removeItem(GUEST_CART_STORAGE_KEY);
      return [];
    }
    return parsed.items;
  } catch (error) {
    console.error('Failed to load guest cart:', error);
    return [];
  }
};

/* =========================================================
   CLEAR GUEST CART
========================================================= */

const clearGuestCart = () => {
  try {
    window.localStorage.removeItem(
      GUEST_CART_STORAGE_KEY
    );
  } catch (error) {
    console.error(
      'Failed to clear guest cart:',
      error
    );
  }
};

/* =========================================================
   MERGE CART ITEMS

   Used when a guest signs in.

   Example:

   Guest:
   T-shirt x2

   Account:
   T-shirt x1

   Result:
   T-shirt x3
========================================================= */

/* =========================================================
   HOOK
========================================================= */

export const useCart = (
  userId?: string | null
) => {
  const [cartItems, setCartItems] =
    useState<CartItem[]>([]);

  const [isLoading, setIsLoading] =
    useState(false);

  const cartIdRef =
    useRef<string | null>(null);

  const cartItemsRef =
    useRef<CartItem[]>([]);

  /*
   * Prevent stale async requests from an old
   * authenticated session from overwriting the
   * current cart.
   */
  const requestIdRef =
    useRef(0);

  /*
   * Serializes Supabase mutations.
   *
   * This prevents rapid clicks from creating
   * duplicate rows or racing each other.
   */
  const opQueueRef =
    useRef<Promise<void>>(
      Promise.resolve()
    );

  /* =======================================================
     KEEP REF IN SYNC
  ======================================================= */

  useEffect(() => {
    cartItemsRef.current =
      cartItems;
  }, [cartItems]);

  /* =======================================================
     ENSURE USER CART EXISTS
  ======================================================= */

  const ensureCart =
    useCallback(
      async (
        uid: string
      ): Promise<string> => {
        const {
          data: existing,
          error: selectError,
        } = await supabase
          .from('carts')
          .select('id')
          .eq('user_id', uid)
          .maybeSingle();

        if (selectError) {
          throw selectError;
        }

        if (existing?.id) {
          return existing.id;
        }

        const {
          data: created,
          error: insertError,
        } = await supabase
          .from('carts')
          .insert({
            user_id: uid,
          })
          .select('id')
          .single();

        if (insertError) {
          throw insertError;
        }

        return created.id;
      },
      []
    );

  /* =======================================================
     FETCH AUTHENTICATED CART
  ======================================================= */

  const fetchCart =
    useCallback(
      async (
        uid: string
      ) => {
        const currentRequest =
          ++requestIdRef.current;

        setIsLoading(true);

        try {
          const cartId =
            await ensureCart(uid);

          /*
           * The user may have changed while
           * ensureCart was running.
           */
          if (
            currentRequest !==
            requestIdRef.current
          ) {
            return;
          }

          cartIdRef.current =
            cartId;

          const {
  data,
  error,
} = await supabase
  .from('cart_items')
  .select(
    `
      id,
      product_id,
      quantity,
      selected_size,
      selected_color,
      price_at_add,
      products (
        id,
        slug,
        name,
        price,
        image,
        images,
        category,
        sold_out,
        position_top,
        position_left,
        mobile_position_top,
        mobile_position_left,
        rotation,
        scale,
        z_index,
        show_on_floor,
        is_staged
      )
    `
  )
  .eq('cart_id', cartId);

          if (error) {
            throw error;
          }

          if (
            currentRequest !==
            requestIdRef.current
          ) {
            return;
          }

          const mapped =
            (
              (data ?? []) as unknown as CartItemRow[]
            ).map(mapCartRow);

          setCartItems(mapped);
        } catch (error) {
          console.error(
            'Failed to load cart:',
            error
          );
        } finally {
          if (
            currentRequest ===
            requestIdRef.current
          ) {
            setIsLoading(false);
          }
        }
      },
      [ensureCart]
    );

  /* =======================================================
     ADD GUEST CART TO SUPABASE CART
  ======================================================= */

  const mergeGuestCartIntoAccount =
    useCallback(
      async (
        uid: string,
        guestItems: CartItem[]
      ) => {
        if (
          guestItems.length === 0
        ) {
          return;
        }

        const cartId =
          cartIdRef.current ??
          (await ensureCart(uid));

        cartIdRef.current =
          cartId;

        for (
          const item of guestItems
        ) {
          let query = supabase
            .from('cart_items')
            .select(
              'id, quantity'
            )
            .eq(
              'cart_id',
              cartId
            )
            .eq(
              'product_id',
              item.id
            );

          query = item.selectedSize
            ? query.eq(
                'selected_size',
                item.selectedSize
              )
            : query.is(
                'selected_size',
                null
              );

          query = item.selectedColor
            ? query.eq(
                'selected_color',
                item.selectedColor
              )
            : query.is(
                'selected_color',
                null
              );

          const {
            data: existingRow,
            error: findError,
          } = await query.maybeSingle();

          if (findError) {
            throw findError;
          }

          if (existingRow) {
            const {
              error: updateError,
            } = await supabase
              .from('cart_items')
              .update({
                quantity:
                  existingRow.quantity +
                  item.quantity,
              })
              .eq(
                'id',
                existingRow.id
              );

            if (updateError) {
              throw updateError;
            }
          } else {
            const {
              error: insertError,
            } = await supabase
              .from('cart_items')
              .insert({
                cart_id:
                  cartId,
                product_id:
                  item.id,
                quantity:
                  item.quantity,
                selected_size:
                  item.selectedSize ??
                  null,
                selected_color:
                  item.selectedColor ??
                  null,
                price_at_add:
                  item.price,
              });

            if (insertError) {
              throw insertError;
            }
          }
        }

        clearGuestCart();
      },
      [ensureCart]
    );

  /* =======================================================
     USER CHANGE
  ======================================================= */

  useEffect(() => {
    /*
     * New session/request generation.
     */
    requestIdRef.current += 1;

    if (!userId) {
      cartIdRef.current = null;

      /*
       * Keep the guest cart instead of deleting it.
       */
      const guestCart =
        loadGuestCart();

      setCartItems(
        guestCart
      );

      setIsLoading(false);

      return;
    }

    const initialiseUserCart =
      async () => {
        setIsLoading(true);

        try {
          const guestCart =
            loadGuestCart();

          /*
           * Establish the user's cart first.
           */
          const cartId =
            await ensureCart(
              userId
            );

          cartIdRef.current =
            cartId;

          /*
           * Merge guest cart into
           * authenticated cart.
           */
          if (
            guestCart.length > 0
          ) {
            await mergeGuestCartIntoAccount(
              userId,
              guestCart
            );
          }

          await fetchCart(
            userId
          );
        } catch (error) {
          console.error(
            'Failed to initialise cart:',
            error
          );

          /*
           * If loading the account cart fails,
           * preserve the guest cart rather than
           * leaving the customer with nothing.
           */
          const guestCart =
            loadGuestCart();

          if (
            guestCart.length > 0
          ) {
            setCartItems(
              guestCart
            );
          }
        } finally {
          setIsLoading(false);
        }
      };

    initialiseUserCart();
  }, [
    userId,
    ensureCart,
    fetchCart,
    mergeGuestCartIntoAccount,
  ]);

  /* =======================================================
     OPERATION QUEUE
  ======================================================= */

  const enqueue =
    useCallback(
      (
        operation: () => Promise<void>
      ) => {
        opQueueRef.current =
          opQueueRef.current
            .then(operation)
            .catch(error => {
              console.error(
                'Cart operation failed:',
                error
              );
            });

        return opQueueRef.current;
      },
      []
    );

  /* =======================================================
     ADD TO CART
  ======================================================= */

  const doAddToCart = useCallback(
  async (
    product: Product,
    selectedSize?: string,
    selectedColor?: string
  ) => {
    /*
     * Guest cart.
     */
    if (!userId) {
      setCartItems(
        previous => {
          const next =
            addOrBumpLocal(
              previous,
              product,
              selectedSize,
              selectedColor
            );

          saveGuestCart(
            next
          );

          return next;
        }
      );

      return;
    }

    /*
     * Authenticated cart.
     */
    const cartId =
      cartIdRef.current ??
      (await ensureCart(
        userId
      ));

    cartIdRef.current =
      cartId;

    let query = supabase
      .from('cart_items')
      .select(
        'id, quantity'
      )
      .eq(
        'cart_id',
        cartId
      )
      .eq(
        'product_id',
        product.id
      );

    query = selectedSize
      ? query.eq(
          'selected_size',
          selectedSize
        )
      : query.is(
          'selected_size',
          null
        );

    query = selectedColor
      ? query.eq(
          'selected_color',
          selectedColor
        )
      : query.is(
          'selected_color',
          null
        );

    const {
      data: existingRow,
      error: findError,
    } = await query.maybeSingle();

    if (findError) {
      throw findError;
    }

    if (existingRow) {
      const {
        error: updateError,
      } = await supabase
        .from('cart_items')
        .update({
          quantity:
            existingRow.quantity +
            1,
        })
        .eq(
          'id',
          existingRow.id
        );

      if (updateError) {
        throw updateError;
      }
    } else {
      const {
        error: insertError,
      } = await supabase
        .from('cart_items')
        .insert({
          cart_id:
            cartId,
          product_id:
            product.id,
          quantity: 1,
          selected_size:
            selectedSize ??
            null,
          selected_color:
            selectedColor ??
            null,
          price_at_add:
            product.price,
        });

      if (insertError) {
        throw insertError;
      }
    }

    await fetchCart(
      userId
    );
  },
  [
    userId,
    ensureCart,
    fetchCart,
  ]
);

const addToCart = useCallback(
  (
    product: Product,
    selectedSize?: string,
    selectedColor?: string
  ) => {
    trackEvent('add_to_cart');
    enqueue(() =>
      doAddToCart(
        product,
        selectedSize,
        selectedColor
      )
    );
  },
  [enqueue, doAddToCart]
);

  /* =======================================================
     UPDATE QUANTITY
  ======================================================= */

  const doUpdateQuantity =
    useCallback(
      async (
        uniqueId: string,
        quantity: number
      ) => {
        /*
         * Guest cart.
         */
        if (!userId) {
          setCartItems(
            previous => {
              const next =
                quantity <= 0
                  ? previous.filter(
                      item =>
                        item.uniqueId !==
                        uniqueId
                    )
                  : previous.map(
                      item =>
                        item.uniqueId ===
                        uniqueId
                          ? {
                              ...item,
                              quantity,
                            }
                          : item
                    );

              saveGuestCart(
                next
              );

              return next;
            }
          );

          return;
        }

        /*
         * Authenticated cart.
         */
        const item =
          cartItemsRef.current.find(
            current =>
              current.uniqueId ===
              uniqueId
          ) as
            | DbCartItem
            | undefined;

        if (!item) {
          return;
        }

        if (quantity <= 0) {
          const {
            error,
          } = await supabase
            .from('cart_items')
            .delete()
            .eq(
              'id',
              item.cartItemId
            );

          if (error) {
            throw error;
          }
        } else {
          const {
            error,
          } = await supabase
            .from('cart_items')
            .update({
              quantity,
            })
            .eq(
              'id',
              item.cartItemId
            );

          if (error) {
            throw error;
          }
        }

        await fetchCart(
          userId
        );
      },
      [
        userId,
        fetchCart,
      ]
    );

  /* =======================================================
     REMOVE ITEM
  ======================================================= */

  const doRemoveItem =
    useCallback(
      async (
        uniqueId: string
      ) => {
        /*
         * Guest cart.
         */
        if (!userId) {
          setCartItems(
            previous => {
              const next =
                previous.filter(
                  item =>
                    item.uniqueId !==
                    uniqueId
                );

              saveGuestCart(
                next
              );

              return next;
            }
          );

          return;
        }

        /*
         * Authenticated cart.
         */
        const item =
          cartItemsRef.current.find(
            current =>
              current.uniqueId ===
              uniqueId
          ) as
            | DbCartItem
            | undefined;

        if (!item) {
          return;
        }

        const {
          error,
        } = await supabase
          .from('cart_items')
          .delete()
          .eq(
            'id',
            item.cartItemId
          );

        if (error) {
          throw error;
        }

        await fetchCart(
          userId
        );
      },
      [
        userId,
        fetchCart,
      ]
    );

  /* =======================================================
     CLEAR CART

     Wipes the entire cart — every cart_items row for the current
     authenticated cart, or the whole guest cart from localStorage.
     Called by Checkout.tsx right after an order is successfully
     placed, so the customer doesn't see the just-purchased items
     still sitting in their cart afterward.

     For the authenticated path, this deletes by cart_id rather than
     looping per-item — one round trip instead of N, and it also
     clears out any cart_items rows that might not currently be
     reflected in local state (e.g. a stale/concurrent tab).
  ======================================================= */

  const doClearCart =
    useCallback(
      async () => {
        /*
         * Guest cart.
         */
        if (!userId) {
          clearGuestCart();

          setCartItems([]);

          return;
        }

        /*
         * Authenticated cart.
         */
        const cartId =
          cartIdRef.current;

        if (!cartId) {
          // No cart has been created for this user yet —
          // nothing to clear.
          setCartItems([]);

          return;
        }

        const {
          error,
        } = await supabase
          .from('cart_items')
          .delete()
          .eq(
            'cart_id',
            cartId
          );

        if (error) {
          throw error;
        }

        setCartItems([]);
      },
      [userId]
    );

 

  /* =======================================================
     PUBLIC UPDATE
  ======================================================= */

  const updateQuantity =
    useCallback(
      (
        uniqueId: string,
        quantity: number
      ) => {
        enqueue(() =>
          doUpdateQuantity(
            uniqueId,
            quantity
          )
        );
      },
      [
        enqueue,
        doUpdateQuantity,
      ]
    );

  /* =======================================================
     PUBLIC REMOVE
  ======================================================= */

  const removeItem =
    useCallback(
      (
        uniqueId: string
      ) => {
        enqueue(() =>
          doRemoveItem(
            uniqueId
          )
        );
      },
      [
        enqueue,
        doRemoveItem,
      ]
    );

  /* =======================================================
     PUBLIC CLEAR

     Returns the underlying promise (unlike addToCart/updateQuantity/
     removeItem) so Checkout.tsx can await it — it needs to know the
     cart has actually been cleared before it navigates away from the
     order-confirmation flow, rather than firing-and-forgetting like
     the other mutations.
  ======================================================= */

  const clearCart =
    useCallback(
      () =>
        enqueue(
          doClearCart
        ),
      [
        enqueue,
        doClearCart,
      ]
    );

  /* =======================================================
     RETURN
  ======================================================= */

  return {
    cartItems,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    isLoading,
  };
};