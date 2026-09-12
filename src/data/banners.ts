// src/data/banners.ts
//
// Data-access layer for banners + the products they link to
// (banner_products, added in the Phase 0 migration). Split into three
// concerns:
//
//   1. Storefront reads — getStorefrontBanners(). Cached via the SAME
//      shared lib/requestCache.ts that hooks/useProducts.ts uses (not
//      lib/adminCache.ts) — banners are public storefront content, not
//      admin-only data, same reasoning as data/storeSettings.ts.
//
//   2. Click/impression counters — thin RPC wrappers. These deliberately
//      NEVER do a direct `.update()` on `banners` from the client: the
//      banners RLS policies only grant UPDATE to admins
//      (banners_admin_update), so an anonymous visitor's browser has no
//      permission to increment banners.clicks/impressions directly. The
//      two increment_banner_click / increment_banner_impression()
//      Postgres functions (Phase 0, SECURITY DEFINER, granted to
//      anon/authenticated) are the only path a visitor can use.
//
//   3. Admin CRUD — mirrors data/admin.ts's product mutation pattern:
//      plain inserts/updates against the `banners` table (RLS admin-only
//      write policies already exist), plus a delete-then-insert sync of
//      `banner_products` so a banner's linked product set always exactly
//      matches what was submitted.

import { supabase } from '../lib/supabase';
import { cached, invalidateCache } from '../lib/requestCache';
import { cached as cachedAdmin, invalidateAdminCache } from '../lib/adminCache';
import { Product } from '../types/Product';
import { mapRowToProduct, ProductRow } from '../lib/mapProduct';
import { getNextAvailableFloorSlot } from './floorLayout';

// ============================================================
// HELPERS
// ============================================================

const number = (value: unknown): number => Number(value ?? 0);

export type BannerPosition = 'Top' | 'Middle' | 'Bottom';
export type BannerStatus = 'Active' | 'Scheduled';

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
// STOREFRONT READ
// ============================================================

export interface StorefrontBanner {
  id: string;
  title: string;
  image: string;
  position: BannerPosition;
  products: Product[];
  productIds: string[];
}

// Row shape for the nested banner_products -> products(*) join.
interface BannerProductJoinRow {
  position: number;
  products: ProductRow;
}

interface StorefrontBannerRow {
  id: string;
  title: string;
  image: string;
  position: BannerPosition;
  status: BannerStatus;
  banner_products: BannerProductJoinRow[];
}

const STOREFRONT_BANNERS_CACHE_KEY = 'banners:storefront';

// Same 2-minute-ish order of magnitude as products.ts's cache — banners
// change about as often as products do (an admin editing content), and
// every admin write below explicitly invalidates this key anyway, so a
// generous TTL only matters for the "nobody touched anything" case.
const STOREFRONT_BANNERS_TTL_MS = 2 * 60_000;

const fetchStorefrontBanners = async (): Promise<StorefrontBanner[]> => {
  const { data, error } = await supabase
    .from('banners')
    .select(
      `
        id,
        title,
        image,
        position,
        status,
        banner_products (
          position,
          products (
  id,
  slug,
  name,
  price,
  image,
  images,
  category,
  sold_out
)
        )
      `
    )
    .eq('status', 'Active')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as StorefrontBannerRow[]).map(row => {
    const products = [...row.banner_products]
      .sort((a, b) => a.position - b.position)
      .map(link => mapRowToProduct(link.products));

    return {
      id: row.id,
      title: row.title,
      image: row.image,
      position: row.position,
      products,
      productIds: [...row.banner_products]
        .sort((a, b) => a.position - b.position)
        .map(link => link.products.id),
    };
  });
};

/**
 * Active banners with their linked products, ready for the storefront
 * (PromoBanner / BannerCollection). Cached — call after an admin write
 * invalidates 'banners:storefront' (see createAdminBanner /
 * updateAdminBanner / deleteAdminBanner below) to see fresh content.
 */
export const getStorefrontBanners = async (): Promise<StorefrontBanner[]> =>
  cached(STOREFRONT_BANNERS_CACHE_KEY, fetchStorefrontBanners, STOREFRONT_BANNERS_TTL_MS);

// ============================================================
// CLICK / IMPRESSION COUNTERS
// ============================================================

