// src/data/admin.ts

import { supabase } from '../lib/supabase';
import { cached, invalidateAdminCache, SLOW_TTL_MS } from '../lib/adminCache';
import { invalidateCache } from '../lib/requestCache';

import {
  AdminKPI,
  AdminOrder,
  AdminCustomer,
  AdminInventoryItem,
  AdminInventoryHistory,
  AdminProduct,
  AdminActivity,
  AdminDiscount,
  AdminCampaign,
  AdminAbandonedCart,
  AdminAdminUser,
  AdminFinance,
  AdminChartPoint,
} from '../types/admin';

export interface ProductFloorPositionInput {
  id: string;
  position: { top: string; left: string };
  mobilePosition?: { top: string; left: string };
  rotation: number;
  scale: number;
  zIndex: number;
  // Omit to leave the current flag untouched (JSON.stringify drops
  // undefined keys, so Supabase never receives this column when
  // callers don't pass it).
  showOnFloor?: boolean;
}

export const updateProductFloorPosition = async (
  input: ProductFloorPositionInput
): Promise<void> => {
  const { error } = await supabase
    .from('products')
    .update({
      position_top: input.position.top,
      position_left: input.position.left,
      mobile_position_top: input.mobilePosition?.top ?? null,
      mobile_position_left: input.mobilePosition?.left ?? null,
      rotation: input.rotation,
      scale: input.scale,
      z_index: input.zIndex,
      show_on_floor: input.showOnFloor,
    })
    .eq('id', input.id);

  if (error) {
    console.error('Failed to update product floor position:', error);
    throw error;
  }

  invalidateAdminCache('products:');
};

// ============================================================
// ADMIN ACCESS
// ============================================================

export const ADMIN_EMAILS = [
  'admin@notorious.y2',
  'owner@notorious.y2',
  'manager@notorious.y2',
];

export const isAdminEmail = (email: string): boolean =>
  ADMIN_EMAILS.some(
    existing => existing.toLowerCase() === email.toLowerCase()
  );

// ============================================================
// HELPERS
// ============================================================

const number = (value: unknown): number =>
  Number(value ?? 0);

const dateLabel = (value: string | Date): string => {
  const date = new Date(value);

  return `${date.getDate()}/${date.getMonth() + 1}`;
};

const dateTimeLabel = (value: string | Date): string =>
  new Date(value).toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const startOfDay = (date = new Date()): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const daysAgo = (days: number): Date => {
  const date = startOfDay();
  date.setDate(date.getDate() - days);
  return date;
};

const normaliseAddress = (
  address: unknown
): {
  line1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
} | undefined => {
  if (!address || typeof address !== 'object') {
    return undefined;
  }

  const value = address as Record<string, unknown>;

  return {
    line1: String(
      value.line1 ??
        value.address_line1 ??
        ''
    ),

    city: String(
      value.city ?? ''
    ),

    state: String(
      value.state ?? ''
    ),

    zip: String(
      value.zip ??
        value.zip_code ??
        ''
    ),

    country: String(
      value.country ??
        'South Africa'
    ),

    phone: value.phone
      ? String(value.phone)
      : undefined,
  };
};

// ============================================================
// ANALYTICS TYPES
// ============================================================

export interface AdminRevenueCategory {
  category: string;
  revenue: number;
  percentage: number;
}

export interface AdminRevenueCountry {
  country: string;
  revenue: number;
  percentage: number;
}

export interface AdminRevenuePayment {
  method: string;
  revenue: number;
  percentage: number;
}

// ============================================================
// KPIs
// ============================================================

export const getAdminKPIs = async (): Promise<AdminKPI> =>
  cached('kpis', async () => {
    const { data, error } = await supabase
      .from('admin_kpis')
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    const row = data ?? {};

    return {
      revenue: number(row.revenue),
      orders: number(row.orders),
      averageOrderValue: number(
        row.average_order_value
      ),
      customers: number(row.customers),

      conversionRate: number(
        row.conversion_rate
      ),

      itemsSold: number(
        row.items_sold
      ),
    };
  });

// ============================================================
// REVENUE / ORDERS CHART
// ============================================================

export type AdminTimeRange =
  | 'today'
  | '7d'
  | '30d'
  | '90d';

