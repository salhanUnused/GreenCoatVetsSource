-- =============================================================================
-- Handover migration 021/100
-- Original: supabase/migrations/20260321160000_clinic_default_branch_and_backfill.sql
-- Purpose: Every clinic should have at least one branch so appointments, inventory, etc. can reference branch_id.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Every clinic should have at least one branch so appointments, inventory, etc. can reference branch_id.
-- 1) New clinics from super_admin_create_clinic get a default "Main" branch.
-- 2) Existing clinics with zero branches are backfilled.

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

  insert into public.branches (clinic_id, name, code, is_active)
  values (v_clinic_id, 'Main', 'MAIN', true);

  return v_clinic_id;
end;
$$;

-- Backfill: one default branch per clinic that has none
insert into public.branches (clinic_id, name, code, is_active)
select c.id, 'Main', 'MAIN', true
from public.clinics c
where not exists (select 1 from public.branches b where b.clinic_id = c.id);