/**
 * Increments banners.clicks via the increment_banner_click() RPC
 * (Phase 0 migration). Fire-and-forget from the caller's point of
 * view — logs on failure rather than throwing, since a failed click
 * count should never block the banner's actual navigation behavior.
 */
export const incrementBannerClick = async (bannerId: string): Promise<void> => {
  const { error } = await supabase.rpc('increment_banner_click', {
    p_banner_id: bannerId,
  });

  if (error) {
    console.error('Failed to record banner click:', error);
  }
};

/**
 * Increments banners.impressions via the increment_banner_impression()
 * RPC (Phase 0 migration). Same fire-and-forget contract as
 * incrementBannerClick — a missed impression count is not worth
 * surfacing an error to the visitor over.
 */
export const incrementBannerImpression = async (bannerId: string): Promise<void> => {
  const { error } = await supabase.rpc('increment_banner_impression', {
    p_banner_id: bannerId,
  });

  if (error) {
    console.error('Failed to record banner impression:', error);
  }
};

// ============================================================
// ============================================================
// ADMIN: READ
// ============================================================

export interface AdminStagedProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  images: string[];
  category: 'top' | 'bottom' | 'accessory';
  description: string;
  features: string[];
  stock: number;
  sizeStocks: Record<string, number>;
}

export interface AdminBanner {
  id: string;
  title: string;
  image: string;
  position: BannerPosition;
  status: BannerStatus;
  clicks: number;
  impressions: number;
  // Full staged-product objects for this banner. A banner now ONLY
  // ever links products created inline for it (via
  // createStagedBannerProduct) — never existing catalog products.
  // Once a staged product is promoted, it's removed from here.
  stagedProducts: AdminStagedProduct[];
}

interface AdminBannerProductJoinRow {
  position: number;
  products: ProductRow;
}

interface AdminBannerRow {
  id: string;
  title: string;
  image: string;
  position: BannerPosition;
  status: BannerStatus;
  clicks: number;
  impressions: number;
  banner_products: AdminBannerProductJoinRow[];
}

const ADMIN_BANNERS_CACHE_KEY = 'banners:admin';

const mapStagedProductFromRow = (row: ProductRow): AdminStagedProduct => {
  const sizeStocks = Object.fromEntries(
    (row.product_inventory ?? []).map(inv => [inv.size, Number(inv.available)])
  );

  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    image: row.image,
    images: row.images?.length ? row.images : [row.image],
    category: row.category,
    description: row.description ?? '',
    features: row.features ?? [],
    stock: Object.values(sizeStocks).reduce((sum, value) => sum + value, 0),
    sizeStocks,
  };
};

const fetchAdminBanners = async (): Promise<AdminBanner[]> => {
  const { data, error } = await supabase
    .from('banners')
    .select(
      `
        id,
        title,
        image,
        position,
        status,
        clicks,
        impressions,
        banner_products (
          position,
          products (
            *,
            product_inventory (
              size,
              available
            )
          )
        )
      `
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as AdminBannerRow[]).map(row => ({
    id: row.id,
    title: row.title,
    image: row.image,
    position: row.position,
    status: row.status,
    clicks: number(row.clicks),
    impressions: number(row.impressions),
    stagedProducts: [...row.banner_products]
      .sort((a, b) => a.position - b.position)
      .map(link => mapStagedProductFromRow(link.products)),
  }));
};

/**
 * All banners for the admin Content manager, each carrying its full
 * staged-product objects. Cached via adminCache — invalidated by every
 * admin write in this file.
 */
export const getAdminBanners = async (): Promise<AdminBanner[]> =>
  cachedAdmin(ADMIN_BANNERS_CACHE_KEY, fetchAdminBanners);

// Both caches that could hold stale banner data.
const invalidateAllBannerCaches = (): void => {
  invalidateAdminCache('banners:');
  invalidateCache(STOREFRONT_BANNERS_CACHE_KEY);
};

// ============================================================
// ADMIN: BANNER CREATE / UPDATE / DELETE
//
// Banners themselves no longer carry a "linked existing products"
// concept at all — see AdminStagedProduct / createStagedBannerProduct
// below for how products get attached to a banner now.
// ============================================================

export interface BannerInput {
  title: string;
  image: string;
  position: BannerPosition;
  status?: BannerStatus;
}