export const getAdminRevenueChart = async (
  range: AdminTimeRange = '30d'
): Promise<AdminChartPoint[]> =>
  cached(`revenue-chart:${range}`, async () => {
    const dayCount =
      range === '7d'
        ? 7
        : range === '30d'
          ? 30
          : range === '90d'
            ? 90
            : 1;

    const from = daysAgo(
      dayCount - 1
    )
      .toISOString()
      .slice(0, 10);

    const { data, error } = await supabase
      .from('admin_revenue_daily')
      .select(
        'day, revenue, orders'
      )
      .gte('day', from)
      .order('day', {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return (data ?? []).map(row => ({
      label: dateLabel(
        `${row.day}T00:00:00`
      ),

      revenue: number(
        row.revenue
      ),

      orders: number(
        row.orders
      ),
    }));
  });

// ============================================================
// PRODUCTS
// ============================================================

export const getAdminProducts =
  async (): Promise<AdminProduct[]> =>
    cached('products:all', async () => {
            const { data, error } =
        await supabase
          .from('admin_products_view')
          .select('*')
          .eq('is_staged', false)
          .order('sales_count', {
            ascending: false,
          });

      if (error) {
        throw error;
      }

      return (data ?? []).map(row => ({
        id: row.id,

        name: row.name,

        price: number(
          row.price
        ),

        image: row.image,

        images:
          row.images?.length
            ? row.images
            : [row.image],

        category:
          row.category,

        status:
          row.status,

        stock:
          number(row.stock),

        views:
          number(row.views),

        carts:
          number(row.carts_count),

        sales:
          number(row.sales_count),

        conversionRate:
          number(
            row.conversion_rate
          ),

        position: {
          top:
            row.position_top,

          left:
            row.position_left,
        },

        mobilePosition:
          row.mobile_position_top != null &&
          row.mobile_position_left != null
            ? {
                top:
                  row.mobile_position_top,

                left:
                  row.mobile_position_left,
              }
            : undefined,

        rotation:
          number(row.rotation),

        scale:
          number(row.scale),

        zIndex:
          number(row.z_index),

        description:
          row.description ?? '',

        features:
          row.features ?? [],

                soldOut:
          Boolean(row.sold_out),

        showOnFloor:
          Boolean(row.show_on_floor ?? true),
      })) as AdminProduct[];
    });

// ============================================================
// PRODUCT MUTATIONS
// ============================================================

const createProductSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const productToDatabase = (
  product: AdminProduct
) => {
  const slug = createProductSlug(product.name);

  return {
    slug,

    name: product.name,

    price: number(product.price),

    image: product.image || '',

    images:
      product.images?.length
        ? product.images
        : product.image
          ? [product.image]
          : [],

    category: product.category,

    status: product.status,

    sold_out: Boolean(product.soldOut),

    position_top:
      product.position?.top ?? '0px',

    position_left:
      product.position?.left ?? '0%',

    mobile_position_top:
      product.mobilePosition?.top ?? null,

    mobile_position_left:
      product.mobilePosition?.left ?? null,

    rotation:
      number(product.rotation),

    scale:
      number(product.scale) || 1,

    z_index:
      number(product.zIndex) || 1,

    description:
      product.description?.trim() || null,

        features:
      product.features ?? [],

    show_on_floor:
      (product as AdminProductWithSizes).showOnFloor ?? true,

    // NOTE: `stock` is intentionally NOT sent here.

    // NOTE: `stock` is intentionally NOT sent here. products.stock is a
    // derived/denormalized column — the recalc_product_stock() trigger
    // (fires after insert/update/delete on product_inventory) is the
    // ONLY thing that should ever set it. Writing it directly here would
    // desync it from the real per-size inventory rows the moment
    // anything else touches product_inventory for this product.
  };
};

// ============================================================
// PER-SIZE INVENTORY SYNC
// ============================================================

// Canonical size list per category. This must match what the storefront
// actually offers customers (see ProductDetail.tsx) and what
// AdminProducts.tsx's editor collects into `sizeStocks`. Kept here as
// the single source of truth so the product_inventory rows this module
// writes are never out of step with what a size selector would show.
export type CategorySizesMap = Record<AdminProduct['category'], string[]>;

// Fallback ONLY — used if the category_sizes table is unreachable or
// unexpectedly empty. The DB (category_sizes table, seeded in the
// Phase 0 fix migration) is the single source of truth for size
// taxonomy from here on; this object is a safety net, never the
// primary source.
const FALLBACK_CATEGORY_SIZES: CategorySizesMap = {
  top: ['SMALL', 'MEDIUM', 'LARGE'],
  bottom: ['28', '30', '32', '34', '36'],
  accessory: ['ONE SIZE'],
};


export const markAbandonedCartRecovered = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('abandoned_carts')
    .update({ recovered: true, recovery_sent_at: new Date().toISOString() })
    .eq('id', id);
  if (error) { console.error('Failed to mark cart recovered:', error); throw error; }
  invalidateAdminCache('abandoned-carts:');
};

export const getAbandonedCartRecoveryRate = async (): Promise<number> =>
  cached('abandoned-carts:recovery-rate', async () => {
    const { count: total, error: totalErr } = await supabase
      .from('abandoned_carts').select('id', { count: 'exact', head: true });
    if (totalErr) throw totalErr;
    const { count: recovered, error: recErr } = await supabase
      .from('abandoned_carts').select('id', { count: 'exact', head: true }).eq('recovered', true);
    if (recErr) throw recErr;
    return total ? Math.round(((recovered ?? 0) / total) * 100) : 0;
  }, SLOW_TTL_MS);

// ============================================================
// ACTIVITY LOG HELPER
// ============================================================

const logAdminActivity = async (action: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('admin_activity_log')
    .insert({ actor_email: user?.email ?? 'system', action });
  
  if (error) {
    console.error('Failed to log admin activity:', error);
  }
  
  invalidateAdminCache('activity:');
};

// ============================================================
// CREATE PRODUCT WITH INVENTORY (RPC)
// ============================================================

export const createAdminProductWithInventory = async (
  product: AdminProductWithSizes
): Promise<AdminProductWithSizes> => {
  const { common, sizeStocks } = await buildProductRpcParams(product);

  const { data, error } = await supabase.rpc(
    'create_product_with_inventory',
    { ...common, p_size_stocks: sizeStocks }
  );

  if (error) {
    console.error('Failed to create product (RPC):', error);
    throw error;
  }

  invalidateAdminCache('products:');
  invalidateCache('product:');

  void logAdminActivity(`Created product "${product.name}"`);

  return mapRpcRowToProduct(data as Record<string, any>, product);
};

// ============================================================
// UPDATE PRODUCT WITH INVENTORY (RPC)
// ============================================================

export const updateAdminProductWithInventory = async (
  product: AdminProductWithSizes
): Promise<AdminProductWithSizes> => {
  const { common, sizeStocks } = await buildProductRpcParams(product);

  const { data, error } = await supabase.rpc(
    'update_product_with_inventory',
    { p_id: product.id, ...common, p_size_stocks: sizeStocks }
  );

  if (error) {
    console.error('Failed to update product (RPC):', error);
    throw error;
  }

  invalidateAdminCache('products:');
  invalidateCache('product:');

  void logAdminActivity(`Updated product "${product.name}"`);

  return mapRpcRowToProduct(data as Record<string, any>, product);
};

// ============================================================
// DELETE PRODUCT
// ============================================================

export const deleteAdminProduct = async (
  id: string,
  name?: string
): Promise<void> => {
  const { error } =
    await supabase
      .from('products')
      .delete()
      .eq('id', id);

  if (error) {
    console.error(
      'Failed to delete product:',
      error
    );

    throw error;
  }

  invalidateAdminCache('products:');
  invalidateCache('product:');

  void logAdminActivity(`Deleted product "${name ?? id}"`);
};

// ============================================================
// UPDATE PRODUCT STATUS
// ============================================================

export const updateAdminProductStatus = async (
  id: string,
  status: 'Active' | 'Hidden' | 'Sold Out',
  soldOut: boolean
): Promise<void> => {
  const { error } = await supabase
    .from('products')
    .update({
      status,
      sold_out: soldOut,
      force_sold_out: soldOut, // Aligned with the database flag
    })
    .eq('id', id);

  if (error) {
    console.error('Failed to update product status:', error);

    throw error;
  }

  invalidateAdminCache('products:');

  void logAdminActivity(`Product ${id} status changed to ${status}`);
};

// ============================================================
// CREATE DISCOUNT
// ============================================================

export const createAdminDiscount = async (
  discount: CreateDiscountInput
): Promise<AdminDiscount> => {
  const { data, error } = await supabase
    .from('discounts')
    .insert({
      code: discount.code.trim().toUpperCase(),
      type: discount.type,
      value: number(discount.value),
      min_order: number(discount.minOrder),
      usage_limit: discount.usageLimit ?? null,
      starts_at:
        discount.startsAt ||
        new Date().toISOString().slice(0, 10),
      ends_at: discount.endsAt || null,
      status: discount.status ?? 'Active',
      description: discount.description?.trim() || null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Failed to create discount:', error);
    throw error;
  }

  invalidateAdminCache('discounts:');

  void logAdminActivity(`Created discount code "${data.code}"`);

  return {
    id: data.id,
    code: data.code,
    type: data.type,
    value: number(data.value),
    start: data.starts_at,
    end: data.ends_at,
    usageLimit:
      data.usage_limit == null
        ? 0
        : number(data.usage_limit),
    used: number(data.used_count),
    status: data.status,
    minOrder: number(data.min_order),
  };
};

// ============================================================
// CREATE CAMPAIGN
// ============================================================

export const createAdminCampaign = async (
  campaign: CreateCampaignInput
): Promise<AdminCampaign> => {
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
  name: campaign.name.trim(),
  subject: campaign.subject?.trim() || null,
  audience: campaign.audience || 'All Customers',
  scheduled_at: campaign.scheduledAt || null,
  status: campaign.status ?? 'Draft',
  body_html: campaign.bodyHtml?.trim() || '',
})
    .select('*')
    .single();

  if (error) {
    console.error('Failed to create campaign:', error);
    throw error;
  }

  invalidateAdminCache('campaigns:');

  void logAdminActivity(`Created campaign "${data.name}"`);

  return {
    id: data.id,
    name: data.name,
    emailsSent: number(data.emails_sent),
    openRate: number(data.open_rate),
    clicks: number(data.clicks),
    orders: number(data.orders_count),
    revenue: number(data.revenue),
    status: data.status,
  };
};
  

