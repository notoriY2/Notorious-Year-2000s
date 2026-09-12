// src/hooks/useWishlist.ts

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Product } from '../types/Product';
import {
  ProductRow,
  mapRowToProduct,
} from '../lib/mapProduct';

export const useWishlist = (userId: string | null) => {
  /*
   * IMPORTANT:
   * These hooks are ALWAYS called in exactly this order.
   */
  const [wishlistItems, setWishlistItems] =
    useState<Product[]>([]);

  const [isLoading, setIsLoading] =
    useState(false);

  /*
   * ============================================================
   * LOAD WISHLIST
   *
   * We intentionally use TWO queries instead of a nested
   * Supabase relationship query.
   *
   * This is more reliable with the current database setup and
   * avoids depending on generated relationship typing.
   * ============================================================
   */
  const loadWishlist = useCallback(async () => {
    if (!userId) {
      setWishlistItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      /*
       * First get the user's wishlist rows.
       */
      const {
        data: wishlistRows,
        error: wishlistError,
      } = await supabase
        .from('wishlist_items')
        .select(
          'id, user_id, product_id, created_at'
        )
        .eq('user_id', userId)
        .order('created_at', {
          ascending: false,
        });

      if (wishlistError) {
        console.error(
          'Failed to load wishlist:',
          wishlistError
        );

        setWishlistItems([]);
        return;
      }

      if (
        !wishlistRows ||
        wishlistRows.length === 0
      ) {
        setWishlistItems([]);
        return;
      }

      /*
       * Extract unique product IDs.
       */
      const productIds = Array.from(
        new Set(
          wishlistRows.map(
            (item) => item.product_id
          )
        )
      );

      /*
       * Then fetch the actual products.
       */
      const {
        data: productRows,
        error: productError,
      } = await supabase
        .from('products')
.select(`
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
`)
.in('id', productIds);

      if (productError) {
        console.error(
          'Failed to load wishlist products:',
          productError
        );

        setWishlistItems([]);
        return;
      }

      /*
       * Create a lookup map so we can preserve the
       * wishlist ordering from created_at.
       */
      const productMap = new Map<
        string,
        Product
      >();

      (
        (productRows || []) as ProductRow[]
      ).forEach((row) => {
        productMap.set(
          row.id,
          mapRowToProduct(row)
        );
      });

      /*
       * Rebuild wishlist in wishlist creation order.
       */
      const products: Product[] = [];

      const seen = new Set<string>();

      wishlistRows.forEach((wishlistRow) => {
        const product =
          productMap.get(
            wishlistRow.product_id
          );

        if (!product) {
          return;
        }

        /*
         * Extra protection against duplicate products.
         */
        if (seen.has(product.id)) {
          return;
        }

        seen.add(product.id);
        products.push(product);
      });

      setWishlistItems(products);
    } catch (error) {
      console.error(
        'Unexpected wishlist error:',
        error
      );

      setWishlistItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /*
   * ============================================================
   * LOAD WHEN USER CHANGES
   *
   * Logged out:
   *     wishlist = []
   *
   * Logged in:
   *     fetch wishlist from Supabase
   * ============================================================
   */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!userId) {
        setWishlistItems([]);
        setIsLoading(false);
        return;
      }

      if (cancelled) {
        return;
      }

      await loadWishlist();
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId, loadWishlist]);

  /*
   * ============================================================
   * ADD
   * ============================================================
   */
  const addToWishlist = useCallback(
    async (product: Product) => {
      if (!userId) {
        console.warn(
          'Wishlist requires an authenticated user.'
        );

        return;
      }

      /*
       * Prevent duplicate UI entries immediately.
       */
      setWishlistItems((previous) => {
        if (
          previous.some(
            (item) => item.id === product.id
          )
        ) {
          return previous;
        }

        return [
          ...previous,
          product,
        ];
      });

      const {
        error,
      } = await supabase
        .from('wishlist_items')
        .insert({
          user_id: userId,
          product_id: product.id,
        });

      if (error) {
        console.error(
          'Failed to add wishlist item:',
          error
        );

        /*
         * Database is the source of truth.
         * Restore UI from Supabase if insertion failed.
         */
        await loadWishlist();
      }
    },
    [userId, loadWishlist]
  );

  /*
   * ============================================================
   * REMOVE
   * ============================================================
   */
  const removeFromWishlist =
    useCallback(
      async (productId: string) => {
        if (!userId) {
          return;
        }

        /*
         * Optimistic UI update.
         */
        setWishlistItems(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== productId
            )
        );

        const {
          error,
        } = await supabase
          .from('wishlist_items')
          .delete()
          .eq('user_id', userId)
          .eq(
            'product_id',
            productId
          );

        if (error) {
          console.error(
            'Failed to remove wishlist item:',
            error
          );

          /*
           * Restore correct database state.
           */
          await loadWishlist();
        }
      },
      [userId, loadWishlist]
    );

  /*
   * ============================================================
   * TOGGLE
   * ============================================================
   */
  const toggleWishlist =
    useCallback(
      async (product: Product) => {
        if (!userId) {
          console.warn(
            'Wishlist requires an authenticated user.'
          );

          return;
        }

        const exists =
          wishlistItems.some(
            (item) =>
              item.id === product.id
          );

        if (exists) {
          await removeFromWishlist(
            product.id
          );
        } else {
          await addToWishlist(
            product
          );
        }
      },
      [
        userId,
        wishlistItems,
        addToWishlist,
        removeFromWishlist,
      ]
    );

  /*
   * ============================================================
   * CHECK
   * ============================================================
   */
  const isInWishlist =
    useCallback(
      (productId: string) =>
        wishlistItems.some(
          (item) =>
            item.id === productId
        ),
      [wishlistItems]
    );

  /*
   * ============================================================
   * PUBLIC API
   * ============================================================
   */
  return {
    wishlistItems,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    isInWishlist,
    isLoading,
    refetch: loadWishlist,
  };
};