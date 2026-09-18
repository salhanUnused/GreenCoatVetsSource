-- =============================================================================
-- Handover migration 073/100
-- Original: supabase/migrations/20260519120000_web_portal_password_reset_tokens.sql
-- Purpose: web portal password reset tokens
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create table if not exists public.web_portal_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_web_portal_password_reset_tokens_user_created
  on public.web_portal_password_reset_tokens(user_id, created_at desc);

alter table public.web_portal_password_reset_tokens enable row level security;

revoke all on public.web_portal_password_reset_tokens from anon, authenticated;
