-- =============================================================================
-- Handover migration 075/100
-- Original: supabase/migrations/20260519131000_visit_phone_capture_sessions.sql
-- Purpose: visit phone capture sessions
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create table if not exists public.visit_phone_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete set null,
  pet_id uuid references public.pets (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_visit_phone_capture_visit_active
  on public.visit_phone_capture_sessions (visit_id, expires_at desc)
  where revoked_at is null;

comment on table public.visit_phone_capture_sessions is
  'Short-lived tokens so a doctor phone can upload visit photos while the visit is open on a laptop.';

alter table public.visit_phone_capture_sessions enable row level security;

drop policy if exists visit_phone_capture_sessions_select on public.visit_phone_capture_sessions;
create policy visit_phone_capture_sessions_select
on public.visit_phone_capture_sessions
for select
to authenticated
using (public.has_clinic_access (clinic_id));

drop policy if exists visit_phone_capture_sessions_insert on public.visit_phone_capture_sessions;
create policy visit_phone_capture_sessions_insert
on public.visit_phone_capture_sessions
for insert
to authenticated
with check (public.has_clinic_access (clinic_id));

drop policy if exists visit_phone_capture_sessions_update on public.visit_phone_capture_sessions;
create policy visit_phone_capture_sessions_update
on public.visit_phone_capture_sessions
for update
to authenticated
using (public.has_clinic_access (clinic_id));
