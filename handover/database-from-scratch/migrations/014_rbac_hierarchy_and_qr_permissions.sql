-- =============================================================================
-- Handover migration 014/100
-- Original: supabase/migrations/20260321062000_rbac_hierarchy_and_qr_permissions.sql
-- Purpose: rbac hierarchy and qr permissions
-- Apply in order. Do not skip or reorder.
-- =============================================================================

do $$
begin
  alter type public.app_role add value if not exists 'lab_technician';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type public.app_role add value if not exists 'pharmacist';
exception
  when duplicate_object then null;
end $$;

create unique index if not exists idx_only_one_platform_super_admin
on public.platform_super_admins ((true));

create or replace function public.bootstrap_super_admin(
  p_user_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_user_email is null or length(trim(p_user_email)) = 0 then
    raise exception 'User email is required.';
  end if;

  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_user_email))
  limit 1;

  if v_user_id is null then
    raise exception 'User not found in auth.users for email: %', p_user_email;
  end if;

  delete from public.platform_super_admins where user_id <> v_user_id;
  insert into public.platform_super_admins (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return v_user_id;
end;
$$;

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

  v_token := encode(gen_random_bytes(24), 'hex');

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

grant execute on function public.create_role_invite(uuid, public.app_role, text, int, timestamptz) to authenticated;

create or replace function public.super_admin_delete_clinic(
  p_clinic_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only super admin can delete clinics.';
  end if;
  if p_clinic_id is null then
    raise exception 'clinic_id is required.';
  end if;
  delete from public.clinics where id = p_clinic_id;
end;
$$;

create or replace function public.super_admin_set_clinic_active(
  p_clinic_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only super admin can activate or block clinics.';
  end if;
  if p_clinic_id is null then
    raise exception 'clinic_id is required.';
  end if;
  update public.clinics
  set is_active = p_is_active, updated_at = now()
  where id = p_clinic_id;
end;
$$;

grant execute on function public.super_admin_delete_clinic(uuid) to authenticated;
grant execute on function public.super_admin_set_clinic_active(uuid, boolean) to authenticated;
