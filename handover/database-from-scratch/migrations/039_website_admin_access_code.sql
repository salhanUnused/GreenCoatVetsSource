-- =============================================================================
-- Handover migration 039/100
-- Original: supabase/migrations/20260326142000_website_admin_access_code.sql
-- Purpose: Website marketing admin login gate code (super-admin controlled).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Website marketing admin login gate code (super-admin controlled).

alter table public.platform_branding
  add column if not exists website_admin_access_code text;

update public.platform_branding
set website_admin_access_code = coalesce(nullif(trim(website_admin_access_code), ''), '15072005')
where id = 'default';

comment on column public.platform_branding.website_admin_access_code is
  'Numeric gate code for website /admin/login access modal. Super admin can rotate from web super-admin panel.';
