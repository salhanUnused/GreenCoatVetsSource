-- =============================================================================
-- Handover migration 007/100
-- Original: supabase/migrations/20260321013000_services_module.sql
-- Purpose: Clinic services catalog module for bookable/billed services.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  title text not null,
  slug text not null,
  short_description text,
  description text,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, slug)
);

create index if not exists idx_services_clinic_id on public.services(clinic_id);
create trigger set_updated_at_services before update on public.services for each row execute function public.set_updated_at();

alter table public.services enable row level security;
drop policy if exists services_policy on public.services;
create policy services_policy on public.services
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));
