-- =============================================================================
-- Handover migration 025/100
-- Original: supabase/migrations/20260322160000_staff_profile_photo_and_public_rpc.sql
-- Purpose: Public-facing staff fields + safe self-service updates from the mobile app.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Public-facing staff fields + safe self-service updates from the mobile app.

alter table public.staff_profiles
  add column if not exists photo_url text;

comment on column public.staff_profiles.photo_url is
  'Public URL or storage path for clinic-assets bucket; shown on marketing site and apps.';

-- ---------------------------------------------------------------------------
-- Public directory (anon-safe): scoped by clinic id from server (resolve host → clinic).
-- ---------------------------------------------------------------------------
create or replace function public.get_public_staff_for_clinic(p_clinic_id uuid)
returns table (
  id uuid,
  full_name text,
  specialization text,
  experience_years int,
  bio text,
  photo_url text,
  role public.app_role,
  branch_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sp.id,
    sp.full_name,
    sp.specialization,
    sp.experience_years,
    sp.bio,
    sp.photo_url,
    sp.role,
    b.name as branch_name
  from public.staff_profiles sp
  left join public.branches b on b.id = sp.branch_id
  where sp.clinic_id = p_clinic_id
    and sp.is_active = true
    and sp.role in ('doctor', 'lab_technician', 'pharmacist')
  order by
    case sp.role
      when 'doctor' then 0
      when 'lab_technician' then 1
      else 2
    end,
    sp.full_name asc;
$$;

revoke all on function public.get_public_staff_for_clinic(uuid) from public;
grant execute on function public.get_public_staff_for_clinic(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Staff update their own profile row (mobile app); does not allow editing others.
-- ---------------------------------------------------------------------------
create or replace function public.update_my_staff_profile(
  p_full_name text,
  p_phone text,
  p_specialization text,
  p_experience_years int,
  p_bio text,
  p_photo_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_row uuid;
begin
  if uid is null then
    raise exception 'Authentication required.';
  end if;

  if p_full_name is null or length(trim(p_full_name)) = 0 then
    raise exception 'Full name is required.';
  end if;

  update public.staff_profiles sp
  set
    full_name = trim(p_full_name),
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    specialization = nullif(trim(coalesce(p_specialization, '')), ''),
    experience_years = p_experience_years,
    bio = nullif(trim(coalesce(p_bio, '')), ''),
    photo_url = nullif(trim(coalesce(p_photo_url, '')), ''),
    updated_at = now()
  where sp.user_id = uid
    and sp.is_active = true
    and exists (
      select 1
      from public.user_clinic_memberships m
      where m.user_id = uid
        and m.clinic_id = sp.clinic_id
        and m.role = sp.role
        and m.is_active = true
    )
    and sp.role in ('doctor', 'lab_technician', 'pharmacist')
  returning sp.id into v_row;

  if v_row is null then
    raise exception 'No editable staff profile found for this account.';
  end if;
end;
$$;

revoke all on function public.update_my_staff_profile(text, text, text, int, text, text) from public;
grant execute on function public.update_my_staff_profile(text, text, text, int, text, text) to authenticated;
