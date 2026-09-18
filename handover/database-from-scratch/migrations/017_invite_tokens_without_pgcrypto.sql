-- =============================================================================
-- Handover migration 017/100
-- Original: supabase/migrations/20260321100000_invite_tokens_without_pgcrypto.sql
-- Purpose: gen_random_bytes() requires pgcrypto; some DBs don't have it enabled.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- gen_random_bytes() requires pgcrypto; some DBs don't have it enabled.
-- Use gen_random_uuid() (built into PostgreSQL 13+) for invite tokens instead.

create or replace function public.create_role_invite(
  p_clinic_id uuid,
  p_role public.app_role,
  p_label text default null,
  p_max_uses int default null,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_membership_role public.app_role;
begin
  if p_clinic_id is null then
    raise exception 'clinic_id is required.';
  end if;

  if p_max_uses is not null and p_max_uses <= 0 then
    raise exception 'max_uses must be positive.';
  end if;

  if public.is_super_admin() then
    if p_role <> 'clinic_admin' then
      raise exception 'Super admin can generate only Clinic Admin onboarding QR.';
    end if;
  else
    select m.role
    into v_membership_role
    from public.user_clinic_memberships m
    where m.user_id = auth.uid()
      and m.clinic_id = p_clinic_id
      and m.is_active = true
    order by m.created_at asc
    limit 1;

    if v_membership_role is null then
      raise exception 'No active membership in this clinic.';
    end if;

    if v_membership_role = 'clinic_admin' then
      if p_role not in ('branch_admin', 'doctor', 'receptionist', 'lab_technician', 'pharmacist') then
        raise exception 'Clinic admin can invite only branch/staff roles.';
      end if;
    elsif v_membership_role = 'receptionist' then
      if p_role <> 'pet_owner' then
        raise exception 'Receptionist can invite only pet owners.';
      end if;
    else
      raise exception 'Role is not allowed to generate QR invites.';
    end if;
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.clinic_role_invites (
    clinic_id,
    role,
    token,
    label,
    max_uses,
    expires_at,
    created_by,
    is_active
  )
  values (
    p_clinic_id,
    p_role,
    v_token,
    nullif(trim(coalesce(p_label, '')), ''),
    p_max_uses,
    p_expires_at,
    auth.uid(),
    true
  );

  return v_token;
end;
$$;

create or replace function public.super_admin_create_clinic_invite(
  p_clinic_id uuid,
  p_role public.app_role,
  p_label text default null,
  p_max_uses int default null,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.is_super_admin() then
    raise exception 'Only super admin can create clinic invites.';
  end if;

  if p_clinic_id is null then
    raise exception 'clinic_id is required.';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.clinic_role_invites (
    clinic_id,
    role,
    token,
    label,
    max_uses,
    expires_at,
    created_by,
    is_active
  )
  values (
    p_clinic_id,
    p_role,
    v_token,
    nullif(trim(coalesce(p_label, '')), ''),
    p_max_uses,
    p_expires_at,
    auth.uid(),
    true
  );

  return v_token;
end;
$$;
