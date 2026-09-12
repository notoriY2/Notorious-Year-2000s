-- Storage: these still check is_admin() instead of is_admin_write(),
-- so a Viewer can write/delete storage objects directly via the client.
drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin_write());
drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin_write());
drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin_write());

drop policy if exists "banners_admin_insert_storage" on storage.objects;
create policy "banners_admin_insert_storage" on storage.objects
  for insert with check (bucket_id = 'banners' and public.is_admin_write());
drop policy if exists "banners_admin_update_storage" on storage.objects;
create policy "banners_admin_update_storage" on storage.objects
  for update using (bucket_id = 'banners' and public.is_admin_write());
drop policy if exists "banners_admin_delete_storage" on storage.objects;
create policy "banners_admin_delete_storage" on storage.objects
  for delete using (bucket_id = 'banners' and public.is_admin_write());

-- Notifications: split read (is_admin) from write (is_admin_write).
drop policy if exists "notifications_admin_only" on public.admin_notifications;
create policy "notifications_admin_read" on public.admin_notifications
  for select using (public.is_admin());
create policy "notifications_admin_write" on public.admin_notifications
  for all using (public.is_admin_write()) with check (public.is_admin_write());

-- Activity log: append-only, even for full Admins.
drop policy if exists "activity_log_admin_only" on public.admin_activity_log;
create policy "activity_log_admin_read" on public.admin_activity_log
  for select using (public.is_admin());
create policy "activity_log_admin_write" on public.admin_activity_log
  for insert with check (public.is_admin_write());

-- Abandoned carts.
drop policy if exists "abandoned_carts_admin_only" on public.abandoned_carts;
create policy "abandoned_carts_admin_read" on public.abandoned_carts
  for select using (public.is_admin());
create policy "abandoned_carts_admin_write" on public.abandoned_carts
  for all using (public.is_admin_write()) with check (public.is_admin_write());

-- Discount redemptions.
drop policy if exists "discount_redemptions_admin_or_owner" on public.discount_redemptions;
create policy "discount_redemptions_read" on public.discount_redemptions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "discount_redemptions_write" on public.discount_redemptions
  for insert with check (user_id = auth.uid() or public.is_admin_write());

-- Inventory history.
drop policy if exists "inventory_history_admin_only" on public.inventory_history;
create policy "inventory_history_admin_read" on public.inventory_history
  for select using (public.is_admin());
create policy "inventory_history_admin_write" on public.inventory_history
  for insert with check (public.is_admin_write());