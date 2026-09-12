-- ============================================================================
--  20260913_fix_rpc_viewer_bypass.sql
--
--  BUG: These five RPCs are `security definer`, so they run past Row Level
--  Security entirely. They gate themselves with `public.is_admin()`, which
--  only checks profiles.is_admin = true — it does NOT check admin_role.
--  That means a signed-in Viewer (is_admin = true, admin_role = 'Viewer')
--  is correctly blocked by RLS policies (which use is_admin_write()) and by
--  the UI (useIsViewer() disables buttons), but can still call these RPCs
--  directly — e.g. from devtools or curl — and create/edit real products
--  or promote/delete staged banner products.
--
--  FIX: swap `is_admin()` for `is_admin_write()` (added in
--  20260825_viewer_role_setup.sql) in every one of these five functions.
--  CREATE OR REPLACE requires an identical parameter list to replace a
--  function in place, so each signature below is copied verbatim from its
--  latest defining migration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. create_product_with_inventory
-- ----------------------------------------------------------------------------
create or replace function public.create_product_with_inventory(
  p_slug                  text,
  p_name                  text,
  p_price                 numeric,
  p_image                 text,
  p_images                text[],
  p_category              public.product_category,
  p_status                public.product_status,
  p_sold_out              boolean,
  p_position_top          text,
  p_position_left         text,
  p_mobile_position_top   text,
  p_mobile_position_left  text,
  p_rotation              numeric,
  p_scale                 numeric,
  p_z_index               integer,
  p_description           text,
  p_features              text[],
  p_size_stocks           jsonb default '{}'::jsonb,
  p_show_on_floor         boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id  uuid;
  v_valid_sizes text[];
  v_result      jsonb;
begin
  if not public.is_admin_write() then
    raise exception 'Only admins can create products';
  end if;

  insert into public.products (
    slug, name, price, image, images, category, status, sold_out, force_sold_out,
    position_top, position_left, mobile_position_top, mobile_position_left,
    rotation, scale, z_index, description, features, show_on_floor
  ) values (
    p_slug, p_name, p_price, p_image, coalesce(p_images, '{}'), p_category, p_status,
    coalesce(p_sold_out, false), coalesce(p_sold_out, false),
    coalesce(p_position_top, '0px'), coalesce(p_position_left, '0%'), p_mobile_position_top, p_mobile_position_left,
    coalesce(p_rotation, 0), coalesce(p_scale, 1), coalesce(p_z_index, 1), p_description, coalesce(p_features, '{}'),
    coalesce(p_show_on_floor, true)
  )
  returning id into v_product_id;

  select array_agg(size) into v_valid_sizes
  from public.category_sizes
  where category = p_category;

  insert into public.product_inventory (product_id, size, available)
  select v_product_id, cs.size, greatest(0, coalesce((p_size_stocks ->> cs.size)::int, 0))
  from public.category_sizes cs
  where cs.category = p_category
  on conflict (product_id, size) do update set available = excluded.available;

  delete from public.product_inventory
  where product_id = v_product_id
    and size <> all (coalesce(v_valid_sizes, array[]::text[]));

  select to_jsonb(p.*) || jsonb_build_object(
    'sizes', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'size', pi.size, 'available', pi.available,
                'reserved', pi.reserved, 'sold', pi.sold
              ) order by pi.size)
       from public.product_inventory pi
       where pi.product_id = p.id),
      '[]'::jsonb
    )
  )
  into v_result
  from public.products p
  where p.id = v_product_id;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. update_product_with_inventory
-- ----------------------------------------------------------------------------
create or replace function public.update_product_with_inventory(
  p_id                    uuid,
  p_slug                  text,
  p_name                  text,
  p_price                 numeric,
  p_image                 text,
  p_images                text[],
  p_category              public.product_category,
  p_status                public.product_status,
  p_sold_out              boolean,
  p_position_top          text,
  p_position_left         text,
  p_mobile_position_top   text,
  p_mobile_position_left  text,
  p_rotation              numeric,
  p_scale                 numeric,
  p_z_index               integer,
  p_description           text,
  p_features              text[],
  p_size_stocks           jsonb default null,
  p_show_on_floor         boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid_sizes text[];
  v_result      jsonb;
begin
  if not public.is_admin_write() then
    raise exception 'Only admins can update products';
  end if;

  update public.products set
    slug                  = coalesce(p_slug, slug),
    name                  = p_name,
    price                 = p_price,
    image                 = p_image,
    images                = coalesce(p_images, images),
    category              = p_category,
    status                = p_status,
    sold_out              = coalesce(p_sold_out, sold_out),
    force_sold_out        = coalesce(p_sold_out, force_sold_out),
    position_top          = coalesce(p_position_top, position_top),
    position_left         = coalesce(p_position_left, position_left),
    mobile_position_top   = p_mobile_position_top,
    mobile_position_left  = p_mobile_position_left,
    rotation               = coalesce(p_rotation, rotation),
    scale                  = coalesce(p_scale, scale),
    z_index                = coalesce(p_z_index, z_index),
    description            = p_description,
    features               = coalesce(p_features, features),
    show_on_floor          = coalesce(p_show_on_floor, show_on_floor)
  where id = p_id;

  if not found then
    raise exception 'Product % not found', p_id;
  end if;

  if p_size_stocks is not null then
    select array_agg(size) into v_valid_sizes
    from public.category_sizes
    where category = p_category;

    insert into public.product_inventory (product_id, size, available)
    select p_id, cs.size, greatest(0, coalesce((p_size_stocks ->> cs.size)::int, 0))
    from public.category_sizes cs
    where cs.category = p_category
    on conflict (product_id, size) do update set available = excluded.available;

    delete from public.product_inventory
    where product_id = p_id
      and size <> all (coalesce(v_valid_sizes, array[]::text[]));
  else
    update public.products p
    set sold_out = (
      coalesce((select sum(available) from public.product_inventory where product_id = p.id), 0) = 0
    ) or p.force_sold_out
    where p.id = p_id;
  end if;

  select to_jsonb(p.*) || jsonb_build_object(
    'sizes', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'size', pi.size, 'available', pi.available,
                'reserved', pi.reserved, 'sold', pi.sold
              ) order by pi.size)
       from public.product_inventory pi
       where pi.product_id = p.id),
      '[]'::jsonb
    )
  )
  into v_result
  from public.products p
  where p.id = p_id;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. create_staged_banner_product
