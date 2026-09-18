-- =============================================================================
-- Handover migration 058/100
-- Original: supabase/migrations/20260413120000_marketing_instagram_embeds.sql
-- Purpose: Super-admin curated Instagram post/reel URLs for homepage embeds (official embed.js; no visitor OAuth).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Super-admin curated Instagram post/reel URLs for homepage embeds (official embed.js; no visitor OAuth).

alter table public.marketing_site_settings
  add column if not exists instagram_embed_urls jsonb not null default '[]'::jsonb;

comment on column public.marketing_site_settings.instagram_embed_urls is
  'Array of Instagram post/reel permalinks (https://www.instagram.com/p|reel|tv/SHORTCODE/) shown on marketing homepage.';
