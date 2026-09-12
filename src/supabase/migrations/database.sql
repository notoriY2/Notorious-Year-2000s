-- ============================================================================
--  NOTORIOUS.Y2 — CONSOLIDATED SCHEMA (v3)
--  Merges every prior migration file (20260822141356_notorious_y2_schema_v2.sql
--  through 20260914_raise_statement_timeout.sql), the consent_records /
--  erase_user_personal_data addition, AND the base-table GRANT fix
--  diagnosed in the "42501 permission denied" investigation, into one
--  idempotent, run-once-clean definition.
--
--  Every "create or replace" / "add column if not exists" /
--  "drop policy if exists" / "grant ... " pattern is written so this file
--  is also safe to re-run against a database that already has some or all
--  of this in place.
--
--  WHY SECTION 35 (GRANTS) EXISTS AND WHY IT MATTERS:
--  Postgres enforces two independent permission layers:
--    1. Table-level GRANTs — does this role have SELECT/INSERT/UPDATE/
--       DELETE on this table at all?
--    2. RLS policies — given that the role has the grant, which ROWS can
--       it see/touch?
--  RLS policies are meaningless without the matching table grant — the
--  query is rejected before RLS is ever evaluated (Postgres error 42501).
--  Supabase's bootstrap normally sets these grants automatically, but a
--  project restored from backup, or one that had its role grants reset,
--  can end up with rich RLS policies that are completely unreachable.
--  Section 35 is the fix, and it is idempotent (plain GRANT statements
--  are safe to re-run).
--  ALSO IMPORTANT: PostgREST always executes inserts as
--  "INSERT ... RETURNING *" under the hood — the Prefer: return=minimal
--  header only controls whether that data is sent back to the client, not
--  what Postgres runs. That means every role that INSERTs into a table
--  must also have SELECT on it, even if the app code never reads the row
--  back. Section 35 grants SELECT alongside every INSERT/UPDATE/DELETE
--  for exactly this reason.
--
--  NOT included here: product catalog seed data (38 products + inventory
--  rows) and discount code seeds — those are DATA, not SCHEMA, and belong
--  in a separate seed script. Keeping them out is what makes this file
--  safe to run against a database that already has real customer data.
--
--  ORDER OF OPERATIONS IF RUNNING FRESH:
--    1. This file
--    2. Your seed script (products, category_sizes rows are already
--       seeded below since those are taxonomy, not customer data)
-- ============================================================================

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists vector;
create extension if not exists pg_cron;