-- ----------------------------------------------------------------------------
create or replace function public.create_staged_banner_product(
  p_banner_id    uuid,
  p_slug         text,
  p_name         text,
  p_price        numeric,
  p_image        text,
  p_images       text[],
  p_category     public.product_category,
  p_description  text,
  p_features     text[],
  p_size_stocks  jsonb default '{}'::jsonb,
  p_position     integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id  uuid;
  v_valid_sizes text[];
  v_result      jsonb;
begin
  if not public.is_admin_write() then
    raise exception 'Only admins can create products';
  end if;

  insert into public.products (
    slug, name, price, image, images, category, status,
    sold_out, force_sold_out,
    position_top, position_left,
    rotation, scale, z_index,
    description, features,
    show_on_floor, is_staged
  ) values (
    p_slug, p_name, p_price, p_image, coalesce(p_images, '{}'), p_category, 'Active',
    false, false,
    '0px', '0%',
    0, 1, 1,
    p_description, coalesce(p_features, '{}'),
    false, true
  )
  returning id into v_product_id;

  select array_agg(size) into v_valid_sizes
  from public.category_sizes
  where category = p_category;

  insert into public.product_inventory (product_id, size, available)
  select v_product_id, cs.size, greatest(0, coalesce((p_size_stocks ->> cs.size)::int, 0))
  from public.category_sizes cs
  where cs.category = p_category
  on conflict (product_id, size) do update set available = excluded.available;

  delete from public.product_inventory
  where product_id = v_product_id
    and size <> all (coalesce(v_valid_sizes, array[]::text[]));

  insert into public.banner_products (banner_id, product_id, position)
  values (p_banner_id, v_product_id, p_position)
  on conflict (banner_id, product_id) do update set position = excluded.position;

  select to_jsonb(p.*) || jsonb_build_object(
    'sizes', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'size', pi.size, 'available', pi.available,
                'reserved', pi.reserved, 'sold', pi.sold
              ) order by pi.size)
       from public.product_inventory pi
       where pi.product_id = p.id),
      '[]'::jsonb
    )
  )
  into v_result
  from public.products p
  where p.id = v_product_id;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. update_staged_banner_product
-- ----------------------------------------------------------------------------
create or replace function public.update_staged_banner_product(
  p_id            uuid,
  p_name          text,
  p_price         numeric,
  p_image         text,
  p_images        text[],
  p_category      public.product_category,
  p_description   text,
  p_features      text[],
  p_size_stocks   jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid_sizes text[];
  v_result      jsonb;
begin
  if not public.is_admin_write() then
    raise exception 'Only admins can update products';
  end if;

  update public.products set
    name        = p_name,
    price       = p_price,
    image       = p_image,
    images      = coalesce(p_images, images),
    category    = p_category,
    description = p_description,
    features    = coalesce(p_features, features)
  where id = p_id and is_staged = true;

  if not found then
    raise exception 'Staged product % not found', p_id;
  end if;

  if p_size_stocks is not null then
    select array_agg(size) into v_valid_sizes
    from public.category_sizes
    where category = p_category;

    insert into public.product_inventory (product_id, size, available)
    select p_id, cs.size, greatest(0, coalesce((p_size_stocks ->> cs.size)::int, 0))
    from public.category_sizes cs
    where cs.category = p_category
    on conflict (product_id, size) do update set available = excluded.available;

    delete from public.product_inventory
    where product_id = p_id
      and size <> all (coalesce(v_valid_sizes, array[]::text[]));
  end if;

  select to_jsonb(p.*) || jsonb_build_object(
    'sizes', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'size', pi.size, 'available', pi.available,
                'reserved', pi.reserved, 'sold', pi.sold
              ) order by pi.size)
       from public.product_inventory pi
       where pi.product_id = p.id),
      '[]'::jsonb
    )
  )
  into v_result
  from public.products p
  where p.id = p_id;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. promote_staged_product
-- ----------------------------------------------------------------------------
create or replace function public.promote_staged_product(
  p_product_id           uuid,
  p_position_top         text,
  p_position_left        text,
  p_mobile_position_top  text,
  p_mobile_position_left text,
  p_rotation             numeric,
  p_scale                numeric,
  p_z_index              integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin_write() then
    raise exception 'Only admins can promote products';
  end if;

  update public.products set
    is_staged             = false,
    show_on_floor         = true,
    position_top          = p_position_top,
    position_left         = p_position_left,
    mobile_position_top   = p_mobile_position_top,
    mobile_position_left  = p_mobile_position_left,
    rotation              = p_rotation,
    scale                 = p_scale,
    z_index                = p_z_index
  where id = p_product_id;

  if not found then
    raise exception 'Product % not found', p_product_id;
  end if;

  delete from public.banner_products where product_id = p_product_id;

  select to_jsonb(p.*) into v_result from public.products p where p.id = p_product_id;

  return v_result;
end;
$$;

-- ============================================================================
-- DONE. Run this after 20260913_perf_fix_product_queries.sql (or whatever is
-- currently your latest migration) — order relative to that one doesn't
-- matter, this file only touches function bodies.
-- ============================================================================
