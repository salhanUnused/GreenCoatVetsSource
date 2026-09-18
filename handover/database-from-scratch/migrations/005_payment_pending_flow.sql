-- =============================================================================
-- Handover migration 005/100
-- Original: supabase/migrations/20260320235500_payment_pending_flow.sql
-- Purpose: Supports pending payment / Razorpay-style checkout state on orders.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create or replace function public.place_order_cart_atomic(
  p_clinic_id uuid,
  p_owner_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_id uuid;
  v_subtotal numeric(12,2) := 0;
  v_item jsonb;
  v_product_id uuid;
  v_quantity int;
  v_product record;
  v_inventory record;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one cart item is required';
  end if;

  insert into public.orders (
    clinic_id,
    owner_id,
    status,
    subtotal,
    grand_total,
    placed_at
  ) values (
    p_clinic_id,
    p_owner_id,
    'pending',
    0,
    0,
    now()
  )
  returning id into v_order_id;

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := coalesce((v_item->>'quantity')::int, 0);

    if v_quantity <= 0 then
      raise exception 'Invalid quantity in cart item';
    end if;

    select id, clinic_id, branch_id, inventory_item_id, price, stock_quantity, name
    into v_product
    from public.products
    where id = v_product_id
      and clinic_id = p_clinic_id
      and is_active = true
    for update;

    if not found then
      raise exception 'Product not found for item %', v_product_id;
    end if;

    if v_product.stock_quantity < v_quantity then
      raise exception 'Insufficient product stock for %', v_product.name;
    end if;

    if v_product.inventory_item_id is not null then
      select id, stock_quantity, branch_id
      into v_inventory
      from public.inventory_items
      where id = v_product.inventory_item_id
        and clinic_id = p_clinic_id
        and is_active = true
      for update;

      if not found then
        raise exception 'Linked inventory item not found for %', v_product.name;
      end if;

      if v_inventory.stock_quantity < v_quantity then
        raise exception 'Insufficient inventory stock for %', v_product.name;
      end if;
    end if;

    insert into public.order_items (
      order_id,
      product_id,
      quantity,
      unit_price
    ) values (
      v_order_id,
      v_product.id,
      v_quantity,
      v_product.price
    );

    update public.products
    set stock_quantity = stock_quantity - v_quantity
    where id = v_product.id;

    if v_product.inventory_item_id is not null then
      update public.inventory_items
      set stock_quantity = stock_quantity - v_quantity
      where id = v_inventory.id;

      insert into public.inventory_movements (
        clinic_id,
        branch_id,
        inventory_item_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes,
        created_by
      ) values (
        p_clinic_id,
        v_inventory.branch_id,
        v_inventory.id,
        'sale',
        -v_quantity,
        'order',
        v_order_id,
        concat('Cart order sale: ', v_product.name),
        auth.uid()
      );
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  update public.orders
  set subtotal = v_subtotal,
      grand_total = v_subtotal
  where id = v_order_id;

  return v_order_id;
end;
$$;
