-- =============================================================================
-- Handover migration 099/100
-- Original: supabase/migrations/20260802120000_marketing_page_content.sql
-- Purpose: Structured marketing page copy/SEO for website admin CMS.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Structured marketing page copy/SEO for website admin CMS.
alter table public.marketing_site_settings
  add column if not exists page_content jsonb not null default '{}'::jsonb;

comment on column public.marketing_site_settings.page_content is
  'Per-page SEO + section text/image URLs keyed by slug (home, about, services, …).';
