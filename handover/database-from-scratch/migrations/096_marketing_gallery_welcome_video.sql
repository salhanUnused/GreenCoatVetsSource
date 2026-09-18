-- =============================================================================
-- Handover migration 096/100
-- Original: supabase/migrations/20260722120000_marketing_gallery_welcome_video.sql
-- Purpose: Homepage clinic gallery image URLs + welcome video link for marketing site.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Homepage clinic gallery image URLs + welcome video link for marketing site.

alter table public.marketing_site_settings
  add column if not exists gallery_image_urls jsonb not null default '[]'::jsonb;

alter table public.marketing_site_settings
  add column if not exists welcome_video_url text;

comment on column public.marketing_site_settings.gallery_image_urls is
  'Array of HTTPS image URLs shown in the homepage clinic gallery section.';

comment on column public.marketing_site_settings.welcome_video_url is
  'HTTPS link to the clinic welcome video (YouTube, Vimeo, or direct MP4) shown on the homepage.';
