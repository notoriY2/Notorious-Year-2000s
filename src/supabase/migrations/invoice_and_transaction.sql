create or replace function public.create_order_financial_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'Paid' then
    insert into public.invoices (order_id, amount, status)
    values (new.id, new.total, 'Paid');

    insert into public.payment_transactions (user_id, order_id, type, method, amount, fee, status)
    values (new.user_id, new.id, 'Sale', coalesce(new.payment_method, 'Credit Card'), new.total, 0, 'Completed');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_create_order_financial_records on public.orders;
create trigger trg_create_order_financial_records
  after insert on public.orders
  for each row execute function public.create_order_financial_records();

-- Also record a refund transaction when an admin marks an order Refunded
-- (AdminOrders.tsx's handleRefund calls updateOrderStatus with paymentStatus).
create or replace function public.create_refund_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'Refunded' and old.payment_status is distinct from 'Refunded' then
    insert into public.payment_transactions (user_id, order_id, type, method, amount, fee, status)
    values (new.user_id, new.id, 'Refund', coalesce(new.payment_method, 'Credit Card'), -new.total, 0, 'Completed');

    update public.invoices set status = 'Void' where order_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_create_refund_transaction on public.orders;
create trigger trg_create_refund_transaction
  after update on public.orders
  for each row execute function public.create_refund_transaction();