export const sendCampaign = async (
  campaignId: string
): Promise<{ sent: number; total: number }> => {
  const { data, error } = await supabase.functions.invoke('send-campaign', {
    body: { campaignId },
  });

  if (error) {
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }

  invalidateAdminCache('campaigns:');

  return data as { sent: number; total: number };
};

/**
 * Loads the canonical size taxonomy from category_sizes. Cached with
 * SLOW_TTL_MS since this changes essentially never — an admin adding
 * a new size shows up within the cache window, same tradeoff as
 * discounts/campaigns/etc.
 */
export const getCategorySizes = async (): Promise<CategorySizesMap> =>
  cached(
    'category-sizes:all',
    async () => {
      const { data, error } = await supabase
        .from('category_sizes')
        .select('category, size, sort_order')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error(
          'Failed to load category sizes, using fallback taxonomy:',
          error
        );
        return FALLBACK_CATEGORY_SIZES;
      }

      const map: CategorySizesMap = { top: [], bottom: [], accessory: [] };

      for (const row of data ?? []) {
        const category = row.category as AdminProduct['category'];
        if (!map[category]) {
          map[category] = [];
        }
        map[category].push(row.size);
      }

      const isEmpty = Object.values(map).every(sizes => sizes.length === 0);

      return isEmpty ? FALLBACK_CATEGORY_SIZES : map;
    },
    SLOW_TTL_MS
  );

/**
 * Upserts one product_inventory row per size valid for the product's
 * category, and deletes any existing rows for sizes that are no longer
 * valid (e.g. the admin changed category from "top" to "accessory").
 *
 * Deliberately a no-op-safe helper: only called when the caller actually
 * supplies `sizeStocks`, so product updates that don't touch stock (e.g.
 * repositioning on the floor) never clobber existing inventory rows.
 */
const syncProductInventory = async (
  productId: string,
  category: AdminProduct['category'],
  sizeStocks: Record<string, number>
): Promise<void> => {
  const categorySizes = await getCategorySizes();
  const validSizes = categorySizes[category] ?? [];

  // Upsert every valid size explicitly, defaulting missing keys to 0
  // rather than skipping them. A missing row would look identical to
  // "this product doesn't come in this size" to any consumer reading
  // product_inventory — an explicit 0-available row correctly says
  // "carried, currently out of stock."
  const upsertRows = validSizes.map(size => ({
    product_id: productId,
    size,
    available: Math.max(0, number(sizeStocks[size])),
  }));

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase
      .from('product_inventory')
      .upsert(upsertRows, { onConflict: 'product_id,size' });

    if (upsertError) {
      console.error('Failed to sync product inventory:', upsertError);
      throw upsertError;
    }
  }

  // Remove rows for sizes no longer valid for this category. Fetched
  // then diffed in JS (rather than a raw PostgREST `not.in.(...)`
  // filter string) to avoid hand-quoting edge cases — e.g. "ONE SIZE"
  // contains a space, which is easy to get wrong in a manually built
  // filter string but trivial to compare correctly in JS.
  const { data: existingRows, error: existingError } = await supabase
    .from('product_inventory')
    .select('id, size')
    .eq('product_id', productId);

  if (existingError) {
    console.error(
      'Failed to read existing product inventory:',
      existingError
    );
    throw existingError;
  }

  const staleIds = (existingRows ?? [])
    .filter(row => !validSizes.includes(row.size))
    .map(row => row.id);

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('product_inventory')
      .delete()
      .in('id', staleIds);

    if (deleteError) {
      console.error(
        'Failed to delete stale product inventory rows:',
        deleteError
      );
      throw deleteError;
    }
  }

  // product_inventory changes ripple into: products.stock (via the
  // recalc trigger), inventory_history (via the Phase 0 log trigger on
  // UPDATE), and possibly admin_notifications (low-stock trigger).
  // Bust every cache that reads any of those.
  invalidateAdminCache('inventory:');
  invalidateAdminCache('inventory-history:');
  invalidateAdminCache('notifications:');
};

