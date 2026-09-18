-- =============================================================================
-- Handover migration 031/100
-- Original: supabase/migrations/20260325140000_marketing_website_branded_for_clinic.sql
-- Purpose: Optional: which clinic this marketing deployment is "branded for" when there is no host/subdomain match.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Optional: which clinic this marketing deployment is "branded for" when there is no host/subdomain match.
-- resolveClinic() uses: host match → website_branded_for_clinic_id → default_clinic_id → first active clinic.
alter table public.marketing_site_settings
  add column if not exists website_branded_for_clinic_id uuid references public.clinics (id) on delete set null;

comment on column public.marketing_site_settings.website_branded_for_clinic_id is
  'Marketing site branding tenant when host does not match a clinic; takes precedence over default_clinic_id.';
