-- =============================================================================
-- Handover migration 084/100
-- Original: supabase/migrations/20260527192000_senior_doctor_and_online_consult_test_mode.sql
-- Purpose: Add senior doctor role and online consult testing mode.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Add senior doctor role and online consult testing mode.
-- NOTE: enum value is created in 20260527191000_add_senior_doctor_enum.sql.

alter table public.clinic_online_consult_settings
  add column if not exists test_mode boolean not null default false;

create or replace function public.is_active_doctor_for_clinic(p_doctor_id uuid, p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.id = p_doctor_id
      and sp.clinic_id = p_clinic_id
      and sp.is_active = true
      and sp.role in ('doctor', 'senior_doctor')
  );
$$;

revoke all on function public.is_active_doctor_for_clinic(uuid, uuid) from public;
grant execute on function public.is_active_doctor_for_clinic(uuid, uuid) to authenticated, anon;

create or replace function public.get_public_booking_doctors(p_clinic_id uuid)
returns table (
  id uuid,
  full_name text,
  branch_id uuid,
  working_hours text
)
language sql
stable
security definer
set search_path = public
as $$
  select sp.id, sp.full_name, sp.branch_id, sp.working_hours
  from public.staff_profiles sp
  where sp.clinic_id = p_clinic_id
    and sp.is_active = true
    and sp.role in ('doctor', 'senior_doctor')
  order by sp.full_name asc;
$$;

revoke all on function public.get_public_booking_doctors(uuid) from public;
grant execute on function public.get_public_booking_doctors(uuid) to anon, authenticated;

create or replace function public.get_public_senior_booking_doctors(p_clinic_id uuid)
returns table (
  id uuid,
  full_name text,
  branch_id uuid,
  working_hours text
)
language sql
stable
security definer
set search_path = public
as $$
  select sp.id, sp.full_name, sp.branch_id, sp.working_hours
  from public.staff_profiles sp
  where sp.clinic_id = p_clinic_id
    and sp.is_active = true
    and sp.role = 'senior_doctor'
  order by sp.full_name asc;
$$;

revoke all on function public.get_public_senior_booking_doctors(uuid) from public;
grant execute on function public.get_public_senior_booking_doctors(uuid) to anon, authenticated;

create or replace function public.create_senior_vet_online_consult(
  p_clinic_id uuid,
  p_branch_id uuid,
  p_doctor_id uuid,
  p_starts_at timestamptz,
  p_owner_full_name text,
  p_owner_phone text,
  p_owner_email text,
  p_pet_name text,
  p_pet_species text,
  p_chief_complaint text,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_consent_pdf_path text,
  p_website_base_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.clinic_online_consult_settings%rowtype;
  v_result jsonb;
  v_appt_id uuid;
  v_merge uuid;
  v_room text;
  v_join_path text;
  v_ends timestamptz;
  v_base text;
begin
  select * into v_settings from public.clinic_online_consult_settings where clinic_id = p_clinic_id;
  if not found or v_settings.enabled = false then
    raise exception 'Online consultation is not available for this clinic';
  end if;

  if p_doctor_id is null then
    raise exception 'Senior doctor is required';
  end if;

  if not exists (
    select 1
    from public.staff_profiles sp
    where sp.id = p_doctor_id
      and sp.clinic_id = p_clinic_id
      and sp.is_active = true
      and sp.role = 'senior_doctor'
  ) then
    raise exception 'Selected doctor is not a Senior doctor';
  end if;

  v_ends := p_starts_at + make_interval(mins => v_settings.duration_minutes);

  if to_regtype('public.appointment_type') is not null then
    select public.create_guest_website_booking(
      p_clinic_id, p_branch_id, p_doctor_id, p_starts_at,
      'online_consult'::public.appointment_type,
      p_owner_full_name, p_owner_phone, p_owner_email,
      p_pet_name, p_pet_species, 'unknown', null,
      p_chief_complaint, 'Senior Vet online consultation', null, null,
      true, 'Senior Vet online consultation consent', v_settings.consent_version
    ) into v_result;
  else
    select public.create_guest_website_booking(
      p_clinic_id, p_branch_id, p_doctor_id, p_starts_at,
      'online_consult',
      p_owner_full_name, p_owner_phone, p_owner_email,
      p_pet_name, p_pet_species, 'unknown', null,
      p_chief_complaint, 'Senior Vet online consultation', null, null,
      true, 'Senior Vet online consultation consent', v_settings.consent_version
    ) into v_result;
  end if;

  v_appt_id := (v_result->>'appointment_id')::uuid;
  v_merge := (v_result->>'merge_token')::uuid;
  v_room := 'gcv' || replace(v_appt_id::text, '-', '');

  v_base := nullif(trim(coalesce(p_website_base_url, '')), '');
  if v_base is null then
    v_base := 'https://www.greencoatvets.com';
  end if;
  v_base := rtrim(v_base, '/');
  v_join_path := v_base || '/consult/room/' || v_appt_id::text || '?token=' || v_merge::text;

  update public.appointments
  set
    ends_at = v_ends,
    video_room_id = v_room,
    meet_link = v_join_path,
    video_consent_pdf_path = p_consent_pdf_path,
    online_consult_paid_at = now(),
    razorpay_order_id = p_razorpay_order_id,
    razorpay_payment_id = p_razorpay_payment_id,
    online_consent_signed_at = now(),
    notes = coalesce(notes, '') || ' [Senior Vet online consult]'
  where id = v_appt_id;

  return v_result || jsonb_build_object(
    'meet_link', v_join_path,
    'join_url', v_join_path,
    'video_room_id', v_room,
    'duration_minutes', v_settings.duration_minutes
  );
end;
$$;
