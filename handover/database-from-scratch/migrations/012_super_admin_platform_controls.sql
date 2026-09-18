-- =============================================================================
-- Handover migration 012/100
-- Original: supabase/migrations/20260321043000_super_admin_platform_controls.sql
-- Purpose: super admin platform controls
-- Apply in order. Do not skip or reorder.
-- =============================================================================

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
  v_platform_clinic_id uuid;
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

  select c.id
  into v_platform_clinic_id
  from public.clinics c
  where c.slug = 'platform-root'
  limit 1;

  if v_platform_clinic_id is null then
    insert into public.clinics (name, slug, subdomain, support_email, timezone, is_active)
    values ('Platform Root Clinic', 'platform-root', 'platform-root', 'platform@saasclinics.local', 'UTC', true)
    returning id into v_platform_clinic_id;
  end if;

  insert into public.user_clinic_memberships (user_id, clinic_id, role, is_active)
  values (v_user_id, v_platform_clinic_id, 'super_admin', true)
  on conflict (user_id, clinic_id, role)
  do update set
    is_active = true,
    updated_at = now();

  return v_user_id;
end;
$$;

create or replace function public.super_admin_create_clinic(
  p_name text,
  p_slug text,
  p_subdomain text default null,
  p_custom_domain text default null,
  p_support_email text default null,
  p_support_phone text default null,
  p_timezone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only super admin can create clinics.';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Clinic name is required.';
  end if;
  if p_slug is null or length(trim(p_slug)) = 0 then
    raise exception 'Clinic slug is required.';
  end if;

  insert into public.clinics (
    name,
    slug,
    subdomain,
    custom_domain,
    support_email,
    support_phone,
    timezone,
    is_active
  )
  values (
    trim(p_name),
    trim(lower(p_slug)),
    nullif(trim(lower(coalesce(p_subdomain, ''))), ''),
    nullif(trim(lower(coalesce(p_custom_domain, ''))), ''),
    nullif(trim(coalesce(p_support_email, '')), ''),
    nullif(trim(coalesce(p_support_phone, '')), ''),
    coalesce(nullif(trim(coalesce(p_timezone, '')), ''), 'UTC'),
    true
  )
  returning id into v_clinic_id;

  return v_clinic_id;
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

grant execute on function public.bootstrap_super_admin(text) to service_role;
grant execute on function public.super_admin_create_clinic(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.super_admin_create_clinic_invite(uuid, public.app_role, text, int, timestamptz) to authenticated;
