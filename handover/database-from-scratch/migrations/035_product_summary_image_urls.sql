-- =============================================================================
-- Handover migration 035/100
-- Original: supabase/migrations/20260325220000_product_summary_image_urls.sql
-- Purpose: Retail-style product content: short summary for cards, gallery URLs for PDP (JSON array of strings).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Retail-style product content: short summary for cards, gallery URLs for PDP (JSON array of strings).
alter table public.products
  add column if not exists summary text;

alter table public.products
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

-- Ensure gallery is always a JSON array (empty array default).
alter table public.products
  drop constraint if exists products_image_urls_is_array;

alter table public.products
  add constraint products_image_urls_is_array
  check (jsonb_typeof(image_urls) = 'array');
