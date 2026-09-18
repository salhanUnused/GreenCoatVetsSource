-- =============================================================================
-- Handover migration 060/100
-- Original: supabase/migrations/20260415120000_instagram_embed_synced_at.sql
-- Purpose: When marketing homepage Instagram embeds were last synced from Instagram Graph API (admin "Refresh").
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- When marketing homepage Instagram embeds were last synced from Instagram Graph API (admin "Refresh").

alter table public.marketing_site_settings
  add column if not exists instagram_embed_synced_at timestamptz;

comment on column public.marketing_site_settings.instagram_embed_synced_at is
  'Last successful fetch of post/reel permalinks via Instagram Graph API for instagram_embed_urls.';
