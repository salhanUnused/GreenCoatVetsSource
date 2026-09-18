-- =============================================================================
-- Handover migration 070/100
-- Original: supabase/migrations/20260512151000_admin_email_action_codes.sql
-- Purpose: admin email action codes
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create table if not exists public.admin_email_action_codes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  action_type text not null,
  code_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_email_action_codes_lookup_idx
  on public.admin_email_action_codes (user_id, clinic_id, action_type, created_at desc);

alter table public.admin_email_action_codes enable row level security;

revoke all on public.admin_email_action_codes from anon, authenticated;
