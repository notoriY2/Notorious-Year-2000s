-- ============================================================================
-- FIX: 42501 "permission denied for table ..." on products / discounts /
-- banners / banner_products / store_settings writes
--
-- Root cause: same class of bug as the earlier view/trigger fixes. Each
-- of these tables already has correct RLS policies restricting writes
-- to admins (products_admin_write/update/delete, discounts_admin_write,
-- banners_admin_write/update/delete, banner_products_admin_write,
-- settings_admin_write) — but RLS is a second-layer check. Postgres
-- rejects the request at the FIRST layer (the base table GRANT) before
-- RLS is ever evaluated, and `authenticated` was only ever granted
-- SELECT on these tables (for the public storefront read path), never
-- INSERT/UPDATE/DELETE for the admin write paths that call
-- supabase.from(...).update()/.insert()/.delete() directly (as opposed
-- to going through a SECURITY DEFINER RPC, which bypasses this).
--
-- This does NOT loosen who can actually write — the existing RLS
-- policies still enforce is_admin()/is_admin_write() on every row.
-- This grant only lets the request reach that check at all.
--
-- Safe to re-run.
-- ============================================================================

grant insert, update, delete on public.products         to authenticated;
grant insert, update, delete on public.discounts         to authenticated;
grant insert, update, delete on public.banners            to authenticated;
grant insert, update, delete on public.banner_products     to authenticated;
grant insert, update, delete on public.store_settings      to authenticated;
grant insert, update, delete on public.category_sizes      to authenticated;
grant insert, update, delete on public.product_inventory   to authenticated;