// ============================================================
// CREATE PRODUCT
// ============================================================

/**
 * A product is considered "unpositioned" if it still carries the sentinel
 * defaults set by AdminProducts.tsx's createEmptyProduct() — i.e. nobody
 * has manually dragged it in the Floor Manager or copied a real layout
 * onto it (e.g. via duplicate). Only unpositioned products get an
 * auto-assigned floor slot; anything with real coordinates is left alone.
 */

// ============================================================
// ATOMIC PRODUCT + INVENTORY (RPC-BACKED)
//
// Both create and update paths for a product MUST go through
// create_product_with_inventory / update_product_with_inventory —
// the atomic Phase 0 RPCs — never the legacy insert-then-
// syncProductInventory() two-step path below. That path is kept
// only for callers that don't have size data to write (if any
// remain); anything creating/duplicating/editing a product with
// stock must use these.
// ============================================================

export type AdminProductWithSizes = AdminProduct & {
  sizeStocks?: Record<string, number>;
  slug?: string;
};

const buildProductRpcParams = async (product: AdminProductWithSizes) => {
  const categorySizes = await getCategorySizes();

  const sizeStocks = Object.fromEntries(
    (categorySizes[product.category] ?? []).map(size => [
      size,
      Math.max(0, number(product.sizeStocks?.[size])),
    ])
  );

  const common = {
    p_slug:
      product.slug ??
      `${createProductSlug(product.name || 'product')}-${Date.now()
        .toString()
        .slice(-6)}`,
    p_name: product.name,
    p_price: number(product.price),
    p_image: product.image || '',
    p_images: product.images?.length
      ? product.images
      : product.image
        ? [product.image]
        : [],
    p_category: product.category,
    p_status: product.status,
    p_sold_out: Boolean(product.soldOut),
    p_position_top: product.position?.top ?? '0px',
    p_position_left: product.position?.left ?? '0%',
    p_mobile_position_top: product.mobilePosition?.top ?? null,
    p_mobile_position_left: product.mobilePosition?.left ?? null,
    p_rotation: number(product.rotation),
    p_scale: number(product.scale) || 1,
    p_z_index: number(product.zIndex) || 1,
        p_description: product.description?.trim() || null,
    p_features: product.features ?? [],
    p_show_on_floor: product.showOnFloor ?? true,
  };

  return { common, sizeStocks };
};

const mapRpcRowToProduct = (
  row: Record<string, any>,
  fallback: AdminProductWithSizes
): AdminProductWithSizes => {
  const returnedSizes = Array.isArray(row.sizes) ? row.sizes : [];

  const returnedSizeStocks: Record<string, number> = Object.fromEntries(
    returnedSizes
      .filter((entry: any) => entry && typeof entry.size === 'string')
      .map((entry: any) => [
        entry.size,
        Math.max(0, number(entry.available)),
      ])
  );

  return {
    ...fallback,
    id: String(row.id ?? fallback.id),
    slug: String(row.slug ?? fallback.slug ?? ''),
    name: String(row.name ?? fallback.name),
    price: number(row.price ?? fallback.price),
    image: String(row.image ?? fallback.image ?? ''),
    images: Array.isArray(row.images) ? row.images : fallback.images ?? [],
    category: row.category ?? fallback.category,
    status: row.status ?? fallback.status,
    stock: number(
      row.stock ??
        Object.values(returnedSizeStocks).reduce((sum, v) => sum + v, 0)
    ),
    position: {
      top: row.position_top ?? fallback.position?.top ?? '0px',
      left: row.position_left ?? fallback.position?.left ?? '0%',
    },
    mobilePosition:
      row.mobile_position_top != null && row.mobile_position_left != null
        ? { top: row.mobile_position_top, left: row.mobile_position_left }
        : fallback.mobilePosition,
    rotation: number(row.rotation ?? fallback.rotation),
    scale: number(row.scale ?? fallback.scale) || 1,
    zIndex: number(row.z_index ?? fallback.zIndex) || 1,
    description: row.description ?? fallback.description ?? '',
    features: Array.isArray(row.features)
      ? row.features
      : fallback.features ?? [],
        soldOut: Boolean(row.sold_out ?? fallback.soldOut),
    showOnFloor: Boolean(row.show_on_floor ?? fallback.showOnFloor ?? true),
    sizeStocks: returnedSizeStocks,
  };
};

/**
 * Atomic create — inserts the product AND its per-size inventory in one
 * transaction via create_product_with_inventory. This is the ONLY
 * correct create path; do not call the legacy insert + syncProductInventory
 * pair below for anything with size data (new products, duplicates).
 */


// ============================================================
// UPDATE PRODUCT
// ============================================================

export const updateAdminProduct = async (
  product: AdminProductWithSizes
): Promise<void> => {
  const payload =
    productToDatabase(product);

  const { error } =
    await supabase
      .from('products')
      .update(payload)
      .eq('id', product.id);

  if (error) {
    console.error(
      'Failed to update product:',
      error
    );

    throw error;
  }

  // Only touch inventory when the caller actually supplied size data —
  // this keeps unrelated updates (e.g. Floor Manager repositioning a
  // product) from wiping out existing stock levels.
  if (product.sizeStocks) {
    await syncProductInventory(
      product.id,
      product.category,
      product.sizeStocks
    );
  }

  invalidateAdminCache('products:');
  invalidateCache('product:');
};

// ============================================================
// ORDERS
// ============================================================

