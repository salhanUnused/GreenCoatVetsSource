-- =============================================================================
-- Handover migration 003/100
-- Original: supabase/migrations/20260320230000_atomic_order_rpc.sql
-- Purpose: Atomic place-order RPC for ecommerce checkout.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create or replace function public.place_order_atomic(
  p_clinic_id uuid,
  p_owner_id uuid,
  p_product_id uuid,
  p_quantity int
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_id uuid;
  v_product record;
  v_inventory record;
  v_total numeric(12,2);
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select id, clinic_id, branch_id, inventory_item_id, price, stock_quantity, name
  into v_product
  from public.products
  where id = p_product_id
    and clinic_id = p_clinic_id
    and is_active = true
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  if v_product.stock_quantity < p_quantity then
    raise exception 'Insufficient product stock';
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
      raise exception 'Linked inventory item not found';
    end if;

    if v_inventory.stock_quantity < p_quantity then
      raise exception 'Insufficient inventory stock';
    end if;
  end if;

  v_total := v_product.price * p_quantity;

  insert into public.orders (
    clinic_id,
    branch_id,
    owner_id,
    status,
    subtotal,
    grand_total,
    placed_at
  )
  values (
    p_clinic_id,
    v_product.branch_id,
    p_owner_id,
    'paid',
    v_total,
    v_total,
    now()
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    quantity,
    unit_price
  )
  values (
    v_order_id,
    v_product.id,
    p_quantity,
    v_product.price
  );

  update public.products
  set stock_quantity = stock_quantity - p_quantity
  where id = v_product.id;

  if v_product.inventory_item_id is not null then
    update public.inventory_items
    set stock_quantity = stock_quantity - p_quantity
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
    )
    values (
      p_clinic_id,
      v_inventory.branch_id,
      v_inventory.id,
      'sale',
      -p_quantity,
      'order',
      v_order_id,
      concat('Order sale: ', v_product.name),
      auth.uid()
    );
  end if;

  return v_order_id;
end;
$$;

grant execute on function public.place_order_atomic(uuid, uuid, uuid, int) to authenticated;