-- ============================================================================
-- 1. ENUMS  (admin_role_type includes 'Viewer' directly — no ALTER TYPE needed
--    on a fresh build; the ALTER TYPE ... ADD VALUE below is belt-and-braces
--    for a DB that already has the enum without it)
-- ============================================================================
do $$ begin create type provider_type as enum ('email','google','facebook','instagram'); exception when duplicate_object then null; end $$;
do $$ begin create type product_category as enum ('top','bottom','accessory'); exception when duplicate_object then null; end $$;
do $$ begin create type product_status as enum ('Active','Hidden','Sold Out'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_status_type as enum ('Paid','Pending','Refunded','Failed'); exception when duplicate_object then null; end $$;
do $$ begin create type fulfillment_status_type as enum ('Processing','Shipped','Delivered','Cancelled','Pending'); exception when duplicate_object then null; end $$;
do $$ begin create type return_status_type as enum ('Requested','Processing','Approved','Rejected','Completed'); exception when duplicate_object then null; end $$;
do $$ begin create type invoice_status_type as enum ('Paid','Pending','Void'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_method_type as enum ('Visa','Mastercard','Amex','Discover','PayPal','Apple Pay','Google Pay','EFT'); exception when duplicate_object then null; end $$;
do $$ begin create type transaction_type as enum ('Sale','Refund','Payout'); exception when duplicate_object then null; end $$;
do $$ begin create type transaction_status_type as enum ('Completed','Pending','Failed','Refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type discount_type as enum ('Percentage','Fixed','Free Shipping'); exception when duplicate_object then null; end $$;
do $$ begin create type discount_status_type as enum ('Active','Scheduled','Expired'); exception when duplicate_object then null; end $$;
do $$ begin create type campaign_status_type as enum ('Draft','Active','Completed'); exception when duplicate_object then null; end $$;
do $$ begin create type admin_role_type as enum ('Owner','Admin','Manager','Support','Analyst','Viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type admin_status_type as enum ('Active','Inactive'); exception when duplicate_object then null; end $$;
do $$ begin create type notification_type as enum ('order','stock','customer','system'); exception when duplicate_object then null; end $$;
do $$ begin create type banner_position_type as enum ('Top','Middle','Bottom'); exception when duplicate_object then null; end $$;
do $$ begin create type banner_status_type as enum ('Active','Scheduled'); exception when duplicate_object then null; end $$;

do $$ begin alter type admin_role_type add value if not exists 'Viewer'; exception when others then null; end $$;

-- ============================================================================
-- 2. UTILITY FUNCTIONS
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 3. PROFILES + ADMIN ALLOWLIST + AUTH TRIGGERS
-- ============================================================================
create table if not exists public.admin_email_allowlist (
  email      text primary key,
  admin_role admin_role_type not null default 'Admin'
);

insert into public.admin_email_allowlist (email) values
  ('admin@notorious.y2'), ('owner@notorious.y2'), ('manager@notorious.y2')
on conflict do nothing;

create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text not null,
  name               text not null default '',
  avatar             text,
  provider           provider_type not null default 'email',
  is_admin           boolean not null default false,
  admin_role         admin_role_type,
  admin_permissions  text[] not null default '{}',
  admin_status       admin_status_type not null default 'Active',
  last_active_at     timestamptz,
  phone              text,
  date_of_birth      date,
  default_address    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_is_admin boolean;
  v_role admin_role_type;
begin
  select true, a.admin_role into v_is_admin, v_role
  from public.admin_email_allowlist a
  where lower(a.email) = lower(new.email);

  insert into public.profiles (id, email, name, provider, is_admin, admin_role, admin_status)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'provider')::provider_type, 'email'),
    coalesce(v_is_admin, false),
    v_role,
    'Active'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_admin_write()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select p.is_admin and p.admin_role is distinct from 'Viewer'
     from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create table if not exists public.admin_notifications (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  type         notification_type not null default 'system',
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_notifications_read on public.admin_notifications(read);

create or replace function public.notify_new_customer()
returns trigger language plpgsql as $$
begin
  if not new.is_admin then
    insert into public.admin_notifications (title, description, type)
    values ('New Customer Account', new.email || ' registered a new account.', 'customer');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_customer on public.profiles;
create trigger trg_notify_new_customer
  after insert on public.profiles
  for each row execute function public.notify_new_customer();

-- ============================================================================
-- 4. ADDRESSES
-- ============================================================================
create table if not exists public.addresses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  label          text not null default 'Shipping',
  full_name      text,
  phone          text,
  address_line1  text not null,
  address_line2  text,
  city           text not null,
  state          text,
  zip_code       text,
  country        text not null default 'United States',
  is_default     boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_addresses_user on public.addresses(user_id);

-- ============================================================================
-- 5. CURRENCIES
-- ============================================================================
create table if not exists public.currencies (
  code    text primary key,
  symbol  text not null,
  rate    numeric(12,4) not null default 1
);

insert into public.currencies (code, symbol, rate) values
  ('USD', '$',  1), ('EUR', '€', 0.85), ('GBP', '£', 0.73), ('ZAR', 'R', 18.50),
  ('JPY', '¥', 110), ('CAD', 'C$', 1.25), ('AUD', 'A$', 1.35)
on conflict (code) do update set symbol = excluded.symbol, rate = excluded.rate;

-- ============================================================================
-- 6. CATEGORY SIZES  (canonical size taxonomy)
-- ============================================================================
create table if not exists public.category_sizes (
  category    product_category not null,
  size        text not null,
  sort_order  integer not null default 0,
  primary key (category, size)
);

insert into public.category_sizes (category, size, sort_order) values
  ('top',       'SMALL',    1),
  ('top',       'MEDIUM',   2),
  ('top',       'LARGE',    3),
  ('bottom',    '28',       1),
  ('bottom',    '30',       2),
  ('bottom',    '32',       3),
  ('bottom',    '34',       4),
  ('bottom',    '36',       5),
  ('accessory', 'ONE SIZE', 1)
on conflict (category, size) do update set sort_order = excluded.sort_order;

create or replace function public.get_category_sizes(p_category public.product_category)
returns table(size text, sort_order integer)
language sql stable set search_path = public as $$
  select cs.size, cs.sort_order
  from public.category_sizes cs
  where cs.category = p_category
  order by cs.sort_order;
$$;

-- ============================================================================
-- 7. PRODUCTS  (+ show_on_floor, is_staged, force_sold_out, embedding)
-- ============================================================================
create table if not exists public.products (
  id                   uuid primary key default gen_random_uuid(),
  legacy_id            text unique,
  slug                 text unique not null,
  name                 text not null,
  price                numeric(10,2) not null check (price >= 0),
  image                text not null,
  images               text[] not null default '{}',
  category             product_category not null default 'top',
  status               product_status not null default 'Active',
  sold_out             boolean not null default false,
  force_sold_out       boolean not null default false,

  position_top         text not null default '0px',
  position_left        text not null default '0%',
  mobile_position_top  text,
  mobile_position_left text,
  rotation             numeric(6,2) not null default 0,
  scale                numeric(4,2) not null default 1,
  z_index              integer not null default 1,

  description          text,
  features             text[] not null default '{}',

  stock                integer not null default 0,
  views                integer not null default 0,
  carts_count          integer not null default 0,
  sales_count          integer not null default 0,

  show_on_floor        boolean not null default true,
  is_staged            boolean not null default false,

  embedding            vector(1536),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 8. PRODUCT INVENTORY
-- ============================================================================
create table if not exists public.product_inventory (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  size        text not null,
  available   integer not null default 0 check (available >= 0),
  reserved    integer not null default 0 check (reserved >= 0),
  sold        integer not null default 0 check (sold >= 0),
  unique (product_id, size)
);
create index if not exists idx_product_inventory_product on public.product_inventory(product_id);

create or replace function public.recalc_product_stock()
returns trigger language plpgsql as $$
declare
  v_product_id uuid;
  v_total integer;
  v_force boolean;
begin
  v_product_id := coalesce(new.product_id, old.product_id);
  select coalesce(sum(available), 0) into v_total
    from public.product_inventory where product_id = v_product_id;
  select force_sold_out into v_force from public.products where id = v_product_id;
  update public.products
    set stock = v_total, sold_out = (v_total = 0) or coalesce(v_force, false)
    where id = v_product_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_inventory_recalc on public.product_inventory;
create trigger trg_inventory_recalc
  after insert or update or delete on public.product_inventory
  for each row execute function public.recalc_product_stock();

create or replace function public.notify_low_stock()
returns trigger language plpgsql as $$
declare
  v_name text;
  v_total integer;
begin
  if new.available < 5 and (old.available is null or old.available >= 5) then
    select name into v_name from public.products where id = new.product_id;
    select coalesce(sum(available),0) into v_total from public.product_inventory where product_id = new.product_id;
    insert into public.admin_notifications (title, description, type)
    values ('Low Stock Alert', coalesce(v_name,'A product') || ' (' || new.size || ') is down to ' || v_total || ' items.', 'stock');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_low_stock on public.product_inventory;
create trigger trg_notify_low_stock
  after insert or update on public.product_inventory
  for each row execute function public.notify_low_stock();

create or replace function public.notify_back_in_stock()
returns trigger language plpgsql as $$
begin
  if old.available = 0 and new.available > 0 then
    update public.stock_notifications
      set notified = false
    where product_id = new.product_id and size = new.size and notified = false;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 9. INVENTORY HISTORY
-- ============================================================================
create table if not exists public.inventory_history (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  size         text,
  change       integer not null,
  reason       text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_inventory_history_product on public.inventory_history(product_id);

create or replace function public.log_inventory_change()
returns trigger language plpgsql as $$
begin
  if new.available is distinct from old.available then
    insert into public.inventory_history (product_id, size, change, reason)
    values (
      new.product_id,
      new.size,
      new.available - old.available,
      case when new.available < old.available then 'Order sold' else 'Manual adjustment' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_inventory_change on public.product_inventory;
create trigger trg_log_inventory_change
  after update on public.product_inventory
  for each row execute function public.log_inventory_change();

drop trigger if exists trg_notify_back_in_stock on public.product_inventory;
create trigger trg_notify_back_in_stock
  after update on public.product_inventory
  for each row execute function public.notify_back_in_stock();

-- ============================================================================
-- 10. PRODUCT VIEWS
-- ============================================================================
create table if not exists public.product_views (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references public.products(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  viewed_at   timestamptz not null default now()
);
create index if not exists idx_product_views_product on public.product_views(product_id);

create or replace function public.bump_product_views()
returns trigger language plpgsql as $$
begin
  update public.products set views = views + 1 where id = new.product_id;
  return new;
end;
$$;

drop trigger if exists trg_product_views_bump on public.product_views;
create trigger trg_product_views_bump
  after insert on public.product_views
  for each row execute function public.bump_product_views();

-- ============================================================================
-- 11. STOCK NOTIFICATIONS
-- ============================================================================
create table if not exists public.stock_notifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  size text not null,
  email text not null,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  unique(product_id, size, email)
);

-- ============================================================================
-- 12. CART / CART ITEMS
-- ============================================================================
create table if not exists public.carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  session_id  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint carts_owner_check check (user_id is not null or session_id is not null)
);

create unique index if not exists uq_carts_user on public.carts(user_id) where user_id is not null;
create index if not exists idx_carts_session on public.carts(session_id);

drop trigger if exists trg_carts_updated_at on public.carts;
create trigger trg_carts_updated_at
  before update on public.carts
  for each row execute function public.set_updated_at();

create table if not exists public.cart_items (
  id              uuid primary key default gen_random_uuid(),
  cart_id         uuid not null references public.carts(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  quantity        integer not null default 1 check (quantity > 0),
  selected_size   text,
  selected_color  text,
  price_at_add    numeric(10,2) not null,
  created_at      timestamptz not null default now(),
  unique (cart_id, product_id, selected_size, selected_color)
);
create index if not exists idx_cart_items_cart on public.cart_items(cart_id);
create index if not exists idx_cart_items_product on public.cart_items(product_id);

create or replace function public.bump_product_carts_count()
returns trigger language plpgsql as $$
begin
  update public.products set carts_count = carts_count + 1 where id = new.product_id;
  return new;
end;
$$;

drop trigger if exists trg_cart_items_bump_carts on public.cart_items;
create trigger trg_cart_items_bump_carts
  after insert on public.cart_items
  for each row execute function public.bump_product_carts_count();

-- ============================================================================
-- 13. WISHLIST
-- ============================================================================
create table if not exists public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, product_id)
);
create index if not exists idx_wishlist_user on public.wishlist_items(user_id);

-- ============================================================================
-- 14. ORDERS / ORDER ITEMS
-- ============================================================================
create sequence if not exists public.order_number_seq start 10493;

create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text unique,
  user_id               uuid references public.profiles(id) on delete set null,
  customer_name         text not null,
  customer_email        text not null,
  customer_phone        text,
  subtotal              numeric(10,2) not null default 0,
  shipping              numeric(10,2) not null default 0,
  tax                   numeric(10,2) not null default 0,
  total                 numeric(10,2) not null default 0,
  currency_code         text not null default 'USD' references public.currencies(code),
  payment_status        payment_status_type not null default 'Pending',
  fulfillment_status    fulfillment_status_type not null default 'Pending',
  shipping_address      jsonb,
  billing_address       jsonb,
  tracking_number       text,
  discount_code         text,
  discount_amount       numeric(10,2) not null default 0,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_orders_email on public.orders(customer_email);
create index if not exists idx_orders_created on public.orders(created_at desc);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_fulfillment_status on public.orders(fulfillment_status);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create or replace function public.set_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    new.order_number := 'NY2-' || nextval('public.order_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_order_number on public.orders;
create trigger trg_orders_order_number
  before insert on public.orders
  for each row execute function public.set_order_number();

create or replace function public.notify_new_order()
returns trigger language plpgsql as $$
begin
  insert into public.admin_notifications (title, description, type)
  values ('New Order Received', 'Order #' || new.order_number || ' has been placed for ' || new.total || '.', 'order');
  return new;
end;
$$;

drop trigger if exists trg_notify_new_order on public.orders;
create trigger trg_notify_new_order
  after insert on public.orders
  for each row execute function public.notify_new_order();

create or replace function public.log_order_status_change()
returns trigger language plpgsql as $$
declare
  v_actor text;
begin
  v_actor := coalesce(auth.jwt() ->> 'email', 'system');
  if new.fulfillment_status is distinct from old.fulfillment_status then
    insert into public.admin_activity_log (actor_email, action)
    values (v_actor, 'Order #' || new.order_number || ' marked ' || new.fulfillment_status);
  end if;
  if new.payment_status is distinct from old.payment_status then
    insert into public.admin_activity_log (actor_email, action)
    values (v_actor, 'Order #' || new.order_number || ' payment marked ' || new.payment_status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_order_status on public.orders;
create trigger trg_log_order_status
  after update on public.orders
  for each row execute function public.log_order_status_change();

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  product_name  text not null,
  size          text,
  color         text,
  quantity      integer not null check (quantity > 0),
  unit_price    numeric(10,2) not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);

create or replace function public.bump_product_sales()
returns trigger language plpgsql as $$
begin
  update public.products set sales_count = sales_count + new.quantity where id = new.product_id;
  return new;
end;
$$;

drop trigger if exists trg_order_items_bump_sales on public.order_items;
create trigger trg_order_items_bump_sales
  after insert on public.order_items
  for each row execute function public.bump_product_sales();

create or replace function public.decrement_inventory_on_order()
returns trigger language plpgsql as $$
begin
  update public.product_inventory
    set available = greatest(available - new.quantity, 0),
        sold      = sold + new.quantity
    where product_id = new.product_id
      and size = new.size;
  return new;
end;
$$;

drop trigger if exists trg_order_items_decrement_inventory on public.order_items;
create trigger trg_order_items_decrement_inventory
  after insert on public.order_items
  for each row execute function public.decrement_inventory_on_order();

-- ============================================================================
-- 15. INVOICES
-- ============================================================================
create sequence if not exists public.invoice_number_seq start 1;

create table if not exists public.invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_number   text unique,
  order_id         uuid not null references public.orders(id) on delete cascade,
  amount           numeric(10,2) not null,
  status           invoice_status_type not null default 'Paid',
  issued_at        timestamptz not null default now()
);
create index if not exists idx_invoices_order on public.invoices(order_id);

create or replace function public.set_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.invoice_number is null then
    new.invoice_number := 'INV-' || to_char(now(), 'YYYY-MM') || '-' ||
                           lpad(nextval('public.invoice_number_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoices_number on public.invoices;
create trigger trg_invoices_number
  before insert on public.invoices
  for each row execute function public.set_invoice_number();

-- ============================================================================
-- 16. RETURNS
-- ============================================================================
create table if not exists public.returns (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  user_id        uuid references public.profiles(id) on delete set null,
  reason         text not null,
  status         return_status_type not null default 'Requested',
  refund_amount  numeric(10,2) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_returns_order on public.returns(order_id);
create index if not exists idx_returns_user on public.returns(user_id);

drop trigger if exists trg_returns_updated_at on public.returns;
create trigger trg_returns_updated_at
  before update on public.returns
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 17. PAYMENT METHODS / TRANSACTIONS / CARRIER TRACKING
-- ============================================================================
create table if not exists public.payment_methods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        payment_method_type not null,
  title       text not null,
  last4       text,
  expiry      text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_payment_methods_user on public.payment_methods(user_id);

create table if not exists public.payment_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  order_id    uuid references public.orders(id) on delete set null,
  type        transaction_type not null default 'Sale',
  method      text,
  amount      numeric(10,2) not null,
  fee         numeric(10,2) not null default 0,
  net         numeric(10,2) generated always as (amount - fee) stored,
  status      transaction_status_type not null default 'Completed',
  created_at  timestamptz not null default now()
);
create index if not exists idx_transactions_user on public.payment_transactions(user_id);
create index if not exists idx_transactions_order on public.payment_transactions(order_id);
create index if not exists idx_transactions_created on public.payment_transactions(created_at desc);

create table if not exists public.carrier_shipments (
  order_id uuid primary key references public.orders(id) on delete cascade,
  carrier text,
  tracking_number text,
  status text,
  estimated_delivery date,
  last_checked_at timestamptz,
  events jsonb not null default '[]'
);

-- ============================================================================
-- 18. CREDIT ACCOUNTS / TRANSACTIONS
-- ============================================================================
create table if not exists public.credit_accounts (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  balance     numeric(10,2) not null default 0,
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_credit_accounts_updated_at on public.credit_accounts;
create trigger trg_credit_accounts_updated_at
  before update on public.credit_accounts
  for each row execute function public.set_updated_at();

create table if not exists public.credit_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  amount        numeric(10,2) not null,
  reason        text,
  voucher_code  text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_credit_tx_user on public.credit_transactions(user_id);

create or replace function public.apply_credit_transaction()
returns trigger language plpgsql as $$
begin
  insert into public.credit_accounts (user_id, balance) values (new.user_id, new.amount)
  on conflict (user_id) do update set balance = public.credit_accounts.balance + new.amount, updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_credit_tx_apply on public.credit_transactions;
create trigger trg_credit_tx_apply
  after insert on public.credit_transactions
  for each row execute function public.apply_credit_transaction();

-- ============================================================================
-- 19. DISCOUNTS / REDEMPTIONS
-- ============================================================================
create table if not exists public.discounts (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  type          discount_type not null default 'Percentage',
  value         numeric(10,2) not null default 0,
  min_order     numeric(10,2) not null default 0,
  usage_limit   integer,
  used_count    integer not null default 0,
  starts_at     date not null default current_date,
  ends_at       date,
  status        discount_status_type not null default 'Active',
  description   text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_discounts_status on public.discounts(status);

create table if not exists public.discount_redemptions (
  id            uuid primary key default gen_random_uuid(),
  discount_id   uuid not null references public.discounts(id) on delete cascade,
  order_id      uuid references public.orders(id) on delete set null,
  user_id       uuid references public.profiles(id) on delete set null,
  redeemed_at   timestamptz not null default now()
);

create or replace function public.bump_discount_usage()
returns trigger language plpgsql as $$
begin
  update public.discounts set used_count = used_count + 1 where id = new.discount_id;
  return new;
end;
$$;

drop trigger if exists trg_discount_redeem on public.discount_redemptions;
create trigger trg_discount_redeem
  after insert on public.discount_redemptions
  for each row execute function public.bump_discount_usage();

create or replace function public.enforce_discount_usage_limit()
returns trigger language plpgsql as $$
declare
  v_limit integer;
  v_used integer;
begin
  select usage_limit, used_count into v_limit, v_used
  from public.discounts where id = new.discount_id
  for update;

  if v_limit is not null and v_used >= v_limit then
    raise exception 'Discount usage limit reached';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_discount_limit on public.discount_redemptions;
create trigger trg_enforce_discount_limit
  before insert on public.discount_redemptions
  for each row execute function public.enforce_discount_usage_limit();

-- ============================================================================
-- 20. CAMPAIGNS
-- ============================================================================
create table if not exists public.campaigns (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  subject        text,
  audience       text default 'All Customers',
  status         campaign_status_type not null default 'Draft',
  emails_sent    integer not null default 0,
  open_rate      numeric(5,2) not null default 0,
  clicks         integer not null default 0,
  orders_count   integer not null default 0,
  revenue        numeric(10,2) not null default 0,
  scheduled_at   date,
  created_at     timestamptz not null default now()
);

-- ============================================================================
-- 21. ABANDONED CARTS
-- ============================================================================
create table if not exists public.abandoned_carts (
  id                 uuid primary key default gen_random_uuid(),
  cart_id            uuid references public.carts(id) on delete set null,
  customer_email     text not null,
  cart_value         numeric(10,2) not null default 0,
  abandoned_at       timestamptz not null default now(),
  recovered          boolean not null default false,
  recovery_sent_at   timestamptz
);
create index if not exists idx_abandoned_carts_email on public.abandoned_carts(customer_email);

create or replace function public.detect_abandoned_carts()
returns void language plpgsql as $$
begin
  insert into public.abandoned_carts (cart_id, customer_email, cart_value, abandoned_at)
  select c.id, coalesce(p.email, 'guest'),
         coalesce(sum(ci.quantity * ci.price_at_add), 0), now()
  from public.carts c
  join public.cart_items ci on ci.cart_id = c.id
  left join public.profiles p on p.id = c.user_id
  where c.updated_at < now() - interval '24 hours'
    and not exists (select 1 from public.abandoned_carts ac where ac.cart_id = c.id)
  group by c.id, p.email
  having sum(ci.quantity * ci.price_at_add) > 0;
end;
$$;

select cron.schedule('detect-abandoned-carts', '0 * * * *', 'select public.detect_abandoned_carts();')
where not exists (select 1 from cron.job where jobname = 'detect-abandoned-carts');

-- ============================================================================
-- 22. ADMIN ACTIVITY LOG
-- ============================================================================
create table if not exists public.admin_activity_log (
  id           uuid primary key default gen_random_uuid(),
  actor_email  text,
  action       text not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_activity_created on public.admin_activity_log(created_at desc);

-- ============================================================================
-- 23. BANNERS + STAGED PRODUCTS
-- ============================================================================
create table if not exists public.banners (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  image        text not null,
  position     banner_position_type not null default 'Top',
  status       banner_status_type not null default 'Active',
  clicks       integer not null default 0,
  impressions  integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_banners_updated_at on public.banners;
create trigger trg_banners_updated_at
  before update on public.banners
  for each row execute function public.set_updated_at();

create table if not exists public.banner_products (
  banner_id   uuid not null references public.banners(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  position    integer not null default 0,
  primary key (banner_id, product_id)
);
create index if not exists idx_banner_products_banner on public.banner_products(banner_id);

create or replace function public.increment_banner_click(p_banner_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.banners set clicks = clicks + 1 where id = p_banner_id;
end;
$$;

create or replace function public.increment_banner_impression(p_banner_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.banners set impressions = impressions + 1 where id = p_banner_id;
end;
$$;

-- ============================================================================
-- 24. STORE SETTINGS
-- ============================================================================
create table if not exists public.store_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_settings_updated_at on public.store_settings;
create trigger trg_settings_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

insert into public.store_settings (key, value) values
  ('store_info', '{"name":"Notorious.Y2","support_email":"support@notorious.y2","phone":"+27 11 234 5678","timezone":"Africa/Johannesburg","currency":"ZAR","weight_unit":"kg"}'),
  ('store_address', '{"line1":"123 Main Street","city":"Johannesburg","state":"Gauteng","zip":"2000","country":"South Africa"}'),
  ('announcement_bar', '{"enabled":true,"text":"Free shipping on orders over R500","bg":"#000000","color":"#FFFFFF"}'),
  ('hero_section', '{"enabled":true,"eyebrow":"NOTORIOUS.Y2","headline":"Built for the Y2 generation.","description":"Contemporary streetwear with a nostalgic Y2K attitude.","button_text":"Shop Collection","product_ids":[],"image":""}'),
  ('featured_products', '{"enabled":true,"product_ids":[]}'),
  ('nav_items', '[{"label":"Shop","link":"/"},{"label":"About","link":"/about"},{"label":"Contact","link":"/contact"}]'),
  ('footer_settings', '{"email":"support@notorious.y2.com","phone":"+27 63 503 5882","copyright":"© 2025 NOTORIOUS.Y2","social":{"instagram":"https://instagram.com/notori.y2","tiktok":"https://tiktok.com/@notori.y2","facebook":"https://facebook.com/notori.y2","youtube":"https://youtube.com/@notori.Y2"}}'),
  ('storefront_toggles', '{"store_open":true,"multi_currency":true,"email_notifications":true}'),
  ('notification_prefs', '{"newOrders":true,"lowStock":true,"newCustomers":false,"dailySummary":true,"abandonedCart":true}'),
  ('payment_toggles', '{"cards":true,"paypal":true,"applePay":true,"googlePay":false,"eft":false}')
on conflict (key) do nothing;

-- ============================================================================
-- 25. ANALYTICS
-- ============================================================================
create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  event_type  text not null,
  path        text,
  referrer    text,
  device      text,
  country     text,
  session_id  text,
  user_id     uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_analytics_events_type_time on public.analytics_events(event_type, created_at desc);
create index if not exists idx_analytics_events_created_at on public.analytics_events(created_at desc);

create or replace function public.limit_analytics_rate()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.analytics_events
      where session_id = new.session_id
        and created_at > now() - interval '1 minute') > 60 then
    raise exception 'Rate limit exceeded';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limit_analytics_rate on public.analytics_events;
create trigger trg_limit_analytics_rate
  before insert on public.analytics_events
  for each row execute function public.limit_analytics_rate();

create or replace function public.normalize_traffic_device(p_device text)
returns text language sql immutable as $$
  select case
    when p_device is null then 'desktop'
    when lower(p_device) like '%mobile%' then 'mobile'
    when lower(p_device) like '%tablet%' then 'tablet'
    else 'desktop'
  end;
$$;

create or replace function public.normalize_traffic_source(p_referrer text)
returns text language plpgsql immutable as $$
declare
  v_host text;
begin
  if p_referrer is null or p_referrer = '' then
    return 'Direct';
  end if;

  begin
    v_host := lower(regexp_replace(split_part(split_part(p_referrer, '://', 2), '/', 1), '^www\.', ''));
  exception when others then
    return p_referrer;
  end;

  if v_host is null or v_host = '' then
    return p_referrer;
  end if;

  if v_host like '%instagram%' then return 'Instagram'; end if;
  if v_host like '%facebook%' then return 'Facebook'; end if;
  if v_host like '%tiktok%' then return 'TikTok'; end if;
  if v_host like '%google%' then return 'Google'; end if;
  if v_host like '%youtube%' then return 'YouTube'; end if;
  if v_host like '%twitter%' or v_host like '%x.com%' then return 'X / Twitter'; end if;

  return v_host;
end;
$$;

-- ============================================================================
-- 26. CONSENT TRACKING + ERASURE  (POPIA/GDPR)
-- ============================================================================
create table if not exists public.consent_records (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  email        text not null,
  consent_type text not null,
  granted      boolean not null,
  source       text not null,
  ip_address   text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_consent_user on public.consent_records(user_id);
create index if not exists idx_consent_email on public.consent_records(email);

create or replace function public.erase_user_personal_data(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  if not public.is_admin_write() then
    raise exception 'Not authorized';
  end if;

  delete from public.wishlist_items where user_id = p_user_id;
  delete from public.cart_items where cart_id in (select id from public.carts where user_id = p_user_id);
  delete from public.carts where user_id = p_user_id;
  delete from public.addresses where user_id = p_user_id;
  delete from public.payment_methods where user_id = p_user_id;
  update public.analytics_events set user_id = null where user_id = p_user_id;
  delete from public.consent_records where user_id = p_user_id;

  update public.orders
    set customer_name = 'Erased User', customer_email = 'erased@deleted.local',
        customer_phone = null, shipping_address = '{}'::jsonb, billing_address = '{}'::jsonb
    where user_id = p_user_id;

  update public.profiles
    set name = 'Erased User', email = 'erased-' || p_user_id || '@deleted.local',
        avatar = null, phone = null, date_of_birth = null, default_address = null
    where id = p_user_id;
end;
$$;

-- ============================================================================
-- 27. VIEWS
-- ============================================================================
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

create or replace view public.admin_customers_view as
select
  p.id as user_id,
  coalesce(p.name, split_part(p.email,'@',1)) as name,
  p.email,
  count(o.id) as orders,
  coalesce(sum(o.total), 0) as total_spent,
  max(o.created_at) as last_order,
  min(o.created_at) as first_purchase,
  case
    when coalesce(sum(o.total), 0) > 3000 then 'VIP'
    when count(o.id) > 5 then 'Active'
    when count(o.id) = 0 then 'Inactive'
    else 'Active'
  end as status,
  case when count(o.id) > 0 then round(coalesce(sum(o.total),0) / count(o.id), 2) else 0 end as average_order
from public.profiles p
left join public.orders o on o.user_id = p.id
group by p.id, p.name, p.email;

create or replace view public.admin_revenue_daily as
select date_trunc('day', o.created_at)::date as day, sum(o.total) as revenue, count(*) as orders
from public.orders o
where o.payment_status = 'Paid'
group by 1 order by 1;

create or replace view public.admin_kpis as
select
  (select coalesce(sum(total),0) from public.orders where payment_status = 'Paid') as revenue,
  (select count(*) from public.orders) as orders,
  (select case when count(*) > 0 then round(coalesce(sum(total),0)/count(*),2) else 0 end from public.orders) as average_order_value,
  (select count(*) from public.profiles) as customers,
  (select coalesce(sum(quantity),0) from public.order_items) as items_sold,
  (select case
     when (select coalesce(sum(views),0) from public.products) > 0
     then round((select coalesce(sum(sales_count),0) from public.products)::numeric /
                (select sum(views) from public.products) * 100, 2)
     else 0
   end) as conversion_rate;

create or replace view public.admin_inventory_view as
select
  p.id as product_id,
  p.name,
  'NY2-' || upper(substring(p.id::text from 1 for 8)) as sku,
  coalesce(sum(pi.available), 0) as total_available,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'size', pi.size, 'available', pi.available,
        'reserved', pi.reserved, 'sold', pi.sold
      ) order by pi.size
    ) filter (where pi.id is not null),
    '[]'::jsonb
  ) as sizes,
  case
    when coalesce(sum(pi.available), 0) = 0 then 'Out of Stock'
    when coalesce(sum(pi.available), 0) < 5 then 'Low Stock'
    else 'In Stock'
  end as status
from public.products p
left join public.product_inventory pi on pi.product_id = p.id
where p.is_staged = false
group by p.id, p.name
order by p.name;

create or replace view public.admin_order_status_counts as
select fulfillment_status, count(*) as count
from public.orders
group by fulfillment_status;

create or replace view public.admin_payment_status_counts as
select payment_status, count(*) as count
from public.orders
group by payment_status;

create or replace view public.revenue_by_category as
select
  category, revenue,
  case when total_revenue > 0 then round((revenue / total_revenue) * 100, 1) else 0 end as percentage
from (
  select
    coalesce(p.category::text, 'Other') as category,
    sum(oi.quantity * oi.unit_price) as revenue,
    sum(sum(oi.quantity * oi.unit_price)) over () as total_revenue
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  left join public.products p on p.id = oi.product_id
  where o.payment_status = 'Paid'
  group by coalesce(p.category::text, 'Other')
) t
order by revenue desc;

create or replace view public.revenue_by_country as
select
  country, revenue,
  case when total_revenue > 0 then round((revenue / total_revenue) * 100, 1) else 0 end as percentage
from (
  select
    coalesce(nullif(o.shipping_address ->> 'country', ''), 'Unknown') as country,
    sum(o.total) as revenue,
    sum(sum(o.total)) over () as total_revenue
  from public.orders o
  where o.payment_status = 'Paid'
  group by coalesce(nullif(o.shipping_address ->> 'country', ''), 'Unknown')
) t
order by revenue desc;

create or replace view public.revenue_by_payment as
select
  method, revenue,
  case when total_revenue > 0 then round((revenue / total_revenue) * 100, 1) else 0 end as percentage
from (
  select
    coalesce(nullif(pt.method, ''), 'Unknown') as method,
    sum(pt.amount) as revenue,
    sum(sum(pt.amount)) over () as total_revenue
  from public.payment_transactions pt
  where pt.type = 'Sale' and pt.status = 'Completed'
  group by coalesce(nullif(pt.method, ''), 'Unknown')
) t
order by revenue desc;

create or replace view public.analytics_daily_summary as
select
  date_trunc('day', created_at)::date as day, event_type,
  count(*) as event_count, count(distinct session_id) as unique_sessions
from public.analytics_events
group by 1, 2
order by 1 desc;

create or replace view public.analytics_daily_traffic as
select
  date_trunc('day', created_at)::date as day,
  event_type,
  public.normalize_traffic_device(device) as device,
  public.normalize_traffic_source(referrer) as source,
  coalesce(nullif(country, ''), 'Unknown') as country,
  count(*) as event_count,
  count(distinct session_id) as unique_sessions
from public.analytics_events
group by 1, 2, 3, 4, 5;

-- ============================================================================
-- 28. PRODUCT RPCs
-- ============================================================================
drop function if exists public.create_product_with_inventory(
  text, text, numeric, text, text[], public.product_category, public.product_status, boolean,
  text, text, text, text, numeric, numeric, integer, text, text[], jsonb
);

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
language plpgsql security definer set search_path = public as $$
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

  select array_agg(size) into v_valid_sizes from public.category_sizes where category = p_category;

  insert into public.product_inventory (product_id, size, available)
  select v_product_id, cs.size, greatest(0, coalesce((p_size_stocks ->> cs.size)::int, 0))
  from public.category_sizes cs where cs.category = p_category
  on conflict (product_id, size) do update set available = excluded.available;

  delete from public.product_inventory
  where product_id = v_product_id and size <> all (coalesce(v_valid_sizes, array[]::text[]));

  select to_jsonb(p.*) || jsonb_build_object(
    'sizes', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'size', pi.size, 'available', pi.available, 'reserved', pi.reserved, 'sold', pi.sold
              ) order by pi.size)
       from public.product_inventory pi where pi.product_id = p.id),
      '[]'::jsonb
    )
  ) into v_result from public.products p where p.id = v_product_id;

  return v_result;
end;
$$;

drop function if exists public.update_product_with_inventory(
  uuid, text, text, numeric, text, text[], public.product_category, public.product_status, boolean,
  text, text, text, text, numeric, numeric, integer, text, text[], jsonb
);

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
language plpgsql security definer set search_path = public as $$
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
    select array_agg(size) into v_valid_sizes from public.category_sizes where category = p_category;

    insert into public.product_inventory (product_id, size, available)
    select p_id, cs.size, greatest(0, coalesce((p_size_stocks ->> cs.size)::int, 0))
    from public.category_sizes cs where cs.category = p_category
    on conflict (product_id, size) do update set available = excluded.available;

    delete from public.product_inventory
    where product_id = p_id and size <> all (coalesce(v_valid_sizes, array[]::text[]));
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
                'size', pi.size, 'available', pi.available, 'reserved', pi.reserved, 'sold', pi.sold
              ) order by pi.size)
       from public.product_inventory pi where pi.product_id = p.id),
      '[]'::jsonb
    )
  ) into v_result from public.products p where p.id = p_id;

  return v_result;
end;
$$;

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
language plpgsql security definer set search_path = public as $$
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
    sold_out, force_sold_out, position_top, position_left,
    rotation, scale, z_index, description, features,
    show_on_floor, is_staged
  ) values (
    p_slug, p_name, p_price, p_image, coalesce(p_images, '{}'), p_category, 'Active',
    false, false, '0px', '0%',
    0, 1, 1, p_description, coalesce(p_features, '{}'),
    false, true
  )
  returning id into v_product_id;

  select array_agg(size) into v_valid_sizes from public.category_sizes where category = p_category;

  insert into public.product_inventory (product_id, size, available)
  select v_product_id, cs.size, greatest(0, coalesce((p_size_stocks ->> cs.size)::int, 0))
  from public.category_sizes cs where cs.category = p_category
  on conflict (product_id, size) do update set available = excluded.available;

  delete from public.product_inventory
  where product_id = v_product_id and size <> all (coalesce(v_valid_sizes, array[]::text[]));

  insert into public.banner_products (banner_id, product_id, position)
  values (p_banner_id, v_product_id, p_position)
  on conflict (banner_id, product_id) do update set position = excluded.position;

  select to_jsonb(p.*) || jsonb_build_object(
    'sizes', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'size', pi.size, 'available', pi.available, 'reserved', pi.reserved, 'sold', pi.sold
              ) order by pi.size)
       from public.product_inventory pi where pi.product_id = p.id),
      '[]'::jsonb
    )
  ) into v_result from public.products p where p.id = v_product_id;

  return v_result;
