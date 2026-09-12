-- ============================================================
-- Grant baseline schema usage
-- ============================================================
grant usage on schema public to anon, authenticated;

-- ============================================================
-- Public-read tables (storefront needs SELECT as anon)
-- ============================================================
grant select on public.products                to anon, authenticated;
grant select on public.product_inventory        to anon, authenticated;
grant select on public.currencies                to anon, authenticated;
grant select on public.banners                   to anon, authenticated;
grant select on public.banner_products           to anon, authenticated;
grant select on public.store_settings            to anon, authenticated;
grant select on public.discounts                 to anon, authenticated;
grant select on public.category_sizes            to anon, authenticated;
grant select on public.admin_products_view       to anon, authenticated;

-- ============================================================
-- Insert-only from the public (anon) side
-- ============================================================
grant insert on public.analytics_events          to anon, authenticated;
grant insert on public.product_views             to anon, authenticated;
grant insert on public.stock_notifications        to anon, authenticated;
grant insert on public.consent_records            to anon, authenticated;

-- ============================================================
-- Full CRUD for authenticated users (their own rows, enforced by RLS)
-- ============================================================
grant select, insert, update, delete on public.profiles             to authenticated;
grant select, insert, update, delete on public.addresses            to authenticated;
grant select, insert, update, delete on public.carts                to authenticated;
grant select, insert, update, delete on public.cart_items           to authenticated;
grant select, insert, update, delete on public.wishlist_items       to authenticated;
grant select, insert, update           on public.orders               to authenticated;
grant select, insert                   on public.order_items          to authenticated;
grant select                            on public.invoices             to authenticated;
grant select, insert, update           on public.returns              to authenticated;
grant select, insert, update, delete on public.payment_methods      to authenticated;
grant select, insert                   on public.payment_transactions to authenticated;
grant select                            on public.carrier_shipments    to authenticated;
grant select                            on public.credit_accounts      to authenticated;
grant select, insert                   on public.credit_transactions to authenticated;
grant select, insert                   on public.discount_redemptions to authenticated;

-- orders/order_items also need anon insert (guest checkout)
grant insert on public.orders       to anon;
grant insert on public.order_items  to anon;

-- ============================================================
-- Sequences (needed for any nextval()/identity columns the above
-- tables' triggers touch, e.g. order_number_seq, invoice_number_seq)
-- ============================================================
grant usage, select on all sequences in schema public to anon, authenticated;

-- ============================================================
-- Functions/RPCs your app calls directly
-- ============================================================
grant execute on function public.create_order_with_items(uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb) to anon, authenticated;
grant execute on function public.match_products(uuid, int) to anon, authenticated;
grant execute on function public.increment_banner_click(uuid) to anon, authenticated;
grant execute on function public.increment_banner_impression(uuid) to anon, authenticated;
grant execute on function public.get_category_sizes(public.product_category) to anon, authenticated;

-- admin-only RPCs — authenticated only, RLS/is_admin_write() inside enforces the rest
grant execute on function public.create_product_with_inventory(text, text, numeric, text, text[], public.product_category, public.product_status, boolean, text, text, text, text, numeric, numeric, integer, text, text[], jsonb, boolean) to authenticated;
grant execute on function public.update_product_with_inventory(uuid, text, text, numeric, text, text[], public.product_category, public.product_status, boolean, text, text, text, text, numeric, numeric, integer, text, text[], jsonb, boolean) to authenticated;
grant execute on function public.create_staged_banner_product(uuid, text, text, numeric, text, text[], public.product_category, text, text[], jsonb, integer) to authenticated;
grant execute on function public.update_staged_banner_product(uuid, text, numeric, text, text[], public.product_category, text, text[], jsonb) to authenticated;
grant execute on function public.promote_staged_product(uuid, text, text, text, text, numeric, numeric, integer) to authenticated;
grant execute on function public.erase_user_personal_data(uuid) to authenticated;

-- admin_notifications / admin_activity_log / admin_email_allowlist / inventory_history
-- are admin-only reads (RLS already restricts to is_admin()), but the role still
-- needs the base grant to get past this permission-denied stage:
grant select, insert, update, delete on public.admin_notifications    to authenticated;
grant select, insert                   on public.admin_activity_log    to authenticated;
grant select, insert, update, delete on public.admin_email_allowlist  to authenticated;
grant select, insert, update, delete on public.inventory_history      to authenticated;
grant select, insert, update, delete on public.abandoned_carts        to authenticated;
grant select, insert, update, delete on public.campaigns              to authenticated;

-- ============================================================
-- Make this automatic for any table created in the future
-- ============================================================
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;