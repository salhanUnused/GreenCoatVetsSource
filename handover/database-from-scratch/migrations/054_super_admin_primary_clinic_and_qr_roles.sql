-- =============================================================================
-- Handover migration 054/100
-- Original: supabase/migrations/20260330103000_super_admin_primary_clinic_and_qr_roles.sql
-- Purpose: Super admin: allow invite QR generation for all app roles (except super_admin),
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Super admin: allow invite QR generation for all app roles (except super_admin),
-- and support a platform primary clinic for default mobile customer onboarding.

alter table public.platform_branding
add column if not exists primary_clinic_id uuid references public.clinics(id) on delete set null;

-- Backfill primary clinic if missing (pick earliest active clinic).
update public.platform_branding pb
set primary_clinic_id = c.id,
    updated_at = now()
from (
  select id
  from public.clinics
  where is_active = true
  order by created_at asc
  limit 1
) c
where pb.id = 'default'
  and pb.primary_clinic_id is null;

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
    if p_role not in (
      'clinic_admin', 'branch_admin', 'doctor', 'receptionist',
      'lab_technician', 'pharmacist', 'pet_owner'
    ) then
      raise exception 'Super admin can generate invite QR for clinic/customer/staff roles only.';
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
    elsif v_membership_role in ('receptionist', 'doctor') then
      if p_role <> 'pet_owner' then
        raise exception 'Receptionists and doctors can invite only pet owners.';
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

create or replace function public.ensure_primary_clinic_customer_membership()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_clinic_id uuid;
  v_email text;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select primary_clinic_id
  into v_clinic_id
  from public.platform_branding
  where id = 'default'
  limit 1;

  if v_clinic_id is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.clinics c
    where c.id = v_clinic_id and c.is_active = true
  ) then
    return null;
  end if;

  insert into public.user_clinic_memberships (user_id, clinic_id, role, is_active)
  values (v_user_id, v_clinic_id, 'pet_owner', true)
  on conflict (user_id, clinic_id, role)
  do update set
    is_active = true,
    updated_at = now();

  select au.email into v_email
  from public.app_users au
  where au.id = v_user_id
  limit 1;

  v_display_name := coalesce(nullif(trim(split_part(coalesce(v_email, ''), '@', 1)), ''), 'Pet Owner');

  if not exists (
    select 1
    from public.owners o
    where o.user_id = v_user_id
      and o.clinic_id = v_clinic_id
  ) then
    insert into public.owners (clinic_id, user_id, full_name, phone, email)
    values (v_clinic_id, v_user_id, v_display_name, 'NA', nullif(trim(v_email), ''));
  end if;

  return v_clinic_id;
end;
$$;

grant execute on function public.ensure_primary_clinic_customer_membership() to authenticated;