end;
$$;

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
language plpgsql security definer set search_path = public as $$
declare
  v_valid_sizes text[];
  v_result      jsonb;
begin
  if not public.is_admin_write() then
    raise exception 'Only admins can update products';
  end if;

  update public.products set
    name = p_name, price = p_price, image = p_image, images = coalesce(p_images, images),
    category = p_category, description = p_description, features = coalesce(p_features, features)
  where id = p_id and is_staged = true;

  if not found then
    raise exception 'Staged product % not found', p_id;
  end if;

  if p_size_stocks is not null then
    select array_agg(size) into v_valid_sizes from public.category_sizes where category = p_category;

    insert into public.product_inventory (product_id, size, available)
    select p_id, cs.size, greatest(0, coalesce((p_size_stocks ->> cs.size)::int, 0))
    from public.category_sizes cs where cs.category = p_category
    on conflict (product_id, size) do update set available = excluded.available;

    delete from public.product_inventory
    where product_id = p_id and size <> all (coalesce(v_valid_sizes, array[]::text[]));
  end if;

  select to_jsonb(p.*) || jsonb_build_object(
    'sizes', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'size', pi.size, 'available', pi.available, 'reserved', pi.reserved, 'sold', pi.sold
              ) order by pi.size)
       from public.product_inventory pi where pi.product_id = p.id),
      '[]'::jsonb
    )
  ) into v_result from public.products p where p.id = p_id;

  return v_result;
