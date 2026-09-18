-- =============================================================================
-- Handover migration 024/100
-- Original: supabase/migrations/20260322140000_appointment_time_change_requests.sql
-- Purpose: Pet owners request new times; clinic staff approve and apply (or reject).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Pet owners request new times; clinic staff approve and apply (or reject).

create table if not exists public.appointment_time_change_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_starts_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create unique index if not exists idx_atcr_one_pending_per_appt
  on public.appointment_time_change_requests (appointment_id)
  where status = 'pending';

create index if not exists idx_atcr_clinic_status on public.appointment_time_change_requests (clinic_id, status, created_at desc);

alter table public.appointment_time_change_requests enable row level security;

drop policy if exists atcr_select on public.appointment_time_change_requests;
create policy atcr_select on public.appointment_time_change_requests
for select to authenticated
using (
  requested_by = auth.uid()
  or public.has_clinic_access(clinic_id)
);

-- Inserts only through RPC (security definer). Block direct client inserts.
drop policy if exists atcr_insert on public.appointment_time_change_requests;
create policy atcr_insert on public.appointment_time_change_requests
for insert to authenticated
with check (false);

drop policy if exists atcr_update on public.appointment_time_change_requests;
create policy atcr_update on public.appointment_time_change_requests
for update to authenticated
using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

create or replace function public.request_appointment_time_change(
  p_appointment_id uuid,
  p_requested_starts_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clinic_id uuid;
  v_owner_id uuid;
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  select a.clinic_id, a.owner_id
  into v_clinic_id, v_owner_id
  from public.appointments a
  where a.id = p_appointment_id;

  if v_clinic_id is null then
    raise exception 'Appointment not found.';
  end if;

  if not exists (
    select 1 from public.owners o
    where o.id = v_owner_id
      and o.user_id = v_uid
      and o.clinic_id = v_clinic_id
  ) then
    raise exception 'Only the pet owner can request a time change.';
  end if;

  if exists (
    select 1 from public.appointment_time_change_requests r
    where r.appointment_id = p_appointment_id
      and r.status = 'pending'
  ) then
    raise exception 'A time-change request is already pending for this appointment.';
  end if;

  insert into public.appointment_time_change_requests (
    clinic_id,
    appointment_id,
    requested_by,
    requested_starts_at,
    status,
    notes
  )
  values (
    v_clinic_id,
    p_appointment_id,
    v_uid,
    p_requested_starts_at,
    'pending',
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.request_appointment_time_change(uuid, timestamptz, text) to authenticated;

create or replace function public.approve_appointment_time_change_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.appointment_time_change_requests%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  select * into r
  from public.appointment_time_change_requests
  where id = p_request_id
  for update;

  if r.id is null then
    raise exception 'Request not found.';
  end if;

  if not public.has_clinic_access(r.clinic_id) then
    raise exception 'Not allowed.';
  end if;

  if r.status <> 'pending' then
    raise exception 'Request is not pending.';
  end if;

  update public.appointments
  set starts_at = r.requested_starts_at,
      updated_at = now()
  where id = r.appointment_id
    and clinic_id = r.clinic_id;

  update public.appointment_time_change_requests
  set status = 'approved',
      resolved_at = now(),
      resolved_by = v_uid
  where id = p_request_id;
end;
$$;

grant execute on function public.approve_appointment_time_change_request(uuid) to authenticated;
