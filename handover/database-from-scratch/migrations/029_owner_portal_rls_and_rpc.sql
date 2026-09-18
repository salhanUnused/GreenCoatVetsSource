-- =============================================================================
-- Handover migration 029/100
-- Original: supabase/migrations/20260324120000_owner_portal_rls_and_rpc.sql
-- Purpose: Pet owner portal: owners can manage their pets and book appointments for their clinic.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Pet owner portal: owners can manage their pets and book appointments for their clinic.
-- Visit history is exposed only via a safe RPC (no clinical detail).
-- Prescriptions, medical_records, file_attachments, vaccination_records remain staff-only (existing policies).

-- ---------------------------------------------------------------------------
-- RLS: pets — staff OR owning user
-- ---------------------------------------------------------------------------
drop policy if exists pets_owner_select on public.pets;
create policy pets_owner_select on public.pets
for select
to authenticated
using (
  exists (
    select 1
    from public.owners o
    where o.id = pets.owner_id
      and o.user_id = auth.uid()
  )
);

drop policy if exists pets_owner_insert on public.pets;
create policy pets_owner_insert on public.pets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.owners o
    where o.id = pets.owner_id
      and o.user_id = auth.uid()
      and o.clinic_id = pets.clinic_id
  )
);

drop policy if exists pets_owner_update on public.pets;
create policy pets_owner_update on public.pets
for update
to authenticated
using (
  exists (
    select 1
    from public.owners o
    where o.id = pets.owner_id
      and o.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.owners o
    where o.id = pets.owner_id
      and o.user_id = auth.uid()
      and o.clinic_id = pets.clinic_id
  )
);

-- ---------------------------------------------------------------------------
-- RLS: appointments — staff OR owning user (read + book)
-- ---------------------------------------------------------------------------
drop policy if exists appointments_owner_select on public.appointments;
create policy appointments_owner_select on public.appointments
for select
to authenticated
using (
  exists (
    select 1
    from public.owners o
    where o.id = appointments.owner_id
      and o.user_id = auth.uid()
  )
);

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
    where p.id = pet_id
      and p.owner_id = owner_id
      and p.clinic_id = appointments.clinic_id
  )
  and exists (
    select 1
    from public.branches br
    where br.id = branch_id
      and br.clinic_id = appointments.clinic_id
      and br.is_active = true
  )
  and doctor_id is not null
  and exists (
    select 1
    from public.staff_profiles sp
    where sp.id = doctor_id
      and sp.clinic_id = appointments.clinic_id
      and sp.role = 'doctor'
      and sp.is_active = true
  )
);

-- ---------------------------------------------------------------------------
-- Public read helpers (booking UI for authenticated pet owners; same as marketing anon)
-- ---------------------------------------------------------------------------
create or replace function public.get_public_branches_for_clinic(p_clinic_id uuid)
returns table (
  id uuid,
  name text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.name
  from public.branches b
  where b.clinic_id = p_clinic_id
    and b.is_active = true
  order by b.name asc;
$$;

revoke all on function public.get_public_branches_for_clinic(uuid) from public;
grant execute on function public.get_public_branches_for_clinic(uuid) to anon, authenticated;

create or replace function public.get_public_booking_doctors(p_clinic_id uuid)
returns table (
  id uuid,
  full_name text,
  branch_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select sp.id, sp.full_name, sp.branch_id
  from public.staff_profiles sp
  where sp.clinic_id = p_clinic_id
    and sp.is_active = true
    and sp.role = 'doctor'
  order by sp.full_name asc;
$$;

revoke all on function public.get_public_booking_doctors(uuid) from public;
grant execute on function public.get_public_booking_doctors(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Owner portal: last visits — date / pet / branch only (no diagnosis or attachments)
-- ---------------------------------------------------------------------------
create or replace function public.get_owner_portal_visit_summaries(p_clinic_id uuid, p_limit int default 25)
returns table (
  id uuid,
  pet_name text,
  branch_name text,
  visited_at timestamptz,
  status_label text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    p.name as pet_name,
    b.name as branch_name,
    coalesce(v.completed_at, v.started_at, v.created_at) as visited_at,
    case
      when v.completed_at is not null then 'Completed'
      when v.started_at is not null then 'In progress'
      else 'Recorded'
    end as status_label
  from public.visits v
  inner join public.owners o on o.id = v.owner_id
  inner join public.pets p on p.id = v.pet_id
  inner join public.branches b on b.id = v.branch_id
  where o.user_id = auth.uid()
    and v.clinic_id = p_clinic_id
  order by coalesce(v.completed_at, v.started_at, v.created_at) desc nulls last
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

revoke all on function public.get_owner_portal_visit_summaries(uuid, int) from public;
grant execute on function public.get_owner_portal_visit_summaries(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Staff: pet owners may read doctor rows only when they have an appointment with that doctor
-- ---------------------------------------------------------------------------
drop policy if exists staff_profiles_owner_booking_read on public.staff_profiles;
create policy staff_profiles_owner_booking_read on public.staff_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.appointments a
    inner join public.owners o on o.id = a.owner_id
    where a.doctor_id = staff_profiles.id
      and o.user_id = auth.uid()
  )
);
