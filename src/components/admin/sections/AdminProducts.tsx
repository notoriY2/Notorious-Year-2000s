// src/components/admin/sections/AdminProducts.tsx

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { supabase } from '../../../lib/supabase';

import {
  getAdminProducts,
  deleteAdminProduct,
  updateAdminProductStatus,
  createAdminProductWithInventory,
  getCategorySizes,
  CategorySizesMap,
  uploadProductImage,
} from '../../../data/admin';

import { getNextAvailableFloorSlot } from '../../../data/floorLayout';

import { invalidateAdminCache } from '../../../lib/adminCache';

import { AdminProduct } from '../../../types/admin';

import {
  Plus,
  Search,
  CreditCard as Edit2,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  X,
  Save,
  Package,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

import {
  PageTitle,
  SectionCard,
  StatusBadge,
  Table,
  AdminButton,
  AdminInput,
  AdminSelect,
  useAdminToast,
} from '../AdminUI';
import { useConfirm } from '../ConfirmDialog';
import { useIsViewer } from '../../../hooks/useIsViewer';

// ============================================================
// CONSTANTS
// ============================================================

const ACCENT = '#C44D2B';

// A product has exactly 1 main/floor image (images[0]) plus up to
// MAX_SUPPORTING_IMAGES supporting images (images[1..]), which show in
// the storefront grid, product detail, and STYLE WITH / YOU MAY ALSO
// LIKE cards. The floor never shows anything beyond the main image.
const MAX_SUPPORTING_IMAGES = 5;
const MAX_TOTAL_IMAGES = 1 + MAX_SUPPORTING_IMAGES;

// Size taxonomy is defined centrally in data/admin.ts and mirrors the
// Phase 0 `category_sizes` lookup table. The editor must never maintain
// its own hardcoded size list.
// ============================================================
// SIZE STOCK TYPES
// ============================================================

// AdminProduct does not currently declare sizeStocks.
// Keep the editor-only field local to this component.
type SizeStocks = Record<string, number>;

type AdminProductWithSizes = AdminProduct & {
  sizeStocks?: SizeStocks;
  slug?: string;
};


// ============================================================
// CREATE EMPTY PRODUCT
// ============================================================

const createEmptyProduct = (
  categorySizes: CategorySizesMap
): AdminProductWithSizes => ({
  id: `new-${Date.now()}`,
  name: '',
  price: 0,
  image: '',
  images: [],
  category: 'top',
  status: 'Active',
  stock: 0,
  views: 0,
  carts: 0,
  sales: 0,
  conversionRate: 0,
  position: { top: '0px', left: '0%' },
  mobilePosition: { top: '0px', left: '0%' },
  rotation: 0,
  scale: 1,
  zIndex: 1,
  description: '',
  features: [],
  soldOut: false,
  showOnFloor: true,
  sizeStocks: Object.fromEntries(
    (categorySizes.top ?? []).map(size => [size, 0])
  ),
});


// ============================================================
// HELPERS
// ============================================================

const formatCurrency = (value: number): string =>
  `R${value.toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;


const formatNumber = (value: number): string =>
  value.toLocaleString('en-ZA');

// ============================================================
// FLOOR SLOT DETECTION
//
// Mirrors isUnpositionedProduct() in data/admin.ts. The RPC path
// (create_product_with_inventory) has no floor-slot logic server-side,
// so this component must compute a slot itself before calling the RPC
// when the product is still at its sentinel "unset" position — otherwise
// every new product lands at 0px/0% and stacks on the storefront floor.
// ============================================================

const isUnpositionedProduct = (
  product: AdminProductWithSizes
): boolean => {
  const topIsDefault =
    !product.position?.top || product.position.top === '0px';

  const leftIsDefault =
    !product.position?.left || product.position.left === '0%';

  const rotationIsDefault = (Number(product.rotation) || 0) === 0;
  const scaleIsDefault = (Number(product.scale) || 1) === 1;
  const zIndexIsDefault = (Number(product.zIndex) || 1) === 1;

  return (
    topIsDefault &&
    leftIsDefault &&
    rotationIsDefault &&
    scaleIsDefault &&
    zIndexIsDefault
  );
};

// ============================================================
// ADMIN PRODUCTS
// ============================================================

interface AdminProductsProps {
  // See AdminOverview.tsx for why this exists: sections stay mounted
  // at all times, so each one must gate its own fetch on visibility.
  isActive?: boolean;
}

const AdminProducts: React.FC<AdminProductsProps> = ({
  isActive = true,
}) => {
  const [search, setSearch] = useState('');
    const { showToast } = useAdminToast();

  const [products, setProducts] =
    useState<AdminProduct[]>([]);

  const [editingProduct, setEditingProduct] =
    useState<AdminProductWithSizes | null>(null);

    const { confirm, ConfirmDialogElement } = useConfirm();
    
  const [editorMode, setEditorMode] =
    useState<'edit' | 'create'>('edit');

  const [hiddenIds, setHiddenIds] =
    useState<Set<string>>(new Set());

  const [removingIds, setRemovingIds] =
    useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [hasLoadedOnce, setHasLoadedOnce] =
    useState(false);

    const isViewer = useIsViewer();

  const [categorySizes, setCategorySizes] = useState<CategorySizesMap>({
  top: [],
  bottom: [],
  accessory: [],
});

useEffect(() => {
  if (!isActive) return;

  let cancelled = false;

  getCategorySizes()
    .then(sizes => {
      if (!cancelled) setCategorySizes(sizes);
    })
    .catch(err => {
      console.error('Failed to load category sizes:', err);
    });

  return () => {
    cancelled = true;
  };
}, [isActive]);

  // ============================================================
  // LOAD PRODUCTS
  // ============================================================

    const loadProducts = useCallback(async () => {
    if (!hasLoadedOnce) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = await getAdminProducts();

      setProducts(data);

      // Keep the local visibility state aligned with
      // products returned from the data layer.
      setHiddenIds(
        new Set(
          data
            .filter(product => product.status === 'Hidden')
            .map(product => product.id)
        )
      );

      setHasLoadedOnce(true);
    } catch (err) {
      console.error(
        'Failed to load admin products:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load products.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [hasLoadedOnce]);


  useEffect(() => {
    // Don't fetch while hidden. This section stays mounted at all
    // times (AdminDashboard just toggles display: none/block) so
    // that search text and selections survive tab switches — but
    // that means without this guard, it would fire a query the
    // instant the admin panel opens regardless of which tab is
    // visible. Re-fires each time this tab becomes active again,
    // so switching back to Products picks up any changes made
    // elsewhere in the meantime.
    if (!isActive) {
      return;
    }

    let cancelled = false;

        const run = async () => {
      if (!hasLoadedOnce) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await getAdminProducts();

        if (cancelled) {
          return;
        }

        setProducts(data);

        setHiddenIds(
          new Set(
            data
              .filter(product => product.status === 'Hidden')
              .map(product => product.id)
          )
        );

        setHasLoadedOnce(true);
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          'Failed to load admin products:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load products.'
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [isActive, hasLoadedOnce]);


  // ============================================================
  // FILTER
  // ============================================================

  const filtered = products.filter(product =>
    product.name
      .toLowerCase()
      .includes(search.toLowerCase())
  );


  // ============================================================
  // ADD PRODUCT
  // ============================================================

  const handleAddProduct = () => {
  setEditorMode('create');
  setEditingProduct(createEmptyProduct(categorySizes));
};


  // ============================================================
  // EDIT PRODUCT
  // ============================================================

  const handleEditProduct = (
    product: AdminProduct
  ) => {
    setEditorMode('edit');

        setEditingProduct({
      ...product,

      images: product.images
        ? [...product.images]
        : product.image
          ? [product.image]
          : [],

      features: [
        ...(product.features ?? []),
      ],

      showOnFloor:
        (product as AdminProductWithSizes).showOnFloor ?? true,

      // Keep only sizes valid for this product's current category.
      // Missing inventory values are represented as 0.
      sizeStocks: Object.fromEntries(
  (categorySizes[product.category] ?? []).map(size => [
    size,
    Number((product as AdminProductWithSizes).sizeStocks?.[size] ?? 0),
  ])
),
    });
  };


  // ============================================================
  // SAVE PRODUCT
  // ============================================================

    const handleSaveProduct = async (
    updated: AdminProductWithSizes
  ) => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    try {
      setError(null);

      // ==========================================================
      // FLOOR SLOT AUTO-ASSIGNMENT (create only)
      //
      // The RPC has no floor-slot logic server-side. If this is a
      // create and the product is still at its sentinel "unset"
      // position, compute a real slot now — same rule as
      // isUnpositionedProduct() in data/admin.ts: only genuinely new,
      // never-positioned products get auto-placed. Duplicates and
      // manually-positioned products already carry real coordinates
      // and are left as-is.
      // ==========================================================

      let productToSave = updated;

      if (
        editorMode === 'create' &&
        isUnpositionedProduct(updated)
      ) {
        const { data: existingPositions, error: posError } = await supabase
          .from('products')
          .select('position_top, position_left')
          .eq('show_on_floor', true)
          .eq('is_staged', false);

        if (posError) {
          console.error('Failed to load existing floor positions:', posError);
          throw posError;
        }

        const slot = getNextAvailableFloorSlot(
          (existingPositions ?? []).map(p => ({
            top: p.position_top,
            left: p.position_left,
          }))
        );

        productToSave = {
          ...updated,
          position: { ...slot.position },
          mobilePosition: { ...slot.mobilePosition },
          rotation: slot.rotation,
          scale: slot.scale,
          zIndex: slot.zIndex,
        };
      }

      // The Phase 0 RPCs are the single atomic write path for a product and
      // its per-size inventory. They also enforce the canonical
      // category_sizes taxonomy server-side.
      const sizeStocks = Object.fromEntries(
  (categorySizes[productToSave.category] ?? []).map(size => [
    size,
    Math.max(0, Number(productToSave.sizeStocks?.[size] ?? 0)),
  ])
);

      const commonRpcParams = {
        p_slug:
          productToSave.slug ??
          `${(productToSave.name || 'product')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')}-${Date.now()
            .toString()
            .slice(-6)}`,
        p_name: productToSave.name,
        p_price: Number(productToSave.price) || 0,
        p_image: productToSave.image || '',
        p_images: productToSave.images?.length
          ? productToSave.images
          : productToSave.image
            ? [productToSave.image]
            : [],
        p_category: productToSave.category,
        p_status: productToSave.status,
        p_sold_out: Boolean(productToSave.soldOut),
        p_position_top: productToSave.position?.top ?? '0px',
        p_position_left: productToSave.position?.left ?? '0%',
        p_mobile_position_top:
          productToSave.mobilePosition?.top ?? null,
        p_mobile_position_left:
          productToSave.mobilePosition?.left ?? null,
        p_rotation: Number(productToSave.rotation) || 0,
        p_scale: Number(productToSave.scale) || 1,
        p_z_index: Number(productToSave.zIndex) || 1,
        p_description:
          productToSave.description?.trim() || null,
        p_features: productToSave.features ?? [],
      };

      let rpcResult: unknown;

      if (editorMode === 'create') {
        const { data, error } = await supabase.rpc(
          'create_product_with_inventory',
          {
            ...commonRpcParams,
            p_size_stocks: sizeStocks,
          }
        );

        if (error) {
          throw error;
        }

        rpcResult = data;
      } else {
        const { data, error } = await supabase.rpc(
          'update_product_with_inventory',
          {
            p_id: productToSave.id,
            ...commonRpcParams,
            p_size_stocks: sizeStocks,
          }
        );

        if (error) {
          throw error;
        }

        rpcResult = data;
      }

      // Both Phase 0 RPCs return the finished product row plus its resolved
      // inventory as a JSON object. Use that response directly instead of
      // performing a second full products query.
      const row =
        rpcResult &&
        typeof rpcResult === 'object' &&
        !Array.isArray(rpcResult)
          ? (rpcResult as Record<string, any>)
          : null;

      if (!row) {
        throw new Error(
          'Product save succeeded but the database returned no product row.'
        );
      }

      const returnedSizes = Array.isArray(row.sizes)
        ? row.sizes
        : [];

      const returnedSizeStocks: SizeStocks = Object.fromEntries(
        returnedSizes
          .filter(
            (entry: any) =>
              entry &&
              typeof entry.size === 'string'
          )
          .map((entry: any) => [
            entry.size,
            Math.max(0, Number(entry.available ?? 0)),
          ])
      );

      const savedProduct: AdminProductWithSizes = {
        ...productToSave,
        id: String(row.id ?? productToSave.id),
        slug: String(row.slug ?? productToSave.slug ?? ''),
        name: String(row.name ?? productToSave.name),
        price: Number(row.price ?? productToSave.price ?? 0),
        image: String(row.image ?? productToSave.image ?? ''),
        images: Array.isArray(row.images)
          ? row.images
          : productToSave.images ?? [],
        category:
          row.category ?? productToSave.category,
        status:
          row.status ?? productToSave.status,
        stock: Number(
          row.stock ??
            Object.values(returnedSizeStocks).reduce(
              (sum, value) => sum + value,
              0
            )
        ),
        position: {
          top:
            row.position_top ??
            productToSave.position?.top ??
            '0px',
          left:
            row.position_left ??
            productToSave.position?.left ??
            '0%',
        },
        mobilePosition:
          row.mobile_position_top != null &&
          row.mobile_position_left != null
            ? {
                top: row.mobile_position_top,
                left: row.mobile_position_left,
              }
            : productToSave.mobilePosition,
        rotation: Number(
          row.rotation ?? productToSave.rotation ?? 0
        ),
        scale: Number(
          row.scale ?? productToSave.scale ?? 1
        ),
        zIndex: Number(
          row.z_index ?? productToSave.zIndex ?? 1
        ),
        description:
          row.description ?? productToSave.description ?? '',
        features: Array.isArray(row.features)
          ? row.features
          : productToSave.features ?? [],
        soldOut: Boolean(
          row.sold_out ?? productToSave.soldOut
        ),
        sizeStocks: returnedSizeStocks,
      };

      if (editorMode === 'create') {
        setProducts(prev => [
          savedProduct,
          ...prev,
        ]);
      } else {
        setProducts(prev =>
          prev.map(item =>
            item.id === savedProduct.id
              ? {
                  ...item,
                  ...savedProduct,
                }
              : item
          )
        );
      }

      // Bug 2 fix: the RPC path never busts the shared admin cache, so
      // getAdminProducts() ('products:all', 60s TTL) would keep serving
      // stale stock/sales/price to Dashboard/Analytics/Inventory for up
      // to a minute after this save. Local setProducts() above only
      // updates THIS component's view.
      invalidateAdminCache('products:');

        showToast(
        'success',
        editorMode === 'create'
          ? `Successfully created product "${savedProduct.name}".`
          : `Successfully updated product "${savedProduct.name}".`
      );

      setEditingProduct(null);
    } catch (err) {
      console.error(
        'Failed to save product:',
        err
      );

      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to save product.';

      setError(errorMessage);

      showToast('error', errorMessage);
    }
  };


  // ============================================================
  // DUPLICATE PRODUCT
  // ============================================================

  const handleDuplicate = async (
    product: AdminProduct & { slug?: string }
  ) => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    const baseSlug = (product.name || 'product')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const copySlug = `${baseSlug}-copy-${Date.now().toString().slice(-6)}`;

        const copy: AdminProductWithSizes = {
      ...product,
      id: `new-${Date.now()}`,
      name: `${product.name} (Copy)`,
      slug: copySlug,
      images: product.images
        ? [...product.images]
        : product.image
          ? [product.image]
          : [],
      features: [...(product.features ?? [])],
      showOnFloor:
        (product as AdminProductWithSizes).showOnFloor ?? true,
      sizeStocks: Object.fromEntries(
  (categorySizes[product.category] ?? []).map(size => [
    size,
    Number((product as AdminProductWithSizes).sizeStocks?.[size] ?? 0),
  ])
),
    };

    try {
      setError(null);

      const created = await createAdminProductWithInventory(copy);

      showToast(
        'success',
        `Successfully duplicated product "${product.name}".`
      );

      setProducts(prev => {
        const index = prev.findIndex(item => item.id === product.id);
        if (index === -1) {
          return [created, ...prev];
        }
        const next = [...prev];
        next.splice(index + 1, 0, created);
        return next;
      });
    } catch (err) {
      console.error('Failed to duplicate product:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to duplicate product.';
      setError(errorMessage);
        showToast('error', errorMessage);
    }
  };


  // ============================================================
  // TOGGLE VISIBILITY
  // ============================================================

  const handleToggleVisibility = async (
    id: string
  ) => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    const product =
      products.find(
        item => item.id === id
      );

    if (!product) {
      return;
    }

    const willHide =
      !hiddenIds.has(id);

    const nextStatus:
      | 'Active'
      | 'Hidden'
      | 'Sold Out' =
      product.soldOut
        ? 'Sold Out'
        : willHide
          ? 'Hidden'
          : 'Active';

    try {
      setError(null);

      await updateAdminProductStatus(
        id,
        nextStatus,
        product.soldOut
      );

      showToast(
        'success',
        `Product visibility updated to ${nextStatus}.`
      );

      setHiddenIds(prev => {
        const next = new Set(prev);

        if (willHide) {
          next.add(id);
        } else {
          next.delete(id);
        }

        return next;
      });

      setProducts(prev =>
        prev.map(item =>
          item.id === id
            ? {
                ...item,
                status: nextStatus,
              }
            : item
        )
      );

    } catch (err) {
      console.error(
        'Failed to update product visibility:',
        err
      );

      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to update product visibility.';

      setError(errorMessage);

      showToast('error', errorMessage);
    }
  };


  // ============================================================
  // TOGGLE SOLD OUT
  // ============================================================

  const handleToggleSoldOut = async (
    id: string
  ) => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    const product =
      products.find(
        item => item.id === id
      );

    if (!product) {
      return;
    }

    const nextSoldOut =
      !product.soldOut;

    const isHidden =
      hiddenIds.has(id);

    let nextStatus:
      | 'Active'
      | 'Hidden'
      | 'Sold Out';

    if (nextSoldOut) {
      nextStatus = 'Sold Out';
    } else if (isHidden) {
      nextStatus = 'Hidden';
    } else {
      nextStatus = 'Active';
    }

    try {
      setError(null);

      await updateAdminProductStatus(
        id,
        nextStatus,
        nextSoldOut
      );

      showToast(
        'success',
        `Product stock status updated.`
      );

      setProducts(prev =>
        prev.map(item =>
          item.id === id
            ? {
                ...item,
                soldOut: nextSoldOut,
                status: nextStatus,
              }
            : item
        )
      );

    } catch (err) {
      console.error(
        'Failed to update sold-out status:',
        err
      );

      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to update sold-out status.';

      setError(errorMessage);

      showToast('error', errorMessage);
    }
  };


  // ============================================================
  // DELETE
  // ============================================================

  const handleDelete = async (
    id: string,
    name: string
  ) => {
    if (isViewer) {
    showToast('error', "You don't have permission to make changes (Viewer role).");
    return;
  }
    const ok = await confirm('Delete product?', `Delete "${name}"? This cannot be undone.`, 'Delete');
  if (!ok) return;

    setRemovingIds(prev =>
      new Set(prev).add(id)
    );

    try {
      setError(null);

      // Delete from Supabase
      await deleteAdminProduct(id, name);

      showToast(
        'success',
        `Successfully deleted product "${name}".`
      );

      // Keep the UI in sync
      window.setTimeout(() => {
        setProducts(prev =>
          prev.filter(
            product =>
              product.id !== id
          )
        );

        setHiddenIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });

        setRemovingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 300);

    } catch (err) {
      console.error(
        'Failed to delete product:',
        err
      );

      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to delete product.';

      setError(errorMessage);

      showToast('error', errorMessage);
    }
  };


  // ============================================================
  // LOADING STATE
  // ============================================================

    if (isLoading && !hasLoadedOnce) {
    return (
      <div>
        <PageTitle
          title="Products"
          subtitle="Manage your product catalog"
        />

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="h-10 w-full sm:max-w-md bg-gray-100 animate-pulse" />

          <div className="h-10 w-32 bg-gray-100 animate-pulse sm:ml-auto" />
        </div>

        <SectionCard title="Products">
          <div className="space-y-0">
            {Array.from({
              length: 6,
            }).map((_, index) => (
              <div
                key={index}
                className="h-16 border-b border-gray-50 bg-gray-50/50 animate-pulse"
              />
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }


  // ============================================================
  // ERROR STATE
  // ============================================================

  if (error && products.length === 0) {
    return (
      <div>
        <PageTitle
          title="Products"
          subtitle="Manage your product catalog"
        />

        <div className="border border-gray-200 bg-white p-8">

          <div className="flex items-start gap-4">

            <div className="w-10 h-10 bg-red-50 flex items-center justify-center shrink-0">
              <AlertCircle
                size={18}
                className="text-red-500"
              />
            </div>

            <div className="flex-1">

              <p className="text-sm font-medium text-gray-900">
                Failed to load products
              </p>

              <p className="text-sm text-gray-500 mt-1">
                {error}
              </p>

              <button
                type="button"
                onClick={loadProducts}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs tracking-wide hover:bg-black transition-colors"
              >
                <RefreshCw size={13} />

                Retry
              </button>

            </div>

          </div>

        </div>
      </div>
    );
  }


  // ============================================================
  // MAIN
  // ============================================================

  return (
    <div>

      {/* ======================================================
          PAGE TITLE
      ====================================================== */}

      <PageTitle
        title="Products"
        subtitle="Manage your product catalog"
      />


      {/* ======================================================
          PRODUCT EDITOR
      ====================================================== */}

      {editingProduct && (
  <ProductEditor
    product={editingProduct}
    mode={editorMode}
    categorySizes={categorySizes}
    onClose={() => setEditingProduct(null)}
    onSave={handleSaveProduct}
  />
)}

{ConfirmDialogElement}
      {/* ======================================================
          TOOLBAR
      ====================================================== */}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-6 gap-4 sticky top-0 sm:static z-10 bg-[#fafafa] sm:bg-transparent py-3 sm:py-0 -mx-4 px-4 sm:mx-0 sm:px-0">

        <div className="relative flex-1 max-w-md">

          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={event =>
              setSearch(
                event.target.value
              )
            }
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 bg-white focus:outline-none focus:border-gray-400 transition-colors"
          />

        </div>


        <AdminButton
  onClick={handleAddProduct}
  disabled={isViewer}
>
  <Plus size={16} className="inline mr-1" />
  Add Product
</AdminButton>

      </div>


      {/* ======================================================
          PRODUCT TABLE
      ====================================================== */}

      <SectionCard
        title={`Products (${filtered.length})`}
      >

        {filtered.length === 0 ? (

          <div className="py-16 text-center">

            <Package
              size={24}
              className="mx-auto text-gray-300"
            />

            <p className="text-sm text-gray-500 mt-3">
              {search
                ? 'No products match your search.'
                : 'No products found.'}
            </p>

            {!search && (
              <button
                type="button"
                onClick={
                  handleAddProduct
                }
                className="mt-4 text-xs font-medium hover:underline"
                style={{
                  color: ACCENT,
                }}
              >
                Add your first product
              </button>
            )}

          </div>

        ) : (

          <Table
            headers={[
              'Image',
              'Product',
              'Category',
              'Price',
              'Stock',
              'Status',
              'Actions',
            ]}
          >

            {filtered.map(
              product => {

                const isHidden =
                  hiddenIds.has(
                    product.id
                  );

                const isRemoving =
                  removingIds.has(
                    product.id
                  );

                return (
                  <tr
                    key={
                      product.id
                    }
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-all duration-300 ${
                      isRemoving
                        ? 'opacity-0 scale-[0.98]'
                        : isHidden
                          ? 'opacity-50'
                          : 'opacity-100'
                    }`}
                  >

                    {/* IMAGE */}

                    <td className="py-3 px-4">

                      {product.image ? (
                        <img
                          src={
                            product.image
                          }
                          alt={
                            product.name
                          }
                          className="w-10 h-12 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-12 bg-gray-100 flex items-center justify-center">
                          <Package
                            size={14}
                            className="text-gray-400"
                          />
                        </div>
                      )}

                    </td>


                    {/* PRODUCT */}

                    <td className="py-3 px-4 text-sm text-gray-800">

                                            <div className="flex items-center gap-2">

                        <span>
                          {product.name ||
                            'Unnamed Product'}
                        </span>

                        {isHidden && (
                          <span className="text-[10px] uppercase tracking-wide text-gray-400 border border-gray-200 px-1.5 py-0.5">
                            Hidden
                          </span>
                        )}

                        {product.showOnFloor === false && (
                          <span
                            className="text-[10px] uppercase tracking-wide border px-1.5 py-0.5"
                            style={{ color: ACCENT, borderColor: `${ACCENT}4D` }}
                            title="Not shown on the storefront floor or grid — still linkable in banners/hero"
                          >
                            Off Floor
                          </span>
                        )}

                      </div>

                    </td>


                    {/* CATEGORY */}

                    <td className="py-3 px-4 text-sm text-gray-600 capitalize">
                      {product.category}
                    </td>


                    {/* PRICE */}

                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatCurrency(
                        product.price
                      )}
                    </td>


                    {/* STOCK */}

                    <td className="py-3 px-4 text-sm">

                      <span
                        className={
                          product.stock <= 0
                            ? 'text-red-500 font-medium'
                            : product.stock < 5
                              ? 'text-[#C44D2B] font-medium'
                              : 'text-gray-600'
                        }
                      >
                        {formatNumber(
                          product.stock
                        )}
                      </span>

                    </td>


                    {/* STATUS */}

                    <td className="py-3 px-4">

                      <div className="flex items-center gap-1 flex-wrap">

                        <StatusBadge
                          status={
                            product.status
                          }
                        />

                        {product.soldOut && (
                          <span className="text-[10px] uppercase tracking-wide text-white bg-black px-1.5 py-0.5">
                            Sold Out
                          </span>
                        )}

                      </div>

                    </td>


                    {/* ACTIONS */}

                    <td className="py-3 px-4">

                      <div className="flex items-center gap-1">

                        {/* EDIT */}

                        <button
                          type="button"
                          onClick={() =>
                            handleEditProduct(
                              product
                            )
                          }
                          className="p-1.5 hover:bg-gray-200 text-gray-600 transition-colors"
                          title="Edit"
                        >
                          <Edit2
                            size={14}
                          />
                        </button>


                        {/* DUPLICATE */}

                        <button
                          type="button"
                          onClick={() =>
                            handleDuplicate(
                              product
                            )
                          }
                          className="p-1.5 hover:bg-gray-200 text-gray-600 transition-colors"
                          title="Duplicate"
                        >
                          <Copy
                            size={14}
                          />
                        </button>


                        {/* HIDE / SHOW */}

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleVisibility(
                              product.id
                            )
                          }
                          className={`p-1.5 transition-colors ${
                            isHidden
                              ? 'bg-gray-200 text-gray-500'
                              : 'hover:bg-gray-200 text-gray-600'
                          }`}
                          title={
                            isHidden
                              ? 'Show'
                              : 'Hide'
                          }
                        >
                          {isHidden ? (
                            <EyeOff
                              size={14}
                            />
                          ) : (
                            <Eye
                              size={14}
                            />
                          )}
                        </button>


                        {/* SOLD OUT */}