export const createAdminBanner = async (
  banner: BannerInput
): Promise<AdminBanner> => {
  const { data, error } = await supabase
    .from('banners')
    .insert({
      title: banner.title.trim(),
      image: banner.image,
      position: banner.position,
      status: banner.status ?? 'Active',
    })
    .select('*')
    .single();

  if (error) {
    console.error('Failed to create banner:', error);
    throw error;
  }

  invalidateAllBannerCaches();

  void logAdminActivity(`Created banner "${data.title}"`);

  return {
    id: data.id,
    title: data.title,
    image: data.image,
    position: data.position,
    status: data.status,
    clicks: number(data.clicks),
    impressions: number(data.impressions),
    stagedProducts: [],
  };
};

export const updateAdminBanner = async (banner: AdminBanner): Promise<void> => {
  const { error } = await supabase
    .from('banners')
    .update({
      title: banner.title.trim(),
      image: banner.image,
      position: banner.position,
      status: banner.status,
    })
    .eq('id', banner.id);

  if (error) {
    console.error('Failed to update banner:', error);
    throw error;
  }

  invalidateAllBannerCaches();

  void logAdminActivity(`Updated banner "${banner.title}"`);
};

export const deleteAdminBanner = async (id: string, title?: string): Promise<void> => {
  let bannerTitle = title;
  if (!bannerTitle) {
    const { data: bannerData } = await supabase
      .from('banners')
      .select('title')
      .eq('id', id)
      .maybeSingle();
    bannerTitle = bannerData?.title;
  }

  // Staged products only exist to be tested inside the one banner they
  // were created under. If the banner is deleted without cleaning
  // these up, they'd become permanently orphaned — invisible on the
  // floor, invisible in the catalog, invisible everywhere. Already-
  // promoted products are never touched here: promotion already
  // removed their banner_products link.
  const { data: staged, error: stagedError } = await supabase
    .from('banner_products')
    .select('products!inner(id, is_staged)')
    .eq('banner_id', id)
    .eq('products.is_staged', true);

  if (stagedError) {
    console.error('Failed to look up staged products for banner:', stagedError);
    throw stagedError;
  }

  const stagedIds = (staged ?? []).map((row: any) => row.products.id as string);

  if (stagedIds.length > 0) {
    const { error: deleteStagedError } = await supabase
      .from('products')
      .delete()
      .in('id', stagedIds);

    if (deleteStagedError) {
      console.error('Failed to delete staged products for banner:', deleteStagedError);
      throw deleteStagedError;
    }
  }

  const { error } = await supabase.from('banners').delete().eq('id', id);

  if (error) {
    console.error('Failed to delete banner:', error);
    throw error;
  }

  invalidateAllBannerCaches();
  invalidateAdminCache('products:');

  void logAdminActivity(`Deleted banner "${bannerTitle ?? id}"`);
};

// ============================================================
// ADMIN: STAGED PRODUCT CRUD (create-inline, no catalog picker)
// ============================================================

export interface StagedProductInput {
  name: string;
  price: number;
  image: string;
  images: string[];
  category: 'top' | 'bottom' | 'accessory';
  description?: string;
  features?: string[];
  sizeStocks: Record<string, number>;
}

interface StagedProductRpcResult {
  id: string;
  name: string;
  price: number | string;
  image: string;
  images: string[];
  category: 'top' | 'bottom' | 'accessory';
  description: string | null;
  features: string[];
  sizes?: { size: string; available: number }[];
}

const mapStagedProductFromRpc = (row: StagedProductRpcResult): AdminStagedProduct => {
  const sizeStocks = Object.fromEntries(
    (row.sizes ?? []).map(entry => [entry.size, Number(entry.available)])
  );

  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    image: row.image,
    images: row.images?.length ? row.images : [row.image],
    category: row.category,
    description: row.description ?? '',
    features: row.features ?? [],
    stock: Object.values(sizeStocks).reduce((sum, value) => sum + value, 0),
    sizeStocks,
  };
};

const createStagedProductSlug = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Creates a brand-new product scoped to one banner. This is the ONLY
 * way products get attached to a banner now — there is no "pick from
 * existing catalog" path anymore. The product is invisible everywhere
 * except that banner's storefront collection until promoted.
 */
export const createStagedBannerProduct = async (
  bannerId: string,
  input: StagedProductInput,
  position: number
): Promise<AdminStagedProduct> => {
  const slug = `${createStagedProductSlug(input.name || 'staged-product')}-${Date.now()
    .toString()
    .slice(-6)}`;

  const { data, error } = await supabase.rpc('create_staged_banner_product', {
    p_banner_id: bannerId,
    p_slug: slug,
    p_name: input.name,
    p_price: number(input.price),
    p_image: input.image || input.images[0] || '',
    p_images: input.images?.length ? input.images : input.image ? [input.image] : [],
    p_category: input.category,
    p_description: input.description?.trim() || null,
    p_features: input.features ?? [],
    p_size_stocks: input.sizeStocks,
    p_position: position,
  });

  if (error) {
    console.error('Failed to create staged product:', error);
    throw error;
  }

  invalidateAllBannerCaches();
  invalidateAdminCache('products:');

  return mapStagedProductFromRpc(data as StagedProductRpcResult);
};

export const updateStagedBannerProduct = async (
  productId: string,
  input: StagedProductInput
): Promise<AdminStagedProduct> => {
  const { data, error } = await supabase.rpc('update_staged_banner_product', {
    p_id: productId,
    p_name: input.name,
    p_price: number(input.price),
    p_image: input.image || input.images[0] || '',
    p_images: input.images?.length ? input.images : input.image ? [input.image] : [],
    p_category: input.category,
    p_description: input.description?.trim() || null,
    p_features: input.features ?? [],
    p_size_stocks: input.sizeStocks,
  });

  if (error) {
    console.error('Failed to update staged product:', error);
    throw error;
  }

  invalidateAllBannerCaches();
  invalidateAdminCache('products:');

  return mapStagedProductFromRpc(data as StagedProductRpcResult);
};

export const deleteStagedBannerProduct = async (productId: string): Promise<void> => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('is_staged', true);

  if (error) {
    console.error('Failed to delete staged product:', error);
    throw error;
  }

  invalidateAllBannerCaches();
  invalidateAdminCache('products:');
};

/**
 * Promotes a staged product to the real storefront floor: assigns it
 * a real floor slot (same cycling layout used by AdminProducts'
 * create flow), flips is_staged/show_on_floor server-side, and
 * detaches it from its banner — the banner goes back to just its
 * other staged products.
 */
export const promoteStagedBannerProduct = async (productId: string): Promise<void> => {
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

  const { error } = await supabase.rpc('promote_staged_product', {
    p_product_id: productId,
    p_position_top: slot.position.top,
    p_position_left: slot.position.left,
    p_mobile_position_top: slot.mobilePosition.top,
    p_mobile_position_left: slot.mobilePosition.left,
    p_rotation: slot.rotation,
    p_scale: slot.scale,
    p_z_index: slot.zIndex,
  });

  if (error) {
    console.error('Failed to promote staged product:', error);
    throw error;
  }

  invalidateAllBannerCaches();
  invalidateAdminCache('products:');
};

// ============================================================
// ADMIN: IMAGE UPLOAD
// ============================================================

/**
 * Uploads a banner image to the existing `banners` Storage bucket
 * (public read, admin write — see the storage policies in the schema
 * migration) and returns its public URL. Replaces the FileReader-to
 * base64 approach previously used in AdminContent.tsx's banner form,
 * so banner images are real files in Storage rather than inline data
 * URLs bloating the `banners.image` column.
 */
// src/data/banners.ts (uploadBannerImage update)

export const uploadBannerImage = async (
  file: File,
  removeBackground = false,
  onBackgroundRemoved?: (url: string) => void
): Promise<string> => {
  const fileExt = file.name.split('.').pop() ?? 'jpg';
  const filePath = `${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('banners')
    .upload(filePath, file, { cacheControl: '31536000', upsert: false });

  if (uploadError) {
    console.error('Failed to upload banner image:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage.from('banners').getPublicUrl(filePath);
  const publicUrl = data.publicUrl;

  if (removeBackground) {
    import('../lib/removeBackground')
      .then(({ removeBackgroundOnServer }) =>
        removeBackgroundOnServer('banners', filePath)
      )
      .then(processedUrl => onBackgroundRemoved?.(processedUrl))
      .catch(err => console.error('Background removal failed, keeping original image:', err));
  }

  return publicUrl;
};