end;
$$;

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
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if not public.is_admin_write() then
    raise exception 'Only admins can promote products';
  end if;

  update public.products set
    is_staged = false, show_on_floor = true,
    position_top = p_position_top, position_left = p_position_left,
    mobile_position_top = p_mobile_position_top, mobile_position_left = p_mobile_position_left,
    rotation = p_rotation, scale = p_scale, z_index = p_z_index
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
-- 29. ORDER RPC
-- ============================================================================
create or replace function public.create_order_with_items(
  p_user_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_currency_code text,
  p_shipping_address jsonb,
  p_billing_address jsonb,
  p_discount_code text,
  p_payment_method text,
  p_items jsonb
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_subtotal numeric := 0;
  v_discount_amount numeric := 0;
  v_tax numeric;
  v_shipping numeric := 0;
  v_total numeric;
  v_order_id uuid;
  v_order_number text;
  v_discount record;
  v_item record;
  v_unit_price numeric;
begin
  for v_item in select * from jsonb_to_recordset(p_items)
    as x(product_id uuid, product_name text, size text, color text, quantity int)
  loop
    select price into v_unit_price from public.products where id = v_item.product_id;
    if v_unit_price is null then
      raise exception 'Unknown product %', v_item.product_id;
    end if;
    v_subtotal := v_subtotal + (v_unit_price * v_item.quantity);
  end loop;

  if p_discount_code is not null then
    select * into v_discount from public.discounts
      where code = upper(p_discount_code) and status = 'Active'
        and starts_at <= current_date
        and (ends_at is null or ends_at >= current_date)
        and (usage_limit is null or used_count < usage_limit);
    if found and v_subtotal >= v_discount.min_order then
      if v_discount.type = 'Percentage' then
        v_discount_amount := v_subtotal * (v_discount.value / 100);
      elsif v_discount.type = 'Fixed' then
        v_discount_amount := least(v_discount.value, v_subtotal);
      end if;
    end if;
  end if;

  v_tax := greatest(0, v_subtotal - v_discount_amount) * 0.15;
  v_total := v_subtotal + v_shipping + v_tax - v_discount_amount;

  insert into public.orders (
    user_id, customer_name, customer_email, customer_phone,
    subtotal, shipping, tax, total, currency_code,
    payment_status, fulfillment_status,
    shipping_address, billing_address, discount_code, discount_amount
  ) values (
    p_user_id, p_customer_name, p_customer_email, p_customer_phone,
    v_subtotal, v_shipping, v_tax, v_total, coalesce(p_currency_code, 'ZAR'),
    'Paid', 'Processing',
    p_shipping_address, p_billing_address, p_discount_code, v_discount_amount
  )
  returning id, order_number into v_order_id, v_order_number;

  insert into public.order_items (order_id, product_id, product_name, size, color, quantity, unit_price)
  select v_order_id, (x->>'product_id')::uuid, x->>'product_name', x->>'size', x->>'color',
         (x->>'quantity')::int,
         (select price from public.products where id = (x->>'product_id')::uuid)
  from jsonb_array_elements(p_items) x;

  if p_discount_code is not null and v_discount.id is not null then
    insert into public.discount_redemptions (discount_id, order_id, user_id)
    values (v_discount.id, v_order_id, p_user_id);
  end if;

  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total', v_total);
end;
$$;

-- ============================================================================
-- 30. RECOMMENDATIONS RPC
-- ============================================================================
create or replace function public.match_products(
  p_product_id uuid,
  p_match_count int default 8
)
returns table(id uuid, similarity float)
language sql stable as $$
  select p2.id, 1 - (p2.embedding <=> p1.embedding) as similarity
  from public.products p1
  join public.products p2 on p2.id != p1.id
  where p1.id = p_product_id
    and p1.embedding is not null
    and p2.embedding is not null
    and p2.is_staged = false
    and p2.status = 'Active'
  order by p2.embedding <=> p1.embedding
  limit p_match_count;
$$;

-- ============================================================================
-- 31. ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles              enable row level security;
alter table public.addresses             enable row level security;
alter table public.currencies            enable row level security;
alter table public.products              enable row level security;
alter table public.product_inventory     enable row level security;
alter table public.inventory_history     enable row level security;
alter table public.product_views         enable row level security;
alter table public.stock_notifications   enable row level security;
alter table public.carts                 enable row level security;
alter table public.cart_items            enable row level security;
alter table public.wishlist_items        enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.invoices              enable row level security;
alter table public.returns               enable row level security;
alter table public.payment_methods       enable row level security;
alter table public.payment_transactions  enable row level security;
alter table public.carrier_shipments     enable row level security;
alter table public.credit_accounts       enable row level security;
alter table public.credit_transactions   enable row level security;
alter table public.discounts             enable row level security;
alter table public.discount_redemptions  enable row level security;
alter table public.campaigns             enable row level security;
alter table public.abandoned_carts       enable row level security;
alter table public.admin_activity_log    enable row level security;
alter table public.admin_notifications   enable row level security;
alter table public.banners               enable row level security;
alter table public.banner_products       enable row level security;
alter table public.store_settings        enable row level security;
alter table public.admin_email_allowlist enable row level security;
alter table public.analytics_events      enable row level security;
alter table public.category_sizes        enable row level security;
alter table public.consent_records       enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles for update using (id = auth.uid() or public.is_admin());

drop policy if exists "addresses_owner_or_admin" on public.addresses;
create policy "addresses_owner_or_admin" on public.addresses for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "currencies_public_read" on public.currencies;
create policy "currencies_public_read" on public.currencies for select using (true);
drop policy if exists "currencies_admin_write" on public.currencies;
create policy "currencies_admin_write" on public.currencies for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select using (true);
drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products for insert with check (public.is_admin_write());
drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update" on public.products for update using (public.is_admin_write());
drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete" on public.products for delete using (public.is_admin_write());

drop policy if exists "inventory_public_read" on public.product_inventory;
create policy "inventory_public_read" on public.product_inventory for select using (true);
drop policy if exists "inventory_admin_write" on public.product_inventory;
create policy "inventory_admin_write" on public.product_inventory for all using (public.is_admin_write()) with check (public.is_admin_write());

drop policy if exists "inventory_history_admin_only" on public.inventory_history;
create policy "inventory_history_admin_only" on public.inventory_history for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "product_views_insert_anyone" on public.product_views;
create policy "product_views_insert_anyone" on public.product_views for insert with check (true);
drop policy if exists "product_views_admin_read" on public.product_views;
create policy "product_views_admin_read" on public.product_views for select using (public.is_admin());

drop policy if exists "stock_notifications_insert_anyone" on public.stock_notifications;
create policy "stock_notifications_insert_anyone" on public.stock_notifications for insert with check (true);
drop policy if exists "stock_notifications_admin_read" on public.stock_notifications;
create policy "stock_notifications_admin_read" on public.stock_notifications for select using (public.is_admin());

drop policy if exists "carts_owner_or_admin" on public.carts;
create policy "carts_owner_or_admin" on public.carts for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "cart_items_owner_or_admin" on public.cart_items;
create policy "cart_items_owner_or_admin" on public.cart_items for all using (
  public.is_admin() or exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = auth.uid())
) with check (
  public.is_admin() or exists (select 1 from public.carts c where c.id = cart_items.cart_id and c.user_id = auth.uid())
);

