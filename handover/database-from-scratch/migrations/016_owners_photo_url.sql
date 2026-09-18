-- =============================================================================
-- Handover migration 016/100
-- Original: supabase/migrations/20260321080000_owners_photo_url.sql
-- Purpose: owners photo url
-- Apply in order. Do not skip or reorder.
-- =============================================================================

alter table public.owners
add column if not exists photo_url text;
