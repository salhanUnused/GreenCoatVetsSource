-- =============================================================================
-- Handover migration 074/100
-- Original: supabase/migrations/20260519130000_marketing_seo_settings.sql
-- Purpose: marketing seo settings
-- Apply in order. Do not skip or reorder.
-- =============================================================================

alter table public.marketing_site_settings
  add column if not exists seo_settings jsonb not null default '{}'::jsonb;

comment on column public.marketing_site_settings.seo_settings is
  'SEO: google_site_verification (meta content), public_site_url override, last_sitemap_ping_at.';