drop policy if exists "wishlist_owner_or_admin" on public.wishlist_items;
create policy "wishlist_owner_or_admin" on public.wishlist_items for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders_owner_or_admin_select" on public.orders;
create policy "orders_owner_or_admin_select" on public.orders for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "orders_insert_self_or_admin" on public.orders;
create policy "orders_insert_self_or_admin" on public.orders for insert with check (user_id = auth.uid() or user_id is null or public.is_admin());
drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders for update using (public.is_admin_write());
drop policy if exists "orders_claim_guest" on public.orders;
create policy "orders_claim_guest" on public.orders for update using (
  user_id is null and customer_email = auth.jwt() ->> 'email'
);

drop policy if exists "order_items_owner_or_admin" on public.order_items;
create policy "order_items_owner_or_admin" on public.order_items for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
);
drop policy if exists "order_items_insert_self_or_admin" on public.order_items;
create policy "order_items_insert_self_or_admin" on public.order_items for insert with check (
  public.is_admin() or exists (select 1 from public.orders o where o.id = order_items.order_id and (o.user_id = auth.uid() or o.user_id is null))
);

drop policy if exists "invoices_owner_or_admin" on public.invoices;
create policy "invoices_owner_or_admin" on public.invoices for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = invoices.order_id and o.user_id = auth.uid())
);
drop policy if exists "invoices_admin_write" on public.invoices;
create policy "invoices_admin_write" on public.invoices for all using (public.is_admin_write()) with check (public.is_admin_write());

