-- =============================================================================
-- Handover migration 008/100
-- Original: supabase/migrations/20260321021000_contact_inquiries.sql
-- Purpose: Website contact form inquiries table + policies.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_inquiries_clinic on public.contact_inquiries(clinic_id, created_at desc);

alter table public.contact_inquiries enable row level security;

drop policy if exists contact_inquiries_insert_public on public.contact_inquiries;
create policy contact_inquiries_insert_public
on public.contact_inquiries
for insert
to anon, authenticated
with check (true);

drop policy if exists contact_inquiries_select_clinic on public.contact_inquiries;
create policy contact_inquiries_select_clinic
on public.contact_inquiries
for select
to authenticated
using (public.has_clinic_access(clinic_id));
