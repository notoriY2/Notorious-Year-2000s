-- The upsert in notifyWhenInStock() needs UPDATE for its ON CONFLICT
-- DO UPDATE branch — insert-only was never enough.
grant select, insert, update on public.stock_notifications to anon, authenticated;

-- RLS also needs an update policy — insert-anyone existed, but there
-- was no matching update policy, so RLS would still block the
-- conflict-path update even after the grant above.
drop policy if exists "stock_notifications_update_anyone" on public.stock_notifications;
create policy "stock_notifications_update_anyone" on public.stock_notifications
  for update using (true) with check (true);