<button
  type="button"
  onClick={() =>
    handleToggleSoldOut(
      product.id
    )
  }
  className={`p-1.5 transition-colors ${
    product.soldOut
      ? 'bg-black text-white hover:bg-gray-800'
      : 'hover:bg-gray-200 text-gray-600'
  }`}
  title={
    product.soldOut && product.stock <= 0
      ? "Can't un-mark as sold out while stock is 0 — add inventory first"
      : product.soldOut
      ? 'Mark In Stock'
      : 'Mark Sold Out'
  }
>
  <Package
    size={14}
  />
</button>


                        {/* DELETE */}

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(
                              product.id,
                              product.name
                            )
                          }
                          className="p-1.5 hover:bg-red-100 text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2
                            size={14}
                          />
                        </button>

                      </div>

                    </td>

                  </tr>
                );
              }
            )}

          </Table>

        )}

      </SectionCard>

    </div>
  );
};


// ============================================================
// PRODUCT EDITOR
// ============================================================

const ProductEditor: React.FC<{
  product: AdminProductWithSizes;
  mode: 'edit' | 'create';
  categorySizes: CategorySizesMap;
  onClose: () => void;
  onSave: (product: AdminProductWithSizes) => void;
}> = ({ product, mode, categorySizes, onClose, onSave }) => {

  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
const [keepOriginalBackground, setKeepOriginalBackground] = useState(false);

  const [name, setName] =
    useState(product.name);

  const [price, setPrice] =
    useState(
      String(product.price)
    );

  const [category, setCategory] =
    useState(product.category);

    const { showToast } = useAdminToast();

  // ============================================================
  // SIZE STOCKS
  // ============================================================

  const [sizeStocks, setSizeStocks] = useState<SizeStocks>(() =>
    Object.fromEntries(
      (categorySizes[product.category] ?? []).map(size => [
        size,
        Number(product.sizeStocks?.[size] ?? 0),
      ])
    )
  );

  // Whenever category changes, rebuild the stock map from the canonical
  // taxonomy. Existing values for sizes that still exist are preserved;
  // sizes that are no longer valid disappear from the editor state.
  useEffect(() => {
    setSizeStocks(prev => {
      const next: SizeStocks = {};
      for (const size of categorySizes[category] ?? []) {
        next[size] = Number(prev[size] ?? 0);
      }
      return next;
    });
  }, [category, categorySizes]);


  const [description, setDescription] =
    useState(
      product.description ?? ''
    );

  const [features, setFeatures] =
    useState(
      (product.features ?? []).join(
        '\n'
      )
    );

  const [desktopTop, setDesktopTop] =
    useState(
      product.position?.top ??
        '0px'
    );

  const [desktopLeft, setDesktopLeft] =
    useState(
      product.position?.left ??
        '0%'
    );

  const [mobileTop, setMobileTop] =
    useState(
      product.mobilePosition?.top ??
        '0px'
    );

  const [mobileLeft, setMobileLeft] =
    useState(
      product.mobilePosition?.left ??
        '0%'
    );

  const [rotation, setRotation] =
    useState(
      String(
        product.rotation ?? 0
      )
    );

  const [scale, setScale] =
    useState(
      String(
        product.scale ?? 1
      )
    );

  const [zIndex, setZIndex] =
    useState(
      String(
        product.zIndex ?? 1
      )
    );

  const [soldOut, setSoldOut] =
    useState(
      product.soldOut
    );

      const [showOnFloor, setShowOnFloor] =
    useState(product.showOnFloor ?? true);

  const [images, setImages] =
    useState<string[]>(
      product.images?.length
        ? [...product.images]
        : product.image
          ? [product.image]
          : []
    );

  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );


  // Derived counts for the uploader UI. images[0] is the main/floor
  // image; everything after that is a supporting image.
  const supportingCount = Math.max(
    0,
    images.length - 1
  );

  const remainingSupportingSlots = Math.max(
    0,
    MAX_SUPPORTING_IMAGES - supportingCount
  );

  const isAtImageLimit =
    images.length >= MAX_TOTAL_IMAGES;


  // Calculate total stock automatically based on individual size values.
  const totalCalculatedStock =
    Object.values(sizeStocks).reduce(
      (sum, val) =>
        sum + (Number(val) || 0),
      0
    );


  // ============================================================
  // IMAGE
  // ============================================================

  const handleAddImageClick =
    () => {
      if (isAtImageLimit || isUploadingImages) {
        return;
      }

      fileInputRef.current?.click();
    };


  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_TOTAL_IMAGES - images.length;
    if (remainingSlots <= 0) {
      showToast('error', `This product already has the maximum of ${MAX_TOTAL_IMAGES} images.`);
      event.target.value = '';
      return;
    }

    const filesToAdd = Array.from(files).slice(0, remainingSlots);
    if (files.length > filesToAdd.length) {
      showToast('error', `Only ${filesToAdd.length} of the ${files.length} selected images were added.`);
    }

    setIsUploadingImages(true);
    setImageUploadError(null);

    try {
      for (const file of filesToAdd) {
  const url = await uploadProductImage(
    file,
    !keepOriginalBackground,
    processedUrl => {
      // Swap the raw image for the background-removed one once the
      // server job finishes — no re-upload, no blocking.
      setImages(prev => prev.map(img => (img === url ? processedUrl : img)));
    }
  );
  setImages(prev =>
    prev.length >= MAX_TOTAL_IMAGES ? prev : [...prev, url]
  );

  if (images[0]) {
    // 2. Inside image upload check-image-consistency call:
supabase.functions
  .invoke('check-image-consistency', { body: { referenceUrl: images[0], newUrl: url } })
  .then(async ({ data, error }) => {
    if (error) {
      const detail = await (error as any).context?.json?.().catch(() => null);
      console.error('Consistency check error:', detail?.error ?? error.message);
      return;
    }
    if (data && !data.consistent) {
      showToast('error', data.note ?? "This image's background differs from your main photo — consider reshooting.");
    }
  })
  .catch(() => {});
  }
}
    } catch (err) {
      console.error('Failed to upload product image:', err);
      setImageUploadError(
        err instanceof Error ? err.message : 'Failed to upload image.'
      );
    } finally {
      setIsUploadingImages(false);
      event.target.value = '';
    }
  };


  const handleRemoveImage = (
    index: number
  ) => {
    setImages(prev =>
      prev.filter(
        (_, imageIndex) =>
          imageIndex !== index
      )
    );
  };


  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit = () => {
    const cleanFeatures = features
      .split('\n')
      .map(feature => feature.trim())
      .filter(Boolean);

    const updatedStatus: 'Active' | 'Hidden' | 'Sold Out' = soldOut
      ? 'Sold Out'
      : product.status === 'Hidden'
        ? 'Hidden'
        : 'Active';

    const normalizedSizeStocks: SizeStocks = Object.fromEntries(
  (categorySizes[category] ?? []).map(size => [
    size,
    Math.max(0, Number(sizeStocks[size] ?? 0)),
  ])
);

    // Generate a unique slug on create, or keep the existing slug on update
    const baseSlug = (name.trim() || 'product')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const finalSlug =
      mode === 'create' || !product.slug
        ? `${baseSlug}-${Date.now().toString().slice(-6)}`
        : product.slug;

    const updated: AdminProductWithSizes = {
      ...product,
      slug: finalSlug,
      name: name.trim(),
      price: Number(price) || 0,
      category,
      stock: Object.values(normalizedSizeStocks).reduce(
        (sum, value) => sum + value,
        0
      ),
      sizeStocks: normalizedSizeStocks,
      description: description.trim(),
      features: cleanFeatures,
      position: {
        top: desktopTop.trim() || '0px',
        left: desktopLeft.trim() || '0%',
      },
      mobilePosition: {
        top: mobileTop.trim() || '0px',
        left: mobileLeft.trim() || '0%',
      },
      rotation: Number(rotation) || 0,
      scale: Number(scale) || 1,
      zIndex: Number(zIndex) || 1,
            soldOut,
      status: updatedStatus,
      images,
      image: images[0] || product.image || '',
      showOnFloor,
    };

    onSave(updated);
  };


  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">

      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">

          <div>

            <h2 className="text-lg font-light text-gray-900">
              {mode === 'create'
                ? 'Add Product'
                : 'Edit Product'}
            </h2>

            <p className="text-xs text-gray-400 mt-1">
              {mode === 'create'
                ? 'Create a new catalog product'
                : 'Update product information'}
            </p>

          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>

        </div>


        {/* ====================================================
            BODY
        ==================================================== */}

        <div className="p-6 space-y-6">

          {/* ==================================================
              IMAGES
          ================================================== */}

          <div>

            <p className="text-xs text-gray-500 mb-2">
              Product Images
            </p>


