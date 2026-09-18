-- =============================================================================
-- Handover migration 033/100
-- Original: supabase/migrations/20260325200000_place_order_cart_security_definer_store_rls.sql
-- Purpose: Allow pet owners to complete cart checkout via RPC (RLS-safe) and public product catalog reads.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Allow pet owners to complete cart checkout via RPC (RLS-safe) and public product catalog reads.

-- 1) Cart placement: run as definer so inserts succeed; gate with staff or matching owner.
create or replace function public.place_order_cart_atomic(
  p_clinic_id uuid,
  p_owner_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
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
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.has_clinic_access(p_clinic_id)
    or exists (
      select 1
      from public.owners o
      where o.id = p_owner_id
        and o.user_id = auth.uid()
        and o.clinic_id = p_clinic_id
    )
  ) then
    raise exception 'Not allowed to place order for this clinic';
  end if;

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

grant execute on function public.place_order_cart_atomic(uuid, uuid, jsonb) to authenticated;

-- 2) Public storefront: read active products only for the clinic this marketing site resolves to
--    (branded → default → first active), not every tenant in the database.
drop policy if exists products_public_read_active on public.products;
create policy products_public_read_active on public.products
for select
to anon, authenticated
using (
  is_active = true
  and clinic_id = coalesce(
    (select m.website_branded_for_clinic_id from public.marketing_site_settings m where m.id = 'default'),
    (select m.default_clinic_id from public.marketing_site_settings m where m.id = 'default'),
    (select c.id from public.clinics c where c.is_active = true order by c.created_at asc limit 1)
  )
);

-- 3) Pet owners can see their own ecommerce orders.
drop policy if exists orders_select_by_owner on public.orders;
create policy orders_select_by_owner on public.orders
for select
to authenticated
using (
  exists (
    select 1
    from public.owners o
    where o.id = orders.owner_id
      and o.user_id = auth.uid()
  )
);

-- 4) Line items for those orders.
drop policy if exists order_items_select_by_owner_order on public.order_items;
create policy order_items_select_by_owner_order on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    join public.owners ow on ow.id = o.owner_id
    where o.id = order_items.order_id
      and ow.user_id = auth.uid()
  )
);

-- 5) Allow pet owners to attach payment + shipping after RPC (pending → paid).
drop policy if exists orders_update_owner_after_checkout on public.orders;
create policy orders_update_owner_after_checkout on public.orders
for update
to authenticated
using (
  exists (
    select 1
    from public.owners o
    where o.id = orders.owner_id
      and o.user_id = auth.uid()
  )
  and orders.status = 'pending'
)
with check (
  exists (
    select 1
    from public.owners o
    where o.id = orders.owner_id
      and o.user_id = auth.uid()
  )
);
