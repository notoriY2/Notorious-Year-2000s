create table if not exists public.stock_notifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  size text not null,
  email text not null,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  unique(product_id, size, email)
);

alter table public.stock_notifications enable row level security;

drop policy if exists "stock_notifications_insert_anyone" on public.stock_notifications;
create policy "stock_notifications_insert_anyone" on public.stock_notifications
  for insert with check (true);

drop policy if exists "stock_notifications_admin_read" on public.stock_notifications;
create policy "stock_notifications_admin_read" on public.stock_notifications
  for select using (public.is_admin());

create or replace function public.notify_back_in_stock()
returns trigger language plpgsql as $$
begin
  if old.available = 0 and new.available > 0 then
    update public.stock_notifications
      set notified = false
    where product_id = new.product_id and size = new.size and notified = false;
    -- Actual email send handled by an Edge Function cron polling notified=false rows.
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_back_in_stock on public.product_inventory;
create trigger trg_notify_back_in_stock
  after update on public.product_inventory
  for each row execute function public.notify_back_in_stock();


drop policy if exists "orders_claim_guest" on public.orders;
create policy "orders_claim_guest" on public.orders
  for update using (
    user_id is null and customer_email = auth.jwt() ->> 'email'
  );