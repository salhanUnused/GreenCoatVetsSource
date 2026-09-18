-- =============================================================================
-- Handover migration 088/100
-- Original: supabase/migrations/20260528123000_super_admin_delete_owners.sql
-- Purpose: Platform super admin: permanently delete selected owners (and cascaded pets/visits).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Platform super admin: permanently delete selected owners (and cascaded pets/visits).

create or replace function public.super_admin_delete_owners(
  p_clinic_id uuid,
  p_owner_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_owner_count int := 0;
  v_pet_count int := 0;
  v_invoice_count int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'Only platform super admins can delete owners';
  end if;

  if p_clinic_id is null or p_owner_ids is null or array_length(p_owner_ids, 1) is null then
    raise exception 'Clinic and owner selection are required';
  end if;

  select array_agg(distinct o.id)
  into v_ids
  from public.owners o
  where o.clinic_id = p_clinic_id
    and o.id = any(p_owner_ids);

  if v_ids is null or array_length(v_ids, 1) is null then
    raise exception 'No matching owners found for this clinic';
  end if;

  select count(*)::int into v_pet_count
  from public.pets p
  where p.clinic_id = p_clinic_id
    and p.owner_id = any(v_ids);

  select count(*)::int into v_invoice_count
  from public.clinic_invoices
  where clinic_id = p_clinic_id
    and owner_id = any(v_ids);

  delete from public.clinic_invoices
  where clinic_id = p_clinic_id
    and owner_id = any(v_ids);

  delete from public.owners
  where clinic_id = p_clinic_id
    and id = any(v_ids);

  v_owner_count := coalesce(array_length(v_ids, 1), 0);

  return jsonb_build_object(
    'owner_count', v_owner_count,
    'pet_count', v_pet_count,
    'invoice_count', v_invoice_count
  );
end;
$$;

revoke all on function public.super_admin_delete_owners(uuid, uuid[]) from public;
grant execute on function public.super_admin_delete_owners(uuid, uuid[]) to authenticated;