drop policy if exists "returns_owner_or_admin" on public.returns;
create policy "returns_owner_or_admin" on public.returns for all using (user_id = auth.uid() or public.is_admin_write()) with check (user_id = auth.uid() or public.is_admin_write());

drop policy if exists "payment_methods_owner_or_admin" on public.payment_methods;
create policy "payment_methods_owner_or_admin" on public.payment_methods for all using (user_id = auth.uid() or public.is_admin_write()) with check (user_id = auth.uid() or public.is_admin_write());

drop policy if exists "transactions_owner_or_admin" on public.payment_transactions;
create policy "transactions_owner_or_admin" on public.payment_transactions for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "transactions_insert_self_or_admin" on public.payment_transactions;
create policy "transactions_insert_self_or_admin" on public.payment_transactions for insert with check (user_id = auth.uid() or user_id is null or public.is_admin());
drop policy if exists "transactions_admin_write" on public.payment_transactions;
create policy "transactions_admin_write" on public.payment_transactions for all using (public.is_admin_write()) with check (public.is_admin_write());

drop policy if exists "carrier_shipments_owner_or_admin" on public.carrier_shipments;
create policy "carrier_shipments_owner_or_admin" on public.carrier_shipments for select using (
  public.is_admin() or exists (select 1 from public.orders o where o.id = carrier_shipments.order_id and o.user_id = auth.uid())
);
drop policy if exists "carrier_shipments_admin_write" on public.carrier_shipments;
create policy "carrier_shipments_admin_write" on public.carrier_shipments for all using (public.is_admin_write()) with check (public.is_admin_write());