<label className="flex items-center gap-2 text-[11px] text-gray-400 mt-2">
  <input
    type="checkbox"
    checked={keepOriginalBackground}
    onChange={e => setKeepOriginalBackground(e.target.checked)}
    className="w-3.5 h-3.5"
  />
  Keep original background
</label>
            <div className="flex flex-wrap gap-3">

              {images.map(
                (image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="relative w-16 h-20 group"
                  >

                    <img
                      src={image}
                      alt=""
                      className="w-full h-full object-cover border border-gray-200"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveImage(
                          index
                        )
                      }
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      title="Remove image"
                    >
                      <X size={12} />
                    </button>

                    {index === 0 ? (
                      <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[8px] text-center py-0.5">
                        MAIN
                      </span>
                    ) : (
                      <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center py-0.5">
                        SUPPORTING {index}
                      </span>
                    )}

                  </div>
                )
              )}


              {/* ADD IMAGE */}

              {!isAtImageLimit && (
                <button
                  type="button"
                  onClick={
                    handleAddImageClick
                  }
                  disabled={isUploadingImages}
                  className="w-16 h-20 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                  title="Add image"
                >
                  <Plus size={18} />
                </button>
              )}

              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept="image/*"
                multiple
                onChange={
                  handleFileChange
                }
                className="hidden"
              />

            </div>

            {isUploadingImages && (
              <p className="text-xs text-blue-600 mt-2">Uploading images...</p>
            )}

            {imageUploadError && (
              <p className="text-xs text-red-500 mt-2">{imageUploadError}</p>
            )}

            <p className="text-[11px] text-gray-400 mt-2">
              {images.length === 0
                ? `Upload up to ${MAX_TOTAL_IMAGES} images. The first is the main image, shown on the product floor.`
                : `The first image is the main image, shown only on the product floor. The remaining ${supportingCount} of ${MAX_SUPPORTING_IMAGES} supporting image${
                    supportingCount === 1
                      ? ''
                      : 's'
                  } show in the product grid, product details, and recommendation cards.${
                    remainingSupportingSlots > 0
                      ? ` You can add ${remainingSupportingSlots} more.`
                      : ' You have reached the supporting image limit.'
                  }`}
            </p>

          </div>


          {/* ==================================================
              BASIC INFORMATION
          ================================================== */}

          <div className="border-t border-gray-100 pt-5">

            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Product Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <AdminInput
                label="Product Name"
                value={name}
                onChange={
                  setName
                }
              />

              <AdminInput
                label="Price (R)"
                value={price}
                onChange={
                  setPrice
                }
                type="number"
              />

              <AdminSelect
                label="Category"
                value={category}
                onChange={value => {

                  if (
                    value === 'top' ||
                    value === 'bottom' ||
                    value === 'accessory'
                  ) {
                    setCategory(
                      value
                    );
                  }

                }}
                options={[
                  {
                    value: 'top',
                    label: 'Top',
                  },
                  {
                    value: 'bottom',
                    label: 'Bottom',
                  },
                  {
                    value: 'accessory',
                    label: 'Accessory',
                  },
                ]}
              />

            </div>

          </div>


          {/* ==================================================
              STOCK BY SIZE
          ================================================== */}

          <div className="border-t border-gray-100 pt-5">

            <div className="flex items-center justify-between mb-3">

              <h3 className="text-sm font-medium text-gray-700">
                Stock by Size
              </h3>

              <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2.5 py-1">

                Total Stock:{' '}

                <strong className="text-gray-900">
                  {totalCalculatedStock}
                </strong>

              </span>

            </div>

            <p className="text-xs text-gray-400 mb-4">
              Enter the available quantity for each available clothing size.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

              {(categorySizes[category] ?? []).map(
                size => (
                  <div
                    key={size}
                    className="space-y-1"
                  >

                    <label className="block text-[11px] font-medium text-gray-600 uppercase tracking-wide">
                      Size {size}
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={
                        sizeStocks[size]
                      }
                      onChange={e =>
                        setSizeStocks(prev => ({
                          ...prev,
                          [size]:
                            e.target.value === ''
                              ? 0
                              : Math.max(
                                  0,
                                  Number(e.target.value) || 0
                                ),
                        }))
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-200 focus:outline-none focus:border-gray-400 transition-colors bg-white"
                    />

                  </div>
                )
              )}

            </div>

          </div>


          {/* ==================================================
              DESCRIPTION
          ================================================== */}

          <div>

            <div className="flex items-center justify-between mb-1">
  <label className="block text-xs font-medium text-gray-500 tracking-wide">
    Description
  </label>
  <button
    type="button"
    disabled={isGeneratingDescription || !name.trim()}
    onClick={async () => {
      setIsGeneratingDescription(true);
      try {
        // 1. Inside description generation onClick handler:
const { data, error } = await supabase.functions.invoke('generate-product-description', {
  body: { name, category, features: features.split('\n').filter(Boolean) },
});

if (error) {
  const detail = await (error as any).context?.json?.().catch(() => null);
  const errorMessage = detail?.error ?? error.message;
  console.error('Description generation error:', errorMessage);
  showToast('error', errorMessage);
  return;
}
        setDescription(data.text);
      } catch (err) {
        console.error('Failed to generate description:', err);
      } finally {
        setIsGeneratingDescription(false);
      }
    }}
    className="text-xs text-[#C44D2B] hover:underline disabled:opacity-50"
  >
    {isGeneratingDescription ? 'Generating…' : '✨ Generate with AI'}
  </button>
</div>

            <textarea
              value={
                description
              }
              onChange={event =>
                setDescription(
                  event.target.value
                )
              }
              rows={4}
              placeholder="Describe the product..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 focus:outline-none focus:border-gray-400 transition-colors resize-none"
            />

          </div>


          {/* ==================================================
              FEATURES
          ================================================== */}

          <div>

            <label className="block text-xs font-medium text-gray-500 mb-1 tracking-wide">
              Features
            </label>

            <p className="text-[11px] text-gray-400 mb-2">
              Add one product feature per line.
            </p>

            <textarea
              value={
                features
              }
              onChange={event =>
                setFeatures(
                  event.target.value
                )
              }
              rows={5}
              placeholder={`Heavyweight cotton
Relaxed fit
Waist-length cut`}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 focus:outline-none focus:border-gray-400 transition-colors resize-none"
            />

          </div>


          {/* ==================================================
              FLOOR POSITIONING
          ================================================== */}

          <div className="border-t border-gray-100 pt-5">

            <h3 className="text-sm font-medium text-gray-700 mb-1">
              Floor Positioning
            </h3>

            <p className="text-xs text-gray-400 mb-4">
              Controls where the product appears on the storefront floor.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* DESKTOP */}

              <div>

                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  Desktop Position
                </p>

                <div className="space-y-2">

                  <AdminInput
                    label="Top"
                    value={
                      desktopTop
                    }
                    onChange={
                      setDesktopTop
                    }
                  />

                  <AdminInput
                    label="Left"
                    value={
                      desktopLeft
                    }
                    onChange={
                      setDesktopLeft
                    }
                  />

                </div>

              </div>


              {/* MOBILE */}

              <div>

                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  Mobile Position
                </p>

                <div className="space-y-2">

                  <AdminInput
                    label="Top"
                    value={
                      mobileTop
                    }
                    onChange={
                      setMobileTop
                    }
                  />

                  <AdminInput
                    label="Left"
                    value={
                      mobileLeft
                    }
                    onChange={
                      setMobileLeft
                    }
                  />

                </div>

              </div>

            </div>


            {/* TRANSFORM */}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">

              <AdminInput
                label="Rotation"
                value={
                  rotation
                }
                onChange={
                  setRotation
                }
                type="number"
              />

              <AdminInput
                label="Scale"
                value={
                  scale
                }
                onChange={
                  setScale
                }
                type="number"
              />

              <AdminInput
                label="Z-Index"
                value={
                  zIndex
                }
                onChange={
                  setZIndex
                }
                type="number"
              />

            </div>

          </div>


                    {/* ==================================================
              SOLD OUT
          ================================================== */}

          <div className="border-t border-gray-100 pt-5">

            <label className="flex items-center gap-3 cursor-pointer">

              <input
                type="checkbox"
                checked={
                  soldOut
                }
                onChange={event =>
                  setSoldOut(
                    event.target.checked
                  )
                }
                className="w-4 h-4"
                style={{
                  accentColor:
                    ACCENT,
                }}
              />

              <div>

                <span className="text-sm text-gray-700">
                  Mark as Sold Out
                </span>

                <p className="text-xs text-gray-400 mt-0.5">
                  Prevent customers from purchasing this product.
                </p>

              </div>

            </label>

          </div>


          {/* ==================================================
              SHOW ON FLOOR
          ================================================== */}

          <div className="border-t border-gray-100 pt-5">

            <label className="flex items-center gap-3 cursor-pointer">

              <input
                type="checkbox"
                checked={showOnFloor}
                onChange={event =>
                  setShowOnFloor(event.target.checked)
                }
                className="w-4 h-4"
                style={{ accentColor: ACCENT }}
              />

              <div>

                <span className="text-sm text-gray-700">
                  Show on Product Floor
                </span>

                <p className="text-xs text-gray-400 mt-0.5">
                  Uncheck to keep this product live and purchasable —
                  e.g. linked in a banner or hero collection — without
                  showing it on the main storefront floor or grid yet.
                </p>

              </div>

            </label>

          </div>
        </div>


        {/* ====================================================
            FOOTER
        ==================================================== */}

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">

          <AdminButton
            variant="secondary"
            onClick={
              onClose
            }
          >
            Cancel
          </AdminButton>

          <AdminButton
            onClick={
              handleSubmit
            }
            disabled={isUploadingImages}
          >
            <Save
              size={14}
              className="inline mr-1"
            />

            {mode === 'create'
              ? 'Create Product'
              : 'Save Changes'}
          </AdminButton>

        </div>

      </div>

    </div>
  );
};


export default AdminProducts;