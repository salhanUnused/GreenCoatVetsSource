-- =============================================================================
-- Handover migration 052/100
-- Original: supabase/migrations/20260328300000_booking_without_doctor.sql
-- Purpose: Owner/website bookings may omit doctor; clinic assigns staff later.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Owner/website bookings may omit doctor; clinic assigns staff later.

drop policy if exists appointments_owner_insert on public.appointments;
create policy appointments_owner_insert on public.appointments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.owners o
    where o.id = appointments.owner_id
      and o.user_id = auth.uid()
      and o.clinic_id = appointments.clinic_id
  )
  and exists (
    select 1
    from public.pets p
    where p.id = appointments.pet_id
      and p.owner_id = appointments.owner_id
      and p.clinic_id = appointments.clinic_id
  )
  and exists (
    select 1
    from public.branches br
    where br.id = appointments.branch_id
      and br.clinic_id = appointments.clinic_id
      and br.is_active = true
  )
  and (
    appointments.doctor_id is null
    or public.is_active_doctor_for_clinic(appointments.doctor_id, appointments.clinic_id)
  )
);

-- Guest website booking: optional doctor (null = TBD at clinic)
create or replace function public.create_guest_website_booking(
  p_clinic_id uuid,
  p_branch_id uuid,
  p_doctor_id uuid,
  p_starts_at timestamptz,
  p_appointment_type public.appointment_type,
  p_owner_full_name text,
  p_owner_phone text,
  p_owner_email text,
  p_pet_name text,
  p_pet_species text,
  p_chief_complaint text,
  p_notes text,
  p_allergies text,
  p_current_medications text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_pet_id uuid;
  v_appt_id uuid;
  v_merge_token uuid := gen_random_uuid();
  v_count int;
  v_email text := lower(trim(coalesce(p_owner_email, '')));
  v_species text := nullif(trim(coalesce(p_pet_species, '')), '');
begin
  if v_email = '' then
    raise exception 'Email is required';
  end if;
  if nullif(trim(p_owner_full_name), '') is null then
    raise exception 'Name is required';
  end if;
  if nullif(trim(p_owner_phone), '') is null then
    raise exception 'Phone is required';
  end if;
  if nullif(trim(p_pet_name), '') is null then
    raise exception 'Pet name is required';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.clinic_id = p_clinic_id and b.is_active = true
  ) then
    raise exception 'Invalid branch';
  end if;

  if p_doctor_id is not null then
    if not public.is_active_doctor_for_clinic(p_doctor_id, p_clinic_id) then
      raise exception 'Invalid doctor';
    end if;
    select count(*)::int into v_count
    from public.appointments a
    where a.clinic_id = p_clinic_id
      and a.doctor_id = p_doctor_id
      and a.starts_at = p_starts_at
      and a.status in ('scheduled', 'checked_in');
    if v_count > 0 then
      raise exception 'Selected doctor slot is not available';
    end if;
  end if;

  select o.id into v_owner_id
  from public.owners o
  where o.clinic_id = p_clinic_id
    and o.user_id is null
    and lower(trim(o.email)) = v_email
  limit 1;

  if v_owner_id is null then
    insert into public.owners (clinic_id, user_id, full_name, phone, email)
    values (
      p_clinic_id,
      null,
      trim(p_owner_full_name),
      trim(p_owner_phone),
      v_email
    )
    returning id into v_owner_id;
  else
    update public.owners
    set
      full_name = trim(p_owner_full_name),
      phone = trim(p_owner_phone),
      updated_at = now()
    where id = v_owner_id;
  end if;

  insert into public.pets (clinic_id, owner_id, name, species, primary_branch_id)
  values (
    p_clinic_id,
    v_owner_id,
    trim(p_pet_name),
    coalesce(v_species, 'unknown'),
    p_branch_id
  )
  returning id into v_pet_id;

  insert into public.appointments (
    clinic_id,
    branch_id,
    pet_id,
    owner_id,
    doctor_id,
    appointment_type,
    status,
    starts_at,
    reason,
    notes,
    owner_intake,
    booking_source,
    guest_merge_token,
    created_by
  )
  values (
    p_clinic_id,
    p_branch_id,
    v_pet_id,
    v_owner_id,
    p_doctor_id,
    p_appointment_type,
    'scheduled',
    p_starts_at,
    nullif(trim(p_chief_complaint), ''),
    nullif(trim(p_notes), ''),
    jsonb_build_object(
      'chief_complaint', nullif(trim(p_chief_complaint), ''),
      'allergies', nullif(trim(p_allergies), ''),
      'current_medications', nullif(trim(p_current_medications), ''),
      'contact_phone', trim(p_owner_phone),
      'contact_email', v_email,
      'guest_booking', true
    ),
    'website_guest',
    v_merge_token,
    null
  )
  returning id into v_appt_id;

  return jsonb_build_object(
    'appointment_id', v_appt_id,
    'merge_token', v_merge_token,
    'owner_id', v_owner_id
  );
end;
$$;
