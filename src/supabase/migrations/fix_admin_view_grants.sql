-- ============================================================================
-- FIX: 42501 "permission denied for view ..." on admin/analytics views
--
-- Root cause: Postgres views need their own explicit GRANT SELECT —
-- they do NOT inherit access from grants on their underlying tables.
-- These views (admin_customers_view, admin_inventory_view,
-- admin_revenue_daily, revenue_by_category, revenue_by_country,
-- revenue_by_payment, admin_kpis, admin_order_status_counts,
-- admin_payment_status_counts, analytics_daily_traffic,
-- analytics_daily_summary) were created in the schema but only
-- admin_products_view ever received a GRANT. Views default to
-- SECURITY INVOKER, so the querying role (authenticated) hits a
-- permission check on the view itself before the underlying tables'
-- RLS policies (is_admin()/is_admin_write()) are ever evaluated.
--
-- These are all admin-only reads, so we grant to `authenticated` only
-- (not anon). The underlying tables' RLS policies still correctly
-- restrict actual ROWS to admins only — this grant just gets past
-- Postgres's first-layer relation check so RLS is reached at all,
-- matching the same "rule of thumb" already documented in Section 35
-- of the base schema.
--
-- Safe to re-run. Also worth pasting into database.sql's Section 35,
-- right after "grant select on public.admin_products_view to anon,
-- authenticated;", so a fresh database build doesn't regress this.
-- ============================================================================

grant select on public.admin_customers_view        to authenticated;
grant select on public.admin_inventory_view         to authenticated;
grant select on public.admin_revenue_daily          to authenticated;
grant select on public.admin_kpis                   to authenticated;
grant select on public.admin_order_status_counts    to authenticated;
grant select on public.admin_payment_status_counts  to authenticated;
grant select on public.revenue_by_category          to authenticated;
grant select on public.revenue_by_country           to authenticated;
grant select on public.revenue_by_payment           to authenticated;
grant select on public.analytics_daily_summary      to authenticated;
grant select on public.analytics_daily_traffic      to authenticated;

-- Belt-and-braces: make sure future views created the same way don't
-- repeat this bug. Postgres has no "default privileges on views"
-- distinct from tables, so this line (already present in the base
-- schema) covers both — kept here as a reminder/no-op if it already ran:
alter default privileges in schema public grant select on tables to authenticated;
