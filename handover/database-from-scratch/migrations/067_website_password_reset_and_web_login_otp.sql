-- =============================================================================
-- Handover migration 067/100
-- Original: supabase/migrations/20260512125500_website_password_reset_and_web_login_otp.sql
-- Purpose: website password reset and web login otp
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create table if not exists public.website_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_website_password_reset_tokens_user_created
  on public.website_password_reset_tokens(user_id, created_at desc);

alter table public.website_password_reset_tokens enable row level security;

revoke all on public.website_password_reset_tokens from anon, authenticated;

create table if not exists public.web_login_email_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_web_login_email_otps_user_created
  on public.web_login_email_otps(user_id, created_at desc);

alter table public.web_login_email_otps enable row level security;

revoke all on public.web_login_email_otps from anon, authenticated;
