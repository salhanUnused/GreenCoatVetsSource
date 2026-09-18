-- =============================================================================
-- Handover migration 064/100
-- Original: supabase/migrations/20260511153000_prescription_catalog_and_template.sql
-- Purpose: prescription catalog and template
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create table if not exists public.medicine_catalog_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  aliases text[] not null default '{}'::text[],
  form text,
  strength text,
  manufacturer text,
  default_dosage text,
  default_frequency text,
  default_duration text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_medicine_catalog_entries_clinic_lower_name
  on public.medicine_catalog_entries (clinic_id, lower(name));

create index if not exists idx_medicine_catalog_entries_clinic_active
  on public.medicine_catalog_entries (clinic_id, is_active, name);

drop trigger if exists set_updated_at_medicine_catalog_entries on public.medicine_catalog_entries;
create trigger set_updated_at_medicine_catalog_entries
before update on public.medicine_catalog_entries
for each row execute function public.set_updated_at();

alter table public.medicine_catalog_entries enable row level security;

drop policy if exists medicine_catalog_entries_policy on public.medicine_catalog_entries;
create policy medicine_catalog_entries_policy on public.medicine_catalog_entries
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

alter table public.clinics
add column if not exists prescription_template_url text,
add column if not exists prescription_template_updated_at timestamptz;
