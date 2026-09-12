create table if not exists public.carrier_shipments (
  order_id uuid primary key references public.orders(id) on delete cascade,
  carrier text,
  tracking_number text,
  status text,
  estimated_delivery date,
  last_checked_at timestamptz,
  events jsonb not null default '[]'
);

alter table public.carrier_shipments enable row level security;

drop policy if exists "carrier_shipments_owner_or_admin" on public.carrier_shipments;
create policy "carrier_shipments_owner_or_admin" on public.carrier_shipments
  for select using (
    public.is_admin() or
    exists (select 1 from public.orders o where o.id = carrier_shipments.order_id and o.user_id = auth.uid())
  );

drop policy if exists "carrier_shipments_admin_write" on public.carrier_shipments;
create policy "carrier_shipments_admin_write" on public.carrier_shipments
  for all using (public.is_admin_write()) with check (public.is_admin_write());