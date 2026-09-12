create or replace function public.handle_inventory_change()
returns trigger language plpgsql as $$
declare
  v_product_id uuid;
  v_total integer;
  v_force boolean;
  v_name text;
begin
  v_product_id := coalesce(new.product_id, old.product_id);

  select coalesce(sum(available), 0) into v_total
    from public.product_inventory where product_id = v_product_id;

  select force_sold_out, name into v_force, v_name
    from public.products where id = v_product_id;

  update public.products
    set stock = v_total, sold_out = (v_total = 0) or coalesce(v_force, false)
    where id = v_product_id;

  if tg_op in ('INSERT', 'UPDATE') and new.available < 5
     and (tg_op = 'INSERT' or old.available >= 5) then
    insert into public.admin_notifications (title, description, type)
    values ('Low Stock Alert', coalesce(v_name, 'A product') || ' (' || new.size || ') is down to ' || v_total || ' items.', 'stock');
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_inventory_recalc on public.product_inventory;
drop trigger if exists trg_notify_low_stock on public.product_inventory;
create trigger trg_inventory_change
  after insert or update or delete on public.product_inventory
  for each row execute function public.handle_inventory_change();

create or replace function public.handle_order_item_insert()
returns trigger language plpgsql as $$
begin
  update public.product_inventory
    set available = greatest(available - new.quantity, 0),
        sold      = sold + new.quantity
    where product_id = new.product_id and size = new.size;

  update public.products
    set sales_count = sales_count + new.quantity
    where id = new.product_id;

  return new;
end;
$$;

drop trigger if exists trg_order_items_decrement_inventory on public.order_items;
drop trigger if exists trg_order_items_bump_sales on public.order_items;
create trigger trg_order_item_insert
  after insert on public.order_items
  for each row execute function public.handle_order_item_insert();