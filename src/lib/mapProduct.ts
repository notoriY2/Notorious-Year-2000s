// src/lib/mapProduct.ts
//
// Pure product-row-mapping logic, extracted out of hooks/useProducts.ts
// so non-hook data modules (e.g. data/banners.ts) can map product rows
// without importing from a React hook file.
//
// IMPORTANT: this file must stay framework-free — no useState, no
// supabase client calls, nothing React-specific. It only transforms
// data shapes.

import { Product } from '../data/products';

// ============================================================
// PRODUCT_INVENTORY ROW (as returned by the join in useProducts.ts's
// `.select('*, product_inventory(size, available)')`)
// ============================================================

export interface ProductInventoryRow {
  size: string;
  available: number;
}

// ============================================================
// PRODUCTS ROW
// ============================================================

// Shape of a row coming back from the `products` table (see the v2
// schema), optionally with its joined product_inventory rows attached.
export interface ProductRow {
  id: string;
  legacy_id: string | null;
  slug: string;
  name: string;
  price: number;
  image: string;
  images?: string[]; // Made optional since PRODUCTS_SELECT_FLOOR omits it for payload optimization
  category: 'top' | 'bottom' | 'accessory';
  status: 'Active' | 'Hidden' | 'Sold Out';
  sold_out: boolean;
  position_top: string;
  position_left: string;
  mobile_position_top: string | null;
  mobile_position_left: string | null;
  rotation: number;
  scale: number;
  z_index: number;
  description: string | null;
  features: string[];
  stock: number;

  // Independent of `status` — controls whether the storefront's main
  // Product Floor/Grid renders this product, without affecting its
  // purchasability, banner/hero linkability, or cart/checkout behavior.
  show_on_floor: boolean;
  is_staged: boolean;
  // Present only when the query joins product_inventory. Optional so
  // callers that select('*') without the join (if any remain) don't
  // break — mapRowToProduct() below handles either case.
  product_inventory?: ProductInventoryRow[];
}

// ============================================================
// MAP SUPABASE ROW -> PRODUCT
// ============================================================

export const mapRowToProduct = (row: ProductRow): Product => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  price: Number(row.price),
  image: row.image || '/placeholder-product.svg',
  // Fall back to a single-image array if `images` is empty or missing (e.g. from floor select)
  // so downstream code that indexes into images[0..3] doesn't break.
  images: row.images && row.images.length > 0 ? row.images : [row.image],
  // Defaults true so any row missing the column (shouldn't happen post-
  // migration, but be defensive) behaves like today: visible on floor.
  showOnFloor: Boolean(row.show_on_floor ?? true),
  isStaged: Boolean(row.is_staged ?? false),
  position: {
    top: row.position_top,
    left: row.position_left,
  },
  mobilePosition:
    row.mobile_position_top && row.mobile_position_left
      ? { top: row.mobile_position_top, left: row.mobile_position_left }
      : undefined,
  rotation: Number(row.rotation),
  scale: Number(row.scale),
  zIndex: row.z_index,
  category: row.category,
  soldOut: row.sold_out,

  // Per-size availability, sourced from the joined product_inventory
  // rows. Falls back to an empty array (not undefined) when the join
  // wasn't requested or the product genuinely has no inventory rows yet,
  // so downstream consumers can always safely call .map()/.find() on it
  // without an extra null check.
  sizes: (row.product_inventory ?? []).map((inventoryRow) => ({
    size: inventoryRow.size,
    available: Number(inventoryRow.available),
  })),
});