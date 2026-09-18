-- =============================================================================
-- Handover migration 036/100
-- Original: supabase/migrations/20260326100000_appointments_owner_insert_fix_and_marketing_faqs.sql
-- Purpose: Fix owner appointment booking recursion and add editable marketing FAQs.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Fix owner appointment booking recursion and add editable marketing FAQs.

-- ---------------------------------------------------------------------------
-- 1) Appointment booking: avoid cross-policy recursion on appointments/staff_profiles
-- ---------------------------------------------------------------------------

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
      and sp.role = 'doctor'
      and sp.is_active = true
  );
$$;

grant execute on function public.is_active_doctor_for_clinic(uuid, uuid) to authenticated;

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
  and appointments.doctor_id is not null
  and public.is_active_doctor_for_clinic(appointments.doctor_id, appointments.clinic_id)
);

-- ---------------------------------------------------------------------------
-- 2) Marketing FAQs: public read, super-admin CRUD
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(trim(question)) > 0),
  answer text not null check (char_length(trim(answer)) > 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_faqs_sort_idx
  on public.marketing_faqs (sort_order, created_at);

drop trigger if exists set_updated_at_marketing_faqs on public.marketing_faqs;
create trigger set_updated_at_marketing_faqs
  before update on public.marketing_faqs
  for each row execute function public.set_updated_at();

alter table public.marketing_faqs enable row level security;

drop policy if exists marketing_faqs_public_read on public.marketing_faqs;
create policy marketing_faqs_public_read on public.marketing_faqs
for select
to anon, authenticated
using (is_active = true or public.is_super_admin());

drop policy if exists marketing_faqs_super_admin_write on public.marketing_faqs;
create policy marketing_faqs_super_admin_write on public.marketing_faqs
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

insert into public.marketing_faqs (question, answer, sort_order, is_active)
select x.question, x.answer, x.sort_order, true
from (
  values
    ('What types of animals do you treat?', 'We provide expert care for canines, felines, exotics, avian species, and equines.', 0),
    ('What services do you offer at your clinics?', 'Specialized OPDs, surgeries, diagnostics, pathology, dentistry, grooming, boarding, pharmacy, and outreach programs.', 1),
    ('Do you offer vaccination?', 'Yes. We offer essential pet vaccinations, including free rabies vaccines during campaign availability.', 2),
    ('What technology do you use for diagnostics?', 'We use IDEXX diagnostic systems for accurate and reliable test results.', 3),
    ('How can I book an appointment?', 'Book online on this website, call your nearest branch, or contact us directly.', 4),
    ('Do you provide emergency services?', 'Yes, urgent cases are handled during operational hours. For after-hours emergencies, call our helpline.', 5),
    ('What makes GreenCoatVets different?', 'Our approach is community-first, pet-focused, and technology-driven with compassionate care.', 6)
) as x(question, answer, sort_order)
where not exists (select 1 from public.marketing_faqs);
