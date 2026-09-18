-- =============================================================================
-- Handover migration 076/100
-- Original: supabase/migrations/20260519140000_complete_own_portal_profile.sql
-- Purpose: Let newly onboarded staff/owners save name + phone reliably (security definer bypasses RLS edge cases).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Let newly onboarded staff/owners save name + phone reliably (security definer bypasses RLS edge cases).

create or replace function public.complete_own_portal_profile(
  p_full_name text default null,
  p_phone text default null,
  p_first_name text default null,
  p_last_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clinic_id uuid;
  v_role public.app_role;
  v_name text;
  v_phone text;
  v_owner_id uuid;
  v_staff_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required.';
  end if;

  v_phone := nullif(trim(coalesce(p_phone, '')), '');
  if v_phone is null or length(v_phone) < 8 then
    raise exception 'Enter a valid phone number (at least 8 characters).';
  end if;

  select m.clinic_id, m.role
  into v_clinic_id, v_role
  from public.user_clinic_memberships m
  where m.user_id = v_uid
    and m.is_active = true
  order by m.updated_at desc nulls last, m.created_at desc nulls last
  limit 1;

  if v_clinic_id is null or v_role is null then
    raise exception 'No active clinic membership found. Ask your clinic admin to finish onboarding.';
  end if;

  if v_role = 'super_admin' then
    return;
  end if;

  if v_role = 'marketing_editor' then
    -- Website editors use /admin on the marketing site; no staff_profiles row required.
    return;
  end if;

  if v_role = 'pet_owner' then
    v_name := trim(concat_ws(' ', nullif(trim(coalesce(p_first_name, '')), ''), nullif(trim(coalesce(p_last_name, '')), '')));
    if length(v_name) < 2 then
      raise exception 'Enter first and last name.';
    end if;

    select o.id
    into v_owner_id
    from public.owners o
    where o.user_id = v_uid
      and o.clinic_id = v_clinic_id
    limit 1;

    if v_owner_id is null then
      insert into public.owners (clinic_id, user_id, first_name, last_name, full_name, phone)
      values (
        v_clinic_id,
        v_uid,
        trim(p_first_name),
        trim(p_last_name),
        v_name,
        v_phone
      );
    else
      update public.owners
      set
        first_name = trim(p_first_name),
        last_name = trim(p_last_name),
        full_name = v_name,
        phone = v_phone,
        updated_at = now()
      where id = v_owner_id;
    end if;

    return;
  end if;

  v_name := nullif(trim(coalesce(p_full_name, '')), '');
  if v_name is null or length(v_name) < 2 then
    raise exception 'Enter your full name.';
  end if;

  if v_role not in (
    'clinic_admin', 'branch_admin', 'doctor', 'receptionist',
    'lab_technician', 'pharmacist'
  ) then
    raise exception 'Profile completion is not supported for this role.';
  end if;

  update public.staff_profiles sp
  set
    full_name = v_name,
    phone = v_phone,
    is_active = true,
    updated_at = now()
  where sp.user_id = v_uid
    and sp.clinic_id = v_clinic_id
    and sp.role = v_role
    and sp.branch_id is null
  returning sp.id into v_staff_id;

  if v_staff_id is null then
    insert into public.staff_profiles (user_id, clinic_id, branch_id, role, full_name, phone, is_active, working_hours)
    values (
      v_uid,
      v_clinic_id,
      null,
      v_role,
      v_name,
      v_phone,
      true,
      case when v_role = 'doctor' then 'To be updated' else null end
    )
    on conflict (user_id, clinic_id, branch_id, role)
    do update set
      full_name = excluded.full_name,
      phone = excluded.phone,
      is_active = true,
      updated_at = now();
  end if;
end;
$$;

grant execute on function public.complete_own_portal_profile(text, text, text, text) to authenticated;

comment on function public.complete_own_portal_profile(text, text, text, text) is
  'Onboarding: authenticated user saves display name and phone for their active clinic membership.';
