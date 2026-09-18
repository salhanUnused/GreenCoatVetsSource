-- =============================================================================
-- Handover migration 051/100
-- Original: supabase/migrations/20260328290000_user_consents.sql
-- Purpose: Records acceptance of data-sharing / disclaimer consent (web, website, future mobile).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Records acceptance of data-sharing / disclaimer consent (web, website, future mobile).

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_key text not null,
  consent_version text not null default '1',
  accepted_at timestamptz not null default now(),
  unique (user_id, consent_key)
);

create index if not exists user_consents_user_id_idx on public.user_consents (user_id);

comment on table public.user_consents is
  'User acceptance of legal disclaimers (e.g. voluntary data sharing). One row per consent_key per user.';

alter table public.user_consents enable row level security;

create policy "Users read own consents"
  on public.user_consents for select
  using (auth.uid() = user_id);

create policy "Users insert own consents"
  on public.user_consents for insert
  with check (auth.uid() = user_id);

create policy "Users update own consents"
  on public.user_consents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.user_consents to authenticated;
