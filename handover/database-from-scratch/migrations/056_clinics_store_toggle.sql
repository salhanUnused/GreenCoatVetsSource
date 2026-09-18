-- =============================================================================
-- Handover migration 056/100
-- Original: supabase/migrations/20260330123000_clinics_store_toggle.sql
-- Purpose: clinics store toggle
-- Apply in order. Do not skip or reorder.
-- =============================================================================

alter table public.clinics
add column if not exists website_store_enabled boolean not null default true;

update public.clinics
set website_store_enabled = coalesce(website_store_enabled, true);
