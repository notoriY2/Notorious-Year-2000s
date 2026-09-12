-- ============================================================================
-- FIX: 42501 "permission denied for table products" on product_views /
-- cart_items inserts
--
-- Root cause: inserting into product_views fires bump_product_views(),
-- and inserting into cart_items fires bump_product_carts_count() — both
-- run `UPDATE public.products ...`. Trigger functions execute with the
-- privileges of whoever fired the ORIGINAL statement (anon/authenticated
-- here), not the table owner, unless the function itself is marked
-- SECURITY DEFINER. anon/authenticated only ever received SELECT on
-- products (writes are correctly admin-only via RLS) — so the trigger's
-- UPDATE hits a hard permission error before RLS is ever evaluated.
--
-- This mirrors the pattern already used correctly elsewhere in the
-- schema (increment_banner_click / increment_banner_impression are both
-- SECURITY DEFINER for exactly this reason). Marking these two trigger
-- functions SECURITY DEFINER lets them run as the function owner
-- (bypassing the caller's missing UPDATE grant / RLS) while the insert
-- into product_views/cart_items itself is still governed by its own
-- existing RLS policies (product_views_insert_anyone /
-- cart_items_owner_or_admin) — customers still can't touch `products`
-- directly, only these narrow, single-purpose counters can.
--
-- Safe to re-run.
-- ============================================================================

alter function public.bump_product_views() security definer;
alter function public.bump_product_views() set search_path = public;

alter function public.bump_product_carts_count() security definer;
alter function public.bump_product_carts_count() set search_path = public;
