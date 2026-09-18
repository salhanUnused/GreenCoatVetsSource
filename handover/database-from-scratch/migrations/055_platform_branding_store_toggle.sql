-- =============================================================================
-- Handover migration 055/100
-- Original: supabase/migrations/20260330120000_platform_branding_store_toggle.sql
-- Purpose: platform branding store toggle
-- Apply in order. Do not skip or reorder.
-- =============================================================================

alter table public.platform_branding
add column if not exists website_store_enabled boolean not null default true;

update public.platform_branding
set website_store_enabled = coalesce(website_store_enabled, true)
where id = 'default';
