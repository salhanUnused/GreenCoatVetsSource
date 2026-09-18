-- =============================================================================
-- Handover migration 089/100
-- Original: supabase/migrations/20260606120000_clear_logo_as_favicon.sql
-- Purpose: Wide logos copied into favicon_url render as blank browser tabs.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Wide logos copied into favicon_url render as blank browser tabs.
-- Clear mistaken favicon values so the bundled square paw SVG is used instead.

update public.platform_branding
set favicon_url = null,
    updated_at = now()
where favicon_url is not null
  and favicon_url = logo_url;
