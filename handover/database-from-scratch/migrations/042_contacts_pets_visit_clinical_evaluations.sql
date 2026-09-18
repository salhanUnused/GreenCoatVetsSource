-- =============================================================================
-- Handover migration 042/100
-- Original: supabase/migrations/20260328140000_contacts_pets_visit_clinical_evaluations.sql
-- Purpose: Professional PMS: client contacts, patient codes & notes, structured visit clinical evaluation (invoicing-ready).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Professional PMS: client contacts, patient codes & notes, structured visit clinical evaluation (invoicing-ready).

-- ---------------------------------------------------------------------------
-- Owners / contacts (ezyVet-style customer records)
-- ---------------------------------------------------------------------------
alter table public.owners add column if not exists title text;
alter table public.owners add column if not exists first_name text;
alter table public.owners add column if not exists last_name text;
alter table public.owners add column if not exists contact_type text not null default 'customer';
alter table public.owners add column if not exists contact_notes text;
alter table public.owners add column if not exists contact_notes_important boolean not null default false;
alter table public.owners add column if not exists post_mail_to_physical boolean not null default true;
alter table public.owners add column if not exists postal_address text;
alter table public.owners add column if not exists postal_city text;
alter table public.owners add column if not exists postal_state text;
alter table public.owners add column if not exists postal_postal_code text;
alter table public.owners add column if not exists postal_country text;
alter table public.owners add column if not exists business_name text;
alter table public.owners add column if not exists website text;

do $$
begin
  alter table public.owners add constraint owners_contact_type_check
    check (contact_type in ('customer', 'supplier', 'staff', 'other'));
exception
  when duplicate_object then null;
end $$;

-- Backfill name parts from legacy full_name
update public.owners o
set
  first_name = coalesce(
    nullif(trim(split_part(trim(o.full_name), ' ', 1)), ''),
    trim(o.full_name)
  ),
  last_name = nullif(
    trim(substring(trim(o.full_name) from length(split_part(trim(o.full_name), ' ', 1)) + 2)),
    ''
  )
where o.first_name is null;

-- ---------------------------------------------------------------------------
-- Patients
-- ---------------------------------------------------------------------------
alter table public.pets add column if not exists animal_notes text;
alter table public.pets add column if not exists animal_notes_important boolean not null default false;
alter table public.pets add column if not exists patient_code text;
alter table public.pets add column if not exists date_of_birth_estimated boolean not null default false;

create unique index if not exists pets_clinic_patient_code_key
  on public.pets (clinic_id, patient_code)
  where patient_code is not null;

update public.pets p
set patient_code = 'P-' || upper(substr(replace(p.id::text, '-', ''), 1, 8))
where p.patient_code is null;

-- ---------------------------------------------------------------------------
-- Visit clinical evaluation (SOAP-style + labs; used for care + downstream invoicing)
-- ---------------------------------------------------------------------------
create table if not exists public.visit_clinical_evaluations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  species_class text,
  patient_gender text,
  patient_age text,
  patient_name text,
  owner_name text,
  cc_hp text,
  section_deworming text,
  section_vaccination text,
  param_rt text,
  param_rr text,
  param_hr text,
  param_crt text,
  param_allergic text,
  param_bw text,
  tests_referred jsonb not null default '[]'::jsonb,
  tests_other text,
  physical_examination text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visit_clinical_evaluations_visit_unique unique (visit_id),
  constraint visit_clinical_evaluations_species_class_check check (
    species_class is null
    or species_class in ('canine', 'feline', 'exotic', 'avian', 'equine')
  )
);

create index if not exists idx_visit_clinical_evaluations_clinic
  on public.visit_clinical_evaluations (clinic_id);

drop trigger if exists set_updated_at_visit_clinical_evaluations on public.visit_clinical_evaluations;
create trigger set_updated_at_visit_clinical_evaluations
before update on public.visit_clinical_evaluations
for each row execute function public.set_updated_at();

alter table public.visit_clinical_evaluations enable row level security;

drop policy if exists visit_clinical_evaluations_policy on public.visit_clinical_evaluations;
create policy visit_clinical_evaluations_policy on public.visit_clinical_evaluations
for all
using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

comment on table public.visit_clinical_evaluations is
  'Structured doctor visit exam + referred tests; intended for clinical use and billing/invoicing integration.';

comment on column public.visit_clinical_evaluations.tests_referred is
  'JSON array of test code strings (e.g. ["CBC","CHEM 17"]).';
