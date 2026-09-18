-- =============================================================================
-- Handover migration 094/100
-- Original: supabase/migrations/20260618160000_force_assign_single_clinic.sql
-- Purpose: Force-link authenticated users to the only active clinic when no membership exists.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Force-link authenticated users to the only active clinic when no membership exists.

create or replace function public.force_assign_only_clinic_membership(
  p_role public.app_role default 'pet_owner'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_clinic_id uuid;
  v_clinic_count int;
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select count(*)::int, min(c.id)
  into v_clinic_count, v_clinic_id
  from public.clinics c
  where c.is_active = true;

  if v_clinic_count = 0 or v_clinic_id is null then
    return null;
  end if;

  -- Prefer resolved marketing clinic when multiple exist; otherwise the only/first clinic.
  if v_clinic_count > 1 then
    v_clinic_id := coalesce(public.resolve_primary_marketing_clinic_id(), v_clinic_id);
  end if;

  insert into public.user_clinic_memberships (user_id, clinic_id, role, is_active)
  values (v_user_id, v_clinic_id, p_role, true)
  on conflict (user_id, clinic_id, role)
  do update set is_active = true, updated_at = now();

  select au.email into v_email from public.app_users au where au.id = v_user_id limit 1;

  insert into public.owners (clinic_id, user_id, full_name, phone, email)
  values (
    v_clinic_id,
    v_user_id,
    coalesce(nullif(trim(split_part(coalesce(v_email, ''), '@', 1)), ''), 'Pet Owner'),
    'NA',
    nullif(trim(v_email), '')
  )
  on conflict (clinic_id, user_id) do nothing;

  return v_clinic_id;
end;
$$;

grant execute on function public.force_assign_only_clinic_membership(public.app_role) to authenticated;