export const getAdminOrders = async (
  limit = 100
): Promise<AdminOrder[]> =>
  cached(`orders:${limit}`, async () => {
  const { data, error } =
    await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        user_id,
        customer_name,
        customer_email,
        customer_phone,
        subtotal,
        shipping,
        tax,
        total,
        payment_status,
        fulfillment_status,
        shipping_address,
        tracking_number,
        discount_code,
        created_at,
        order_items (
          id,
          product_id,
          product_name,
          size,
          color,
          quantity,
          unit_price
        )
      `)
      .order('created_at', {
        ascending: false,
      })
      .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(row => ({
    id:
      row.id,

    orderNumber:
      row.order_number ??
      row.id,

    customerName:
      row.customer_name,

    customerEmail:
      row.customer_email,

    date:
      row.created_at,

    total:
      number(row.total),

    paymentStatus:
      row.payment_status,

    fulfillmentStatus:
      row.fulfillment_status,

    items:
      (row.order_items ?? []).map(
        item => ({
          productId:
            item.product_id,

          name:
            item.product_name,

          size:
            item.size ?? '',

          quantity:
            number(item.quantity),

          price:
            number(item.unit_price),
        })
      ),

    shippingAddress:
      normaliseAddress(
        row.shipping_address
      ),

    subtotal:
      number(row.subtotal),

    shipping:
      number(row.shipping),

    trackingNumber:
      row.tracking_number ??
      undefined,
  })) as AdminOrder[];
  });


  // ============================================================
// ORDER STATUS COUNTS
// ============================================================

export interface AdminOrderStatusCounts {
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  pending: number;
}

const emptyOrderStatusCounts: AdminOrderStatusCounts = {
  processing: 0,
  shipped: 0,
  delivered: 0,
  cancelled: 0,
  pending: 0,
};

export const getAdminOrderStatusCounts =
  async (): Promise<AdminOrderStatusCounts> =>
    cached('order-status-counts:all', async () => {
      const { data, error } = await supabase
        .from('admin_order_status_counts')
        .select('fulfillment_status, count');

      if (error) {
        throw error;
      }

      const counts = { ...emptyOrderStatusCounts };

      for (const row of data ?? []) {
        const status = String(row.fulfillment_status ?? '').toLowerCase();
        const value = number(row.count);

        if (status === 'processing') counts.processing = value;
        else if (status === 'shipped') counts.shipped = value;
        else if (status === 'delivered') counts.delivered = value;
        else if (status === 'cancelled') counts.cancelled = value;
        else if (status === 'pending') counts.pending = value;
      }

      return counts;
    });

    // ============================================================
// PAYMENT STATUS COUNTS
// ============================================================

export interface AdminPaymentStatusCounts {
  paid: number;
  pending: number;
  refunded: number;
  failed: number;
}

const emptyPaymentStatusCounts: AdminPaymentStatusCounts = {
  paid: 0,
  pending: 0,
  refunded: 0,
  failed: 0,
};

export const getAdminPaymentStatusCounts =
  async (): Promise<AdminPaymentStatusCounts> =>
    cached('payment-status-counts:all', async () => {
      const { data, error } = await supabase
        .from('admin_payment_status_counts')
        .select('payment_status, count');

      if (error) {
        throw error;
      }

      const counts = { ...emptyPaymentStatusCounts };

      for (const row of data ?? []) {
        const status = String(row.payment_status ?? '').toLowerCase();
        const value = number(row.count);

        if (status === 'paid') counts.paid = value;
        else if (status === 'pending') counts.pending = value;
        else if (status === 'refunded') counts.refunded = value;
        else if (status === 'failed') counts.failed = value;
      }

      return counts;
    });

// ============================================================
// CREATE ORDER
// ============================================================

export interface CreateOrderPayload {
  userId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currencyCode?: string;
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  discountCode?: string;
  discountAmount?: number;
  idempotencyKey: string;
  notes?: string;
  paymentMethod?: string; // e.g. 'Credit Card', 'PayPal'

  // Notorious.Y2 doesn't currently have a real payment gateway —
  // Checkout.tsx's "processing" screen is a simulated delay, and by the
  // time completeOrder() runs, that simulated payment has already
  // "succeeded" from the customer's point of view. Defaulting to
  // Paid/Processing reflects that; pass overrides if a real gateway is
  // wired up later and payment can genuinely still be pending here.
  paymentStatus?: 'Paid' | 'Pending' | 'Refunded' | 'Failed';
  fulfillmentStatus?:
    | 'Processing'
    | 'Shipped'
    | 'Delivered'
    | 'Cancelled'
    | 'Pending';
}

export interface CreateOrderItemInput {
  productId: string | null;
  productName: string;
  size?: string;
  color?: string;
  quantity: number;
  unitPrice: number;
}

export const createOrder = async (
  orderPayload: CreateOrderPayload,
  items: CreateOrderItemInput[]
): Promise<{ id: string; orderNumber: string }> => {
  if (items.length === 0) {
    throw new Error('Cannot create an order with no items.');
  }

  const { data, error } = await supabase.rpc('create_order_with_items', {
    p_user_id: orderPayload.userId,
    p_idempotency_key: orderPayload.idempotencyKey,
    p_customer_name: orderPayload.customerName,
    p_customer_email: orderPayload.customerEmail,
    p_customer_phone: orderPayload.customerPhone ?? null,
    p_currency_code: orderPayload.currencyCode ?? 'ZAR',
    p_shipping_address: orderPayload.shippingAddress ?? null,
    p_billing_address: orderPayload.billingAddress ?? null,
    p_discount_code: orderPayload.discountCode ?? null,
    p_payment_method: orderPayload.paymentMethod ?? 'Credit Card',
    p_items: items.map(i => ({
      product_id: i.productId,
      product_name: i.productName,
      size: i.size ?? null,
      color: i.color ?? null,
      quantity: i.quantity,
    })),
  });

  if (error) {
    console.error('Failed to create order via RPC:', error);
    throw error;
  }

  // A new order ripples into KPIs, lists, sales counts, inventory, and notifications.
  // Bust everything downstream.
  invalidateAdminCache('kpis');
  invalidateAdminCache('orders:');
  invalidateAdminCache('order-status-counts:');
  invalidateAdminCache('payment-status-counts:');
  invalidateAdminCache('overview:');
  invalidateAdminCache('analytics:');
  invalidateAdminCache('revenue-chart:');
  invalidateAdminCache('revenue-by-');
  invalidateAdminCache('finance:');
  invalidateAdminCache('inventory:');
  invalidateAdminCache('inventory-history:');
  invalidateAdminCache('products:');
  invalidateAdminCache('customers:');
  invalidateAdminCache('notifications:');
  invalidateAdminCache('discounts:');

  return {
    id: data.id,
    orderNumber: data.order_number,
  };
};
// ============================================================
// UPDATE ORDER STATUS
// ============================================================

export interface UpdateOrderStatusInput {
  fulfillmentStatus?:
    | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Pending';
  paymentStatus?: 'Paid' | 'Pending' | 'Refunded' | 'Failed'; // ADD THIS
  trackingNumber?: string;
}

export const updateOrderStatus = async (
  orderId: string,
  updates: UpdateOrderStatusInput
): Promise<void> => {
  const payload: Record<string, unknown> = {};

  if (updates.fulfillmentStatus !== undefined) {
    payload.fulfillment_status = updates.fulfillmentStatus;
  }

  if (updates.paymentStatus !== undefined) {          // ADD THIS BLOCK
    payload.payment_status = updates.paymentStatus;
  }

  if (updates.trackingNumber !== undefined) {
    payload.tracking_number = updates.trackingNumber;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const { error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', orderId);

  if (error) {
    console.error('Failed to update order status:', error);
    throw error;
  }

  // A fulfillment_status change fires log_order_status_change, which
  // populates admin_activity_log — bust that alongside the order lists
  // that display the new status.
  invalidateAdminCache('orders:');
  invalidateAdminCache('overview:');
  invalidateAdminCache('activity:');
  invalidateAdminCache('order-status-counts:');
  invalidateAdminCache('payment-status-counts:');
};

// ============================================================
// CUSTOMERS
// ============================================================

export const getAdminCustomers =
  async (): Promise<AdminCustomer[]> =>
    cached('customers:all', async () => {
      const { data, error } =
        await supabase
          .from('admin_customers_view')
          .select('*')
          .order('total_spent', {
            ascending: false,
          });

      if (error) {
        throw error;
      }

      return (data ?? []).map(row => ({
        id:
          row.user_id,

        name:
          row.name,

        email:
          row.email,

        orders:
          number(row.orders),

        totalSpent:
          number(row.total_spent),

        lastOrder:
          row.last_order ??
          undefined,

        firstPurchase:
          row.first_purchase ??
          undefined,

        status:
          row.status,

        averageOrder:
          number(
            row.average_order
          ),
      })) as AdminCustomer[];
    });

// ============================================================
// INVENTORY
// ============================================================

export const getAdminInventory =
  async (): Promise<AdminInventoryItem[]> =>
    cached(
      'inventory:all',
      async () => {
        const { data, error } = await supabase
          .from('admin_inventory_view')
          .select('*');

        if (error) {
          throw error;
        }

        return (data ?? []).map(row => ({
          productId: row.product_id,
          name: row.name,
          sku: row.sku,
          sizes: (row.sizes ?? []).map((s: any) => ({
            size: s.size,
            available: number(s.available),
            reserved: number(s.reserved),
            sold: number(s.sold),
          })),
          totalAvailable: number(row.total_available),
          status: row.status,
        })) as AdminInventoryItem[];
      },
      SLOW_TTL_MS
    );

// ============================================================
// INVENTORY HISTORY
// ============================================================

export const getAdminInventoryHistory =
  async (
    limit = 100
  ): Promise<AdminInventoryHistory[]> =>
    cached(`inventory-history:${limit}`, async () => {
      const { data, error } =
        await supabase
          .from('inventory_history')
          .select(`
            id,
            product_id,
            size,
            change,
            reason,
            created_at,
            products (
              name
            )
          `)
          .order('created_at', {
            ascending: false,
          })
          .limit(limit);

      if (error) {
        throw error;
      }

      return (data ?? []).map(row => ({
        id:
          row.id,

        productId:
          row.product_id,

        productName:
          row.products?.[0]?.name ??
          'Unknown Product',

        date:
          row.created_at,

        change:
          number(row.change),

        reason:
          row.reason ??
          'Inventory adjustment',
      })) as AdminInventoryHistory[];
    });

// ============================================================
// ACTIVITY LOG
// ============================================================

export const getAdminActivity =
  async (
    limit = 100
  ): Promise<AdminActivity[]> =>
    cached(`activity:${limit}`, async () => {
      const { data, error } =
        await supabase
          .from('admin_activity_log')
          .select(`
            id,
            actor_email,
            action,
            created_at
          `)
          .order('created_at', {
            ascending: false,
          })
          .limit(limit);

      if (error) {
        throw error;
      }

      return (data ?? []).map(row => ({
        id:
          row.id,

        time:
          dateTimeLabel(
            row.created_at
          ),

        action:
          row.action,

        user:
          row.actor_email ??
          'system',
      })) as AdminActivity[];
    });

// ============================================================
// DISCOUNTS
// ============================================================

export const getAdminDiscounts =
  async (): Promise<AdminDiscount[]> =>
    cached(
      'discounts:all',
      async () => {
        const { data, error } =
          await supabase
            .from('discounts')
            .select(`
              id,
              code,
              type,
              value,
              starts_at,
              ends_at,
              usage_limit,
              used_count,
              status,
              min_order
            `)
            .order('created_at', {
              ascending: false,
            });

        if (error) {
          throw error;
        }

        return (data ?? []).map(row => ({
          id: row.id,
          code: row.code,
          type: row.type,
          value: number(row.value),
          start: row.starts_at,
          end: row.ends_at,
          usageLimit:
            row.usage_limit == null
              ? 0
              : number(row.usage_limit),
          used: number(row.used_count),
          status: row.status,
          minOrder: number(row.min_order),
        })) as AdminDiscount[];
      },
      SLOW_TTL_MS
    );

// ============================================================
// CREATE DISCOUNT
// ============================================================

export interface CreateDiscountInput {
  code: string;
  type: 'Percentage' | 'Fixed' | 'Free Shipping';
  value: number;
  minOrder?: number;
  usageLimit?: number;
  startsAt?: string;
  endsAt?: string;
  status?: 'Active' | 'Scheduled' | 'Expired';
  description?: string;
}


// ============================================================
// CAMPAIGNS
// ============================================================

export const getAdminCampaigns =
  async (): Promise<AdminCampaign[]> =>
    cached(
      'campaigns:all',
      async () => {
        const { data, error } =
          await supabase
            .from('campaigns')
            .select(`
              id,
              name,
              emails_sent,
              open_rate,
              clicks,
              orders_count,
              revenue,
              status
            `)
            .order('created_at', {
              ascending: false,
            });

        if (error) {
          throw error;
        }

        return (data ?? []).map(row => ({
          id: row.id,
          name: row.name,
          emailsSent: number(row.emails_sent),
          openRate: number(row.open_rate),
          clicks: number(row.clicks),
          orders: number(row.orders_count),
          revenue: number(row.revenue),
          status: row.status,
        })) as AdminCampaign[];
      },
      SLOW_TTL_MS
    );

// ============================================================
// CREATE CAMPAIGN
// ============================================================

export interface CreateCampaignInput {
  name: string;
  subject?: string;
  audience?: string;
  scheduledAt?: string;
  status?: 'Draft' | 'Active' | 'Completed';
  bodyHtml?: string;
}

// ============================================================
// ABANDONED CARTS
// ============================================================

export const getAdminAbandonedCarts =
  async (): Promise<AdminAbandonedCart[]> =>
    cached(
      'abandoned-carts:all',
      async () => {
        const { data, error } =
          await supabase
            .from('abandoned_carts')
            .select(`
              id,
              customer_email,
              cart_value,
              abandoned_at
            `)
            .eq('recovered', false)
            .order('abandoned_at', {
              ascending: false,
            });

        if (error) {
          throw error;
        }

        return (data ?? []).map(row => ({
          id: row.id,
          customerEmail: row.customer_email,
          cartValue: number(row.cart_value),
          abandonedTime: new Date(
            row.abandoned_at
          ).toLocaleString('en-ZA', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
        })) as AdminAbandonedCart[];
      },
      SLOW_TTL_MS
    );

// ============================================================
// ADMIN USERS
// ============================================================

export const inviteAdminUser = async (
  name: string,
  email: string,
  role: 'Admin' | 'Manager' | 'Support' | 'Analyst' | 'Viewer'
): Promise<void> => {
  const normalizedEmail = email.trim().toLowerCase();

  const { error } = await supabase.rpc('invite_admin_user', {
    p_email: normalizedEmail,
    p_role: role,
  });

  if (error) {
    console.error('Failed to invite admin user:', error);
    throw error;
  }

  invalidateAdminCache('users:');
  void logAdminActivity(`Invited ${name || normalizedEmail} (${normalizedEmail}) as ${role}`);
};

export const getAdminUsers =
  async (): Promise<AdminAdminUser[]> =>
    cached(
      'users:admins',
      async () => {
        const { data, error } =
          await supabase
            .from('profiles')
            .select(`
              id,
              name,
              email,
              admin_role,
              admin_permissions,
              last_active_at,
              admin_status,
              is_admin
            `)
            .eq('is_admin', true)
            .order('name');

        if (error) {
          throw error;
        }

        return (data ?? []).map(row => ({
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.admin_role,
          permissions: row.admin_permissions ?? [],
          lastActive: row.last_active_at
            ? dateTimeLabel(row.last_active_at)
            : 'Never',
          status: row.admin_status,
        })) as AdminAdminUser[];
      },
      SLOW_TTL_MS
    );

// ============================================================
// FINANCE
// ============================================================

export const getAdminFinance =
  async (): Promise<AdminFinance> =>
    cached('finance:overview', async () => {
    const [
      ordersResult,
      returnsResult,
    ] = await Promise.all([
      supabase
        .from('orders')
        .select(`
          total,
          tax,
          shipping
        `)
        .eq(
          'payment_status',
          'Paid'
        ),

      supabase
        .from('returns')
        .select(`
          refund_amount
        `),
    ]);

    if (ordersResult.error) {
      throw ordersResult.error;
    }

    if (returnsResult.error) {
      throw returnsResult.error;
    }

    const orders =
      ordersResult.data ?? [];

    const grossRevenue =
      orders.reduce(
        (sum, order) =>
          sum +
          number(order.total),
        0
      );

    const taxes =
      orders.reduce(
        (sum, order) =>
          sum +
          number(order.tax),
        0
      );

    const shippingCosts =
      orders.reduce(
        (sum, order) =>
          sum +
          number(order.shipping),
        0
      );

    const refunds =
      (
        returnsResult.data ?? []
      ).reduce(
        (sum, item) =>
          sum +
          number(
            item.refund_amount
          ),
        0
      );

    const netRevenue =
      grossRevenue -
      refunds;

    const [feesResult, discountResult] = await Promise.all([
  supabase.from('payment_transactions').select('fee').eq('type', 'Sale').eq('status', 'Completed'),
  supabase.from('orders').select('discount_amount').gt('discount_amount', 0).eq('payment_status', 'Paid'),
]);
const processingFees = (feesResult.data ?? []).reduce((s, r) => s + number(r.fee), 0);
const discounts = (discountResult.data ?? []).reduce((s, r) => s + number(r.discount_amount), 0);
    const profit =
      netRevenue -
      taxes -
      shippingCosts -
      processingFees -
      discounts;

    return {
      grossRevenue,
      netRevenue,
      refunds,
      taxes,
      shippingCosts,
      processingFees,
      discounts,
      profit,
    };
    });

// ============================================================
// REVENUE BY CATEGORY
// ============================================================

export const getAdminRevenueByCategory =
  async (): Promise<AdminRevenueCategory[]> =>
    cached('revenue-by-category', async () => {
      const { data, error } = await supabase
        .from('revenue_by_category')
        .select('category, revenue, percentage');

      if (error) {
        throw error;
      }

      return (data ?? []).map(row => ({
        category: String(row.category ?? 'Other'),
        revenue: number(row.revenue),
        percentage: number(row.percentage),
      }));
    });

// ============================================================
// REVENUE BY COUNTRY
// ============================================================

export const getAdminRevenueByCountry =
  async (): Promise<AdminRevenueCountry[]> =>
    cached('revenue-by-country', async () => {
      const { data, error } = await supabase
        .from('revenue_by_country')
        .select('country, revenue, percentage');

      if (error) {
        throw error;
      }

      return (data ?? []).map(row => ({
        country: String(row.country ?? 'Unknown'),
        revenue: number(row.revenue),
        percentage: number(row.percentage),
      }));
    });

// ============================================================
// REVENUE BY PAYMENT METHOD
// ============================================================

export const getAdminRevenueByPayment =
  async (): Promise<AdminRevenuePayment[]> =>
    cached('revenue-by-payment', async () => {
      const { data, error } = await supabase
        .from('revenue_by_payment')
        .select('method, revenue, percentage');

      if (error) {
        throw error;
      }

      return (data ?? []).map(row => ({
        method: String(row.method ?? 'Unknown'),
        revenue: number(row.revenue),
        percentage: number(row.percentage),
      }));
    });

// ============================================================
// NOTIFICATIONS
// ============================================================

export interface AdminNotification {
  id: string;
  title: string;
  description: string | null;
  type:
    | 'order'
    | 'stock'
    | 'customer'
    | 'system';
  read: boolean;
  createdAt: string;
}

export const getAdminNotifications =
  async (
    limit = 30
  ): Promise<AdminNotification[]> =>
    cached(`notifications:${limit}`, async () => {
      const { data, error } =
        await supabase
          .from(
            'admin_notifications'
          )
          .select(`
            id,
            title,
            description,
            type,
            read,
            created_at
          `)
          .order(
            'created_at',
            {
              ascending: false,
            }
          )
          .limit(limit);

      if (error) {
        throw error;
      }

      return (data ?? []).map(
        row => ({
          id:
            row.id,

          title:
            row.title,

          description:
            row.description,

          type:
            row.type,

          read:
            Boolean(
              row.read
            ),

          createdAt:
            row.created_at,
        })
      );
    });

export const markAdminNotificationRead =
  async (
    id: string
  ): Promise<void> => {
    const { error } =
      await supabase
        .from(
          'admin_notifications'
        )
        .update({
          read: true,
        })
        .eq(
          'id',
          id
        );

    if (error) {
      throw error;
    }

    invalidateAdminCache('notifications:');
  };

export const markAllAdminNotificationsRead =
  async (): Promise<void> => {
    const { error } =
      await supabase
        .from(
          'admin_notifications'
        )
        .update({
          read: true,
        })
        .eq(
          'read',
          false
        );

    if (error) {
      throw error;
    }

    invalidateAdminCache('notifications:');
  };

export const deleteAdminNotification = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('admin_notifications')
    .delete()
    .eq('id', id);

  if (error) throw error;

  invalidateAdminCache('notifications:');
};

export const clearAllAdminNotifications = async (): Promise<void> => {
  const { error } = await supabase
    .from('admin_notifications')
    .delete()
    .not('id', 'is', null); // delete everything

  if (error) throw error;

  invalidateAdminCache('notifications:');
};

// ============================================================
// OVERVIEW DATA
// ============================================================

export const getAdminOverviewData =
  async (
    range: AdminTimeRange = '30d'
  ) =>
    cached(`overview:${range}`, async () => {
      const [
        kpis,
        revenueChart,
        products,
        orders,
        inventory,
      ] = await Promise.all([
        getAdminKPIs(),

        getAdminRevenueChart(
          range
        ),

        getAdminProducts(),

        getAdminOrders(5),

        getAdminInventory(),
      ]);

      return {
        kpis,
        revenueChart,
        products,
        orders,
        inventory,
      };
    });

// src/data/admin.ts (uploadProductImage update)

export const uploadProductImage = async (
  file: File,
  removeBackground = true,
  onBackgroundRemoved?: (url: string) => void
): Promise<string> => {
  const fileExt = file.name.split('.').pop() ?? 'jpg';
  const filePath = `${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    console.error('Failed to upload product image:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
  const publicUrl = data.publicUrl;

  // Runs server-side now, after the raw image is already visible —
  // never blocks the upload UI.
  if (removeBackground) {
    import('../lib/removeBackground')
      .then(({ removeBackgroundOnServer }) =>
        removeBackgroundOnServer('product-images', filePath)
      )
      .then(processedUrl => onBackgroundRemoved?.(processedUrl))
      .catch(err => console.error('Background removal failed, keeping original image:', err));
  }

  return publicUrl;
};

// ============================================================
// ANALYTICS DATA
// ============================================================

export const getAdminAnalyticsData =
  async (
    range: AdminTimeRange = '30d'
  ) =>
    cached(`analytics:${range}`, async () => {
      const [
        kpis,
        revenueChart,
        products,
        revenueByCategory,
        revenueByPayment,
        revenueByCountry,
      ] = await Promise.all([
        getAdminKPIs(),

        getAdminRevenueChart(
          range
        ),

        getAdminProducts(),

        getAdminRevenueByCategory(),

        getAdminRevenueByPayment(),

        getAdminRevenueByCountry(),
      ]);

      return {
        kpis,
        revenueChart,
        products,
        revenueByCategory,
        revenueByPayment,
        revenueByCountry,
      };
    });

export interface CarrierShipment {
  orderId: string;
  carrier: string | null;
  trackingNumber: string | null;
  status: string | null;
  estimatedDelivery: string | null;
  lastCheckedAt: string | null;
  events: { label: string; timestamp: string }[];
}

export const getCarrierShipment = async (orderId: string): Promise<CarrierShipment | null> => {
  const { data, error } = await supabase
    .from('carrier_shipments')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load carrier shipment:', error);
    return null;
  }
  if (!data) return null;

  return {
    orderId: data.order_id,
    carrier: data.carrier,
    trackingNumber: data.tracking_number,
    status: data.status,
    estimatedDelivery: data.estimated_delivery,
    lastCheckedAt: data.last_checked_at,
    events: data.events ?? [],
  };
};

export const refreshCarrierShipment = async (orderId: string): Promise<CarrierShipment> => {
  const { data, error } = await supabase.functions.invoke('track-shipment', {
    body: { orderId },
  });
  if (error) throw error;
  return data as CarrierShipment;
};

export const claimGuestOrder = async (orderId: string, userEmail: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('orders')
    .update({ user_id: user.id })
    .eq('id', orderId)
    .eq('customer_email', userEmail)
    .is('user_id', null);
  if (error) console.error('Failed to claim guest order:', error);
};