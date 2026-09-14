-- ============================================================================
-- FIX: "record "v_discount" is not assigned yet" (55000) breaking checkout
--
-- Root cause: v_discount is a plain `record` that is only populated when
-- p_discount_code is supplied AND a matching active discount is found. The
-- function later unconditionally reads v_discount.id outside that guard,
-- which is undefined behavior on an unassigned record in PL/pgSQL and
-- raises 55000 for every order — discounted or not.
--
-- Fix: track whether a discount was actually resolved with a plain uuid
-- variable (v_discount_id) set only inside the "found" branch, and use
-- that for the later redemption-insert check instead of touching the
-- record directly.
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
  p_items jsonb,
  p_idempotency_key text default null
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
  v_discount_id uuid;              -- NEW: tracks whether a discount actually resolved
  v_item record;
  v_unit_price numeric;
  v_existing record;
begin
  if p_idempotency_key is not null then
    select id, order_number, total into v_existing
      from public.orders where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('id', v_existing.id, 'order_number', v_existing.order_number, 'total', v_existing.total);
    end if;
  end if;

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
      v_discount_id := v_discount.id;
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
    shipping_address, billing_address, discount_code, discount_amount,
    idempotency_key
  ) values (
    p_user_id, p_customer_name, p_customer_email, p_customer_phone,
    v_subtotal, v_shipping, v_tax, v_total, coalesce(p_currency_code, 'ZAR'),
    'Paid', 'Processing',
    p_shipping_address, p_billing_address, p_discount_code, v_discount_amount,
    p_idempotency_key
  )
  returning id, order_number into v_order_id, v_order_number;

  insert into public.order_items (order_id, product_id, product_name, size, color, quantity, unit_price)
  select v_order_id, (x->>'product_id')::uuid, x->>'product_name', x->>'size', x->>'color',
         (x->>'quantity')::int,
         (select price from public.products where id = (x->>'product_id')::uuid)
  from jsonb_array_elements(p_items) x;

  -- FIXED: use v_discount_id instead of touching v_discount.id directly —
  -- v_discount_id is only ever non-null when a discount genuinely resolved.
  if v_discount_id is not null then
    insert into public.discount_redemptions (discount_id, order_id, user_id)
    values (v_discount_id, v_order_id, p_user_id);
  end if;

  return jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'total', v_total);
end;
$$;

grant execute on function public.create_order_with_items(
  uuid, text, text, text, text, jsonb, jsonb, text, text, jsonb, text
) to anon, authenticated;