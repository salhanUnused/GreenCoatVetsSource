-- =============================================================================
-- Handover migration 087/100
-- Original: supabase/migrations/20260528120000_online_consult_call_timer_and_owner_appointments.sql
-- Purpose: Call timer starts when doctor joins; owner portal appointments by email/user link.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Call timer starts when doctor joins; owner portal appointments by email/user link.

alter table public.appointments
  add column if not exists online_consult_call_started_at timestamptz;

create or replace function public.link_guest_owners_for_current_user(p_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if v_uid is null or v_email = '' then
    return;
  end if;

  update public.owners
  set user_id = v_uid, updated_at = now()
  where clinic_id = p_clinic_id
    and user_id is null
    and email is not null
    and lower(trim(email)) = v_email;
end;
$$;

revoke all on function public.link_guest_owners_for_current_user(uuid) from public;
grant execute on function public.link_guest_owners_for_current_user(uuid) to authenticated;

create or replace function public.mark_online_consult_doctor_joined(
  p_appointment_id uuid,
  p_doctor_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt public.appointments%rowtype;
  v_now timestamptz := now();
begin
  select * into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.appointment_type = 'online_consult';

  if not found then
    raise exception 'Consultation not found';
  end if;

  if p_doctor_token is null or v_appt.online_consult_doctor_join_token is distinct from p_doctor_token then
    raise exception 'Invalid doctor join token';
  end if;

  update public.appointments
  set
    online_consult_doctor_joined_at = coalesce(online_consult_doctor_joined_at, v_now),
    online_consult_call_started_at = coalesce(online_consult_call_started_at, v_now)
  where id = p_appointment_id
  returning * into v_appt;

  return jsonb_build_object(
    'ok', true,
    'doctor_joined_at', v_appt.online_consult_doctor_joined_at,
    'call_started_at', v_appt.online_consult_call_started_at
  );
end;
$$;

create or replace function public.validate_online_consult_join(
  p_appointment_id uuid,
  p_token uuid default null,
  p_role text default null
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
  v_role text := lower(trim(coalesce(p_role, 'owner')));
  v_call_ends timestamptz;
  v_user_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  select * into v_appt
  from public.appointments a
  where a.id = p_appointment_id
    and a.appointment_type = 'online_consult'
    and a.status in ('scheduled', 'checked_in');

  if not found then
    raise exception 'Consultation not found or not joinable';
  end if;

  if v_role = 'doctor' then
    if p_token is not null and v_appt.online_consult_doctor_join_token = p_token then
      null;
    elsif auth.uid() is not null and (
      exists (
        select 1 from public.staff_profiles sp
        where sp.id = v_appt.doctor_id and sp.user_id = auth.uid() and sp.is_active = true
      )
      or public.has_clinic_access(v_appt.clinic_id)
    ) then
      null;
    else
      raise exception 'Not authorized as doctor for this consultation';
    end if;
  else
    if p_token is not null then
      if v_appt.guest_merge_token is distinct from p_token then
        raise exception 'Invalid join link';
      end if;
    elsif auth.uid() is not null then
      if exists (
        select 1 from public.owners o
        where o.id = v_appt.owner_id
          and (
            o.user_id = auth.uid()
            or (
              v_user_email <> ''
              and o.email is not null
              and lower(trim(o.email)) = v_user_email
            )
          )
      ) then
        null;
      else
        raise exception 'Not authorized to join this consultation';
      end if;
    else
      raise exception 'Login required';
    end if;
  end if;

  select p.name into v_pet_name from public.pets p where p.id = v_appt.pet_id;
  select o.full_name into v_owner_name from public.owners o where o.id = v_appt.owner_id;
  select sp.full_name into v_doctor_name from public.staff_profiles sp where sp.id = v_appt.doctor_id;

  select coalesce(s.duration_minutes, 10) into v_duration
  from public.clinic_online_consult_settings s
  where s.clinic_id = v_appt.clinic_id;

  if v_appt.online_consult_call_started_at is not null then
    v_call_ends := v_appt.online_consult_call_started_at + make_interval(mins => v_duration);
  else
    v_call_ends := null;
  end if;

  return jsonb_build_object(
    'appointment_id', v_appt.id,
    'room_name', coalesce(v_appt.video_room_id, 'gcv' || replace(v_appt.id::text, '-', '')),
    'starts_at', v_appt.starts_at,
    'ends_at', v_appt.ends_at,
    'call_started_at', v_appt.online_consult_call_started_at,
    'call_ends_at', v_call_ends,
    'duration_minutes', v_duration,
    'doctor_joined_at', v_appt.online_consult_doctor_joined_at,
    'pet_name', coalesce(v_pet_name, 'Pet'),
    'owner_name', coalesce(v_owner_name, 'Owner'),
    'doctor_name', coalesce(v_doctor_name, 'Veterinarian'),
    'clinic_id', v_appt.clinic_id
  );
end;
$$;

create or replace function public.get_owner_portal_appointments(p_clinic_id uuid, p_limit int default 50)
returns table (
  id uuid,
  starts_at timestamptz,
  status text,
  appointment_type text,
  doctor_id uuid,
  online_consult_paid_at timestamptz,
  razorpay_payment_id text,
  meet_link text,
  pet_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.link_guest_owners_for_current_user(p_clinic_id);

  return query
  select
    a.id,
    a.starts_at,
    a.status::text,
    a.appointment_type::text,
    a.doctor_id,
    a.online_consult_paid_at,
    a.razorpay_payment_id,
    a.meet_link,
    p.name as pet_name
  from public.appointments a
  inner join public.owners o on o.id = a.owner_id
  inner join public.pets p on p.id = a.pet_id
  where a.clinic_id = p_clinic_id
    and o.user_id = auth.uid()
  order by a.starts_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

revoke all on function public.get_owner_portal_appointments(uuid, int) from public;
grant execute on function public.get_owner_portal_appointments(uuid, int) to authenticated;