drop policy if exists "credit_accounts_owner_or_admin" on public.credit_accounts;
create policy "credit_accounts_owner_or_admin" on public.credit_accounts for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "credit_tx_owner_or_admin" on public.credit_transactions;
create policy "credit_tx_owner_or_admin" on public.credit_transactions for all using (user_id = auth.uid() or public.is_admin_write()) with check (user_id = auth.uid() or public.is_admin_write());

drop policy if exists "discounts_public_read_active" on public.discounts;
create policy "discounts_public_read_active" on public.discounts for select using (status = 'Active' or public.is_admin());
drop policy if exists "discounts_admin_write" on public.discounts;
create policy "discounts_admin_write" on public.discounts for all using (public.is_admin_write()) with check (public.is_admin_write());

drop policy if exists "discount_redemptions_admin_or_owner" on public.discount_redemptions;
create policy "discount_redemptions_admin_or_owner" on public.discount_redemptions for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "campaigns_admin_only" on public.campaigns;
drop policy if exists "campaigns_admin_read" on public.campaigns;
create policy "campaigns_admin_read" on public.campaigns for select using (public.is_admin());
drop policy if exists "campaigns_admin_write" on public.campaigns;
create policy "campaigns_admin_write" on public.campaigns for insert with check (public.is_admin_write());
drop policy if exists "campaigns_admin_update" on public.campaigns;
create policy "campaigns_admin_update" on public.campaigns for update using (public.is_admin_write());
drop policy if exists "campaigns_admin_delete" on public.campaigns;
create policy "campaigns_admin_delete" on public.campaigns for delete using (public.is_admin_write());

drop policy if exists "abandoned_carts_admin_only" on public.abandoned_carts;
create policy "abandoned_carts_admin_only" on public.abandoned_carts for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "activity_log_admin_only" on public.admin_activity_log;
create policy "activity_log_admin_only" on public.admin_activity_log for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "notifications_admin_only" on public.admin_notifications;
create policy "notifications_admin_only" on public.admin_notifications for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "banners_public_read" on public.banners;
create policy "banners_public_read" on public.banners for select using (true);
drop policy if exists "banners_admin_write" on public.banners;
create policy "banners_admin_write" on public.banners for insert with check (public.is_admin_write());
drop policy if exists "banners_admin_update" on public.banners;
create policy "banners_admin_update" on public.banners for update using (public.is_admin_write());
drop policy if exists "banners_admin_delete" on public.banners;
create policy "banners_admin_delete" on public.banners for delete using (public.is_admin_write());

drop policy if exists "banner_products_public_read" on public.banner_products;
create policy "banner_products_public_read" on public.banner_products for select using (true);
drop policy if exists "banner_products_admin_write" on public.banner_products;
create policy "banner_products_admin_write" on public.banner_products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings_public_read" on public.store_settings;
create policy "settings_public_read" on public.store_settings for select using (true);
drop policy if exists "settings_admin_write" on public.store_settings;
create policy "settings_admin_write" on public.store_settings for all using (public.is_admin_write()) with check (public.is_admin_write());

drop policy if exists "admin_allowlist_admin_only" on public.admin_email_allowlist;
drop policy if exists "admin_allowlist_admin_read" on public.admin_email_allowlist;
create policy "admin_allowlist_admin_read" on public.admin_email_allowlist for select using (public.is_admin());
drop policy if exists "admin_allowlist_admin_write" on public.admin_email_allowlist;
create policy "admin_allowlist_admin_write" on public.admin_email_allowlist for insert with check (public.is_admin_write());
drop policy if exists "admin_allowlist_admin_update" on public.admin_email_allowlist;
create policy "admin_allowlist_admin_update" on public.admin_email_allowlist for update using (public.is_admin_write());
drop policy if exists "admin_allowlist_admin_delete" on public.admin_email_allowlist;
create policy "admin_allowlist_admin_delete" on public.admin_email_allowlist for delete using (public.is_admin_write());

drop policy if exists "analytics_events_insert_anyone" on public.analytics_events;
create policy "analytics_events_insert_anyone" on public.analytics_events for insert with check (true);
drop policy if exists "analytics_events_admin_read" on public.analytics_events;
create policy "analytics_events_admin_read" on public.analytics_events for select using (public.is_admin());

drop policy if exists "category_sizes_public_read" on public.category_sizes;
create policy "category_sizes_public_read" on public.category_sizes for select using (true);
drop policy if exists "category_sizes_admin_write" on public.category_sizes;
create policy "category_sizes_admin_write" on public.category_sizes for all using (public.is_admin_write()) with check (public.is_admin_write());

drop policy if exists "consent_owner_or_admin" on public.consent_records;
create policy "consent_owner_or_admin" on public.consent_records for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "consent_insert_self_or_guest" on public.consent_records;
create policy "consent_insert_self_or_guest" on public.consent_records for insert with check (user_id = auth.uid() or user_id is null);

