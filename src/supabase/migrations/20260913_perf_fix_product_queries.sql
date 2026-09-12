-- 20260913_perf_fix_product_queries.sql

-- The recommendation pool query filters (status, is_staged) and sorts
-- by sales_count desc — nothing serves that access pattern today.
create index if not exists idx_products_recs_pool
  on public.products (status, is_staged, sales_count desc);

-- admin_products_view does `select p.*`, dragging the embedding column
-- along on every admin product load too.
drop view if exists public.admin_products_view;

create view public.admin_products_view as
select
  p.id, p.legacy_id, p.slug, p.name, p.price, p.image, p.images,
  p.category, p.status, p.sold_out, p.position_top, p.position_left,
  p.mobile_position_top, p.mobile_position_left, p.rotation, p.scale,
  p.z_index, p.description, p.features, p.stock, p.views, p.carts_count,
  p.sales_count, p.created_at, p.updated_at, p.show_on_floor, p.is_staged,
  p.force_sold_out,
  case when p.views > 0
    then round((p.sales_count::numeric / p.views) * 100, 2)
    else 0
  end as conversion_rate
from public.products p;

-- A little breathing room now that the hot paths below are trimmed —
-- 6s was fine for skinny rows, too tight once a vector column exists.
alter role authenticated set statement_timeout = '10000';
alter role anon set statement_timeout = '10000';