-- =============================================================================
-- Handover migration 047/100
-- Original: supabase/migrations/20260328250000_guest_booking_marketing_popups.sql
-- Purpose: Guest booking from marketing site (no login), merge on signup/email match, optional token claim.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Guest booking from marketing site (no login), merge on signup/email match, optional token claim.
-- Marketing popups (offers, announcements, etc.) for public website.

-- ---------------------------------------------------------------------------
-- Appointments: source + guest merge token
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists booking_source text not null default 'owner_portal';

alter table public.appointments
  add column if not exists guest_merge_token uuid;

create unique index if not exists appointments_guest_merge_token_uidx
  on public.appointments (guest_merge_token)
  where guest_merge_token is not null;

comment on column public.appointments.booking_source is
  'owner_portal | website_guest | staff | ...';
comment on column public.appointments.guest_merge_token is
  'Set for website_guest bookings; used to link to an account or merge with existing owner.';

-- ---------------------------------------------------------------------------
-- create_guest_website_booking: anon + authenticated (server passes clinic id)
-- ---------------------------------------------------------------------------
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

revoke all on function public.create_guest_website_booking(
  uuid, uuid, uuid, timestamptz, public.appointment_type,
  text, text, text, text, text, text, text, text, text
) from public;

grant execute on function public.create_guest_website_booking(
  uuid, uuid, uuid, timestamptz, public.appointment_type,
  text, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- claim_guest_booking_with_token: attach guest booking to logged-in owner
-- ---------------------------------------------------------------------------
create or replace function public.claim_guest_booking_with_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_appt public.appointments%rowtype;
  v_guest_owner public.owners%rowtype;
  v_existing_owner uuid;
begin
  if v_uid is null then
    raise exception 'Login required';
  end if;
  if p_token is null then
    raise exception 'Token required';
  end if;

  select * into v_appt
  from public.appointments a
  where a.guest_merge_token = p_token
  limit 1;

  if not found then
    raise exception 'Booking not found';
  end if;

  select * into v_guest_owner from public.owners o where o.id = v_appt.owner_id;
  if not found then
    raise exception 'Invalid booking data';
  end if;

  if v_guest_owner.user_id is not null then
    raise exception 'This booking is already linked to an account';
  end if;

  select o.id into v_existing_owner
  from public.owners o
  where o.clinic_id = v_appt.clinic_id
    and o.user_id = v_uid
  limit 1;

  if v_existing_owner is not null then
    update public.pets set owner_id = v_existing_owner, updated_at = now() where id = v_appt.pet_id;
    update public.appointments set owner_id = v_existing_owner, updated_at = now() where id = v_appt.id;
    delete from public.owners o
    where o.id = v_guest_owner.id
      and not exists (select 1 from public.pets p where p.owner_id = o.id)
      and not exists (select 1 from public.appointments a where a.owner_id = o.id);
    return jsonb_build_object('merged_into_existing_owner', true, 'owner_id', v_existing_owner);
  else
    update public.owners
    set user_id = v_uid, updated_at = now()
    where id = v_guest_owner.id;
    return jsonb_build_object('merged_into_existing_owner', false, 'owner_id', v_guest_owner.id);
  end if;
end;
$$;

revoke all on function public.claim_guest_booking_with_token(uuid) from public;
grant execute on function public.claim_guest_booking_with_token(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Marketing popups (public read, super-admin write)
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_site_popups (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null default 0,
  template_type text not null default 'announcement'
    check (template_type in ('offer', 'community', 'reminder', 'announcement', 'generic')),
  title text not null check (char_length(trim(title)) > 0),
  body text,
  image_url text,
  cta_label text,
  cta_href text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.marketing_site_popups is
  'Marketing site modal announcements; template_type drives styling.';

create index if not exists marketing_site_popups_active_sort_idx
  on public.marketing_site_popups (is_active, sort_order, created_at desc);

drop trigger if exists set_updated_at_marketing_site_popups on public.marketing_site_popups;
create trigger set_updated_at_marketing_site_popups
  before update on public.marketing_site_popups
  for each row execute function public.set_updated_at();

alter table public.marketing_site_popups enable row level security;

drop policy if exists marketing_site_popups_public_read on public.marketing_site_popups;
create policy marketing_site_popups_public_read
on public.marketing_site_popups
for select
to anon, authenticated
using (is_active = true);

drop policy if exists marketing_site_popups_super_admin on public.marketing_site_popups;
create policy marketing_site_popups_super_admin
on public.marketing_site_popups
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());