-- ============================================================================
-- 32. STORAGE BUCKETS
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects for insert with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects for update using (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects for delete using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "banners_public_read_storage" on storage.objects;
create policy "banners_public_read_storage" on storage.objects for select using (bucket_id = 'banners');
drop policy if exists "banners_admin_insert_storage" on storage.objects;
create policy "banners_admin_insert_storage" on storage.objects for insert with check (bucket_id = 'banners' and public.is_admin());
drop policy if exists "banners_admin_update_storage" on storage.objects;
create policy "banners_admin_update_storage" on storage.objects for update using (bucket_id = 'banners' and public.is_admin());
drop policy if exists "banners_admin_delete_storage" on storage.objects;
create policy "banners_admin_delete_storage" on storage.objects for delete using (bucket_id = 'banners' and public.is_admin());

-- ============================================================================
-- 33. INDEXES  (consolidated from all migrations, deduplicated)
-- ============================================================================
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_products_is_staged on public.products(is_staged);
create index if not exists idx_products_floor_active on public.products (z_index) where status = 'Active' and is_staged = false;
create index if not exists idx_products_status_staged on public.products (status, is_staged);
create index if not exists idx_products_floor_query on public.products (status, is_staged, z_index);
create index if not exists idx_products_recs_pool on public.products (status, is_staged, sales_count desc);

-- ---- vector index for semantic recommendations (match_products) ----
-- HNSW is the modern/preferred pgvector index (better recall + query speed
-- than ivfflat, and doesn't need a row-count-dependent `lists` tuning
-- parameter). Requires pgvector >= 0.5.0, which Supabase ships by default.
-- Cosine distance matches the `<=>` operator used in match_products().
create index if not exists idx_products_embedding_hnsw
  on public.products using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

-- ---- full-text search ----
-- Products: server-side search to replace client-side `.includes()`
-- filtering in AdminProducts.tsx and SearchOverlay.tsx. Generated column
-- keeps the tsvector always in sync with name/description without a
-- maintenance trigger.
alter table public.products
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index if not exists idx_products_search_vector
  on public.products using gin (search_vector);

-- Orders/customers: server-side search to replace client-side filtering
-- in AdminOrders.tsx / AdminCustomers.tsx (order number, customer name/email).
alter table public.orders
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(order_number, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(customer_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(customer_email, '')), 'B')
  ) stored;

create index if not exists idx_orders_search_vector
  on public.orders using gin (search_vector);

create index if not exists idx_product_inventory_product on public.product_inventory(product_id);
create index if not exists idx_inventory_history_product on public.inventory_history(product_id);
create index if not exists idx_product_views_product on public.product_views(product_id);
create index if not exists idx_addresses_user on public.addresses(user_id);
create index if not exists idx_carts_session on public.carts(session_id);
create index if not exists idx_cart_items_cart on public.cart_items(cart_id);
create index if not exists idx_cart_items_product on public.cart_items(product_id);
create index if not exists idx_wishlist_user on public.wishlist_items(user_id);
create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_orders_email on public.orders(customer_email);
create index if not exists idx_orders_created on public.orders(created_at desc);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_fulfillment_status on public.orders(fulfillment_status);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_order_items_product on public.order_items(product_id);
create index if not exists idx_invoices_order on public.invoices(order_id);
create index if not exists idx_returns_order on public.returns(order_id);
create index if not exists idx_returns_user on public.returns(user_id);
create index if not exists idx_payment_methods_user on public.payment_methods(user_id);
create index if not exists idx_transactions_user on public.payment_transactions(user_id);
create index if not exists idx_transactions_order on public.payment_transactions(order_id);
create index if not exists idx_transactions_created on public.payment_transactions(created_at desc);
create index if not exists idx_credit_tx_user on public.credit_transactions(user_id);
create index if not exists idx_discounts_status on public.discounts(status);
create index if not exists idx_abandoned_carts_email on public.abandoned_carts(customer_email);
create index if not exists idx_activity_created on public.admin_activity_log(created_at desc);
create index if not exists idx_notifications_read on public.admin_notifications(read);
create index if not exists idx_analytics_events_type_time on public.analytics_events(event_type, created_at desc);
create index if not exists idx_analytics_events_created_at on public.analytics_events(created_at desc);
create index if not exists idx_banner_products_banner on public.banner_products(banner_id);
create index if not exists idx_consent_user on public.consent_records(user_id);
create index if not exists idx_consent_email on public.consent_records(email);

-- ============================================================================
-- 34. RUNTIME SETTINGS
-- ============================================================================
alter role authenticated set statement_timeout = '8000';
alter role anon set statement_timeout = '8000';

-- ============================================================================
-- 35. GRANTS
--     Table-level GRANTs, kept together (rather than scattered next to each
--     "create table") so the full anon/authenticated permission surface is
--     auditable in one place. RLS policies above still govern which ROWS
--     each grant can reach — these grants only get a role past Postgres's
--     first-layer permission check so RLS is even evaluated.
--
--     Rule of thumb applied throughout: any table a role INSERTs into also
--     gets SELECT, because PostgREST always runs inserts as
--     "INSERT ... RETURNING *" under the hood regardless of the
--     Prefer: return=minimal header.
-- ============================================================================
grant usage on schema public to anon, authenticated;

-- Public-read tables (storefront needs SELECT as anon)
grant select on public.products                to anon, authenticated;
grant select on public.product_inventory       to anon, authenticated;
grant select on public.currencies              to anon, authenticated;
grant select on public.banners                 to anon, authenticated;
grant select on public.banner_products         to anon, authenticated;
grant select on public.store_settings          to anon, authenticated;
grant select on public.discounts               to anon, authenticated;
grant select on public.category_sizes          to anon, authenticated;
grant select on public.admin_products_view     to anon, authenticated;

-- Anon insert paths (need SELECT alongside INSERT — see rule of thumb above)
grant select, insert on public.analytics_events     to anon, authenticated;
grant select, insert on public.product_views        to anon, authenticated;
grant select, insert on public.stock_notifications  to anon, authenticated;
grant select, insert on public.consent_records      to anon, authenticated;
grant select, insert on public.orders               to anon;
grant select, insert on public.order_items          to anon;

-- Full CRUD for authenticated users (their own rows, enforced by RLS)
grant select, insert, update, delete on public.profiles              to authenticated;
grant select, insert, update, delete on public.addresses             to authenticated;
grant select, insert, update, delete on public.carts                 to authenticated;
grant select, insert, update, delete on public.cart_items            to authenticated;
grant select, insert, update, delete on public.wishlist_items        to authenticated;
grant select, insert, update           on public.orders                to authenticated;
grant select, insert                   on public.order_items           to authenticated;
grant select                            on public.invoices              to authenticated;
grant select, insert, update           on public.returns               to authenticated;
grant select, insert, update, delete on public.payment_methods       to authenticated;
grant select, insert                   on public.payment_transactions  to authenticated;
grant select                            on public.carrier_shipments     to authenticated;
grant select                            on public.credit_accounts       to authenticated;
grant select, insert                   on public.credit_transactions  to authenticated;
grant select, insert                   on public.discount_redemptions  to authenticated;

-- Admin-only tables — RLS's is_admin()/is_admin_write() restricts rows,
-- but the role still needs the base grant to get past 42501.
grant select, insert, update, delete on public.admin_notifications    to authenticated;
grant select, insert                   on public.admin_activity_log    to authenticated;
grant select, insert, update, delete on public.admin_email_allowlist  to authenticated;
grant select, insert, update, delete on public.inventory_history      to authenticated;
grant select, insert, update, delete on public.abandoned_carts        to authenticated;
grant select, insert, update, delete on public.campaigns              to authenticated;

-- Sequences (nextval()/identity columns touched by the triggers above,
-- e.g. order_number_seq, invoice_number_seq, product_views' identity col)
grant usage, select on all sequences in schema public to anon, authenticated;

-- Functions/RPCs the app calls directly
grant execute on function public.create_order_with_items(uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb) to anon, authenticated;
grant execute on function public.match_products(uuid, int) to anon, authenticated;
grant execute on function public.increment_banner_click(uuid) to anon, authenticated;
grant execute on function public.increment_banner_impression(uuid) to anon, authenticated;
grant execute on function public.get_category_sizes(public.product_category) to anon, authenticated;

-- Admin-only RPCs — authenticated only; is_admin_write() inside enforces the rest
grant execute on function public.create_product_with_inventory(text, text, numeric, text, text[], public.product_category, public.product_status, boolean, text, text, text, text, numeric, numeric, integer, text, text[], jsonb, boolean) to authenticated;
grant execute on function public.update_product_with_inventory(uuid, text, text, numeric, text, text[], public.product_category, public.product_status, boolean, text, text, text, text, numeric, numeric, integer, text, text[], jsonb, boolean) to authenticated;
grant execute on function public.create_staged_banner_product(uuid, text, text, numeric, text, text[], public.product_category, text, text[], jsonb, integer) to authenticated;
grant execute on function public.update_staged_banner_product(uuid, text, numeric, text, text[], public.product_category, text, text[], jsonb) to authenticated;
grant execute on function public.promote_staged_product(uuid, text, text, text, text, numeric, numeric, integer) to authenticated;
grant execute on function public.erase_user_personal_data(uuid) to authenticated;

-- Make future tables get sane default grants automatically
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- ============================================================================
-- DONE. Follow with a separate seed script for the 38-product catalog,
-- per-size inventory rows, and discount codes — kept out of this file
-- deliberately so it stays safe to re-run against a live database.
-- ============================================================================