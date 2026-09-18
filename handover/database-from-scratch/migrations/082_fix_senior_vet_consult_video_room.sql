-- =============================================================================
-- Handover migration 082/100
-- Original: supabase/migrations/20260521120000_fix_senior_vet_consult_video_room.sql
-- Purpose: Fix create_senior_vet_online_consult (correct signature + booking) and in-website video rooms.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Fix create_senior_vet_online_consult (correct signature + booking) and in-website video rooms.

alter table public.clinic_online_consult_settings
  drop column if exists google_meet_base_url;

alter table public.appointments
  add column if not exists video_room_id text;

-- Drop any broken overload from a partial apply
drop function if exists public.create_senior_vet_online_consult(
  uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, text, text
);

create or replace function public.validate_online_consult_join(
  p_appointment_id uuid,
  p_token uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
  v_pet_name text;
  v_owner_name text;
  v_doctor_name text;
  v_duration int := 10;
begin
  select * into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.appointment_type = 'online_consult'
    and a.status in ('scheduled', 'checked_in');

  if not found then
    raise exception 'Consultation not found or not joinable';
  end if;

  if p_token is not null then
    if v_appt.guest_merge_token is distinct from p_token then
      raise exception 'Invalid join link';
    end if;
  elsif auth.uid() is not null then
    if exists (
      select 1 from public.owners o
      where o.id = v_appt.owner_id and o.user_id = auth.uid()
    ) then
      null;
    elsif exists (
      select 1 from public.staff_profiles sp
      where sp.id = v_appt.doctor_id and sp.user_id = auth.uid() and sp.is_active = true
    ) then
      null;
    elsif public.has_clinic_access(v_appt.clinic_id) then
      null;
    else
      raise exception 'Not authorized to join this consultation';
    end if;
  else
    raise exception 'Login or booking token required';
  end if;

  select p.name into v_pet_name from public.pets p where p.id = v_appt.pet_id;
  select o.full_name into v_owner_name from public.owners o where o.id = v_appt.owner_id;
  select sp.full_name into v_doctor_name from public.staff_profiles sp where sp.id = v_appt.doctor_id;

  select coalesce(s.duration_minutes, 10) into v_duration
  from public.clinic_online_consult_settings s
  where s.clinic_id = v_appt.clinic_id;

  return jsonb_build_object(
    'appointment_id', v_appt.id,
    'room_name', coalesce(v_appt.video_room_id, 'gcv' || replace(v_appt.id::text, '-', '')),
    'starts_at', v_appt.starts_at,
    'ends_at', v_appt.ends_at,
    'duration_minutes', v_duration,
    'pet_name', coalesce(v_pet_name, 'Pet'),
    'owner_name', coalesce(v_owner_name, 'Owner'),
    'doctor_name', coalesce(v_doctor_name, 'Veterinarian'),
    'clinic_id', v_appt.clinic_id
  );
end;
$$;

revoke all on function public.validate_online_consult_join(uuid, uuid) from public;
grant execute on function public.validate_online_consult_join(uuid, uuid) to anon, authenticated;

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

revoke all on function public.create_senior_vet_online_consult(
  uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.create_senior_vet_online_consult(
  uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, text, text
) to anon, authenticated, service_role;
