-- =============================================================================
-- Handover migration 092/100
-- Original: supabase/migrations/20260618120000_primary_clinic_membership_resolution.sql
-- Purpose: Resolve the same default clinic as the marketing website (resolveClinic) when linking pet owners.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Resolve the same default clinic as the marketing website (resolveClinic) when linking pet owners.

create or replace function public.resolve_primary_marketing_clinic_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
begin
  select primary_clinic_id
  into v_clinic_id
  from public.platform_branding
  where id = 'default'
  limit 1;

  if v_clinic_id is not null then
    return v_clinic_id;
  end if;

  select coalesce(m.website_branded_for_clinic_id, m.default_clinic_id)
  into v_clinic_id
  from public.marketing_site_settings m
  where m.id = 'default'
  limit 1;

  if v_clinic_id is not null then
    return v_clinic_id;
  end if;

  select c.id
  into v_clinic_id
  from public.clinics c
  where c.is_active = true
  order by c.created_at asc
  limit 1;

  return v_clinic_id;
end;
$$;

grant execute on function public.resolve_primary_marketing_clinic_id() to authenticated;

create or replace function public.ensure_primary_clinic_customer_membership(
  p_full_name text default null,
  p_phone text default null
)
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
  v_phone text;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  v_clinic_id := public.resolve_primary_marketing_clinic_id();

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

  select au.email
  into v_email
  from public.app_users au
  where au.id = v_user_id
  limit 1;

  v_display_name := coalesce(
    nullif(trim(coalesce(p_full_name, '')), ''),
    nullif(trim(split_part(coalesce(v_email, ''), '@', 1)), ''),
    'Pet Owner'
  );
  v_phone := coalesce(nullif(trim(coalesce(p_phone, '')), ''), 'NA');

  insert into public.owners (clinic_id, user_id, full_name, phone, email)
  values (v_clinic_id, v_user_id, v_display_name, v_phone, nullif(trim(v_email), ''))
  on conflict (clinic_id, user_id)
  do update set
    full_name = coalesce(nullif(trim(coalesce(excluded.full_name, '')), ''), public.owners.full_name),
    phone = coalesce(nullif(trim(coalesce(excluded.phone, '')), ''), public.owners.phone),
    email = coalesce(nullif(trim(coalesce(excluded.email, '')), ''), public.owners.email),
    updated_at = now();

  return v_clinic_id;
end;
$$;

create or replace function public.ensure_primary_clinic_customer_membership()
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.ensure_primary_clinic_customer_membership(null, null);
$$;

grant execute on function public.ensure_primary_clinic_customer_membership(text, text) to authenticated;
grant execute on function public.ensure_primary_clinic_customer_membership() to authenticated;
