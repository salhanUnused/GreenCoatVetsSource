-- =============================================================================
-- Handover migration 091/100
-- Original: supabase/migrations/20260607140000_website_favicon.sql
-- Purpose: Website-only favicon (marketing admin), independent of web portal platform_branding.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Website-only favicon (marketing admin), independent of web portal platform_branding.

alter table public.marketing_site_settings
  add column if not exists website_favicon_url text;

comment on column public.marketing_site_settings.website_favicon_url is
  'Square PNG favicon for the public marketing website only; managed in /admin/settings.';

-- Marketing editors may upload branding assets under clinic-assets/marketing/*
drop policy if exists clinic_assets_marketing_branding_insert on storage.objects;
create policy clinic_assets_marketing_branding_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'clinic-assets'
  and name like 'marketing/%'
  and (public.is_super_admin() or public.is_marketing_editor())
);

drop policy if exists clinic_assets_marketing_branding_update on storage.objects;
create policy clinic_assets_marketing_branding_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'clinic-assets'
  and name like 'marketing/%'
  and (public.is_super_admin() or public.is_marketing_editor())
)
with check (
  bucket_id = 'clinic-assets'
  and name like 'marketing/%'
  and (public.is_super_admin() or public.is_marketing_editor())
);

drop policy if exists clinic_assets_marketing_branding_delete on storage.objects;
create policy clinic_assets_marketing_branding_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'clinic-assets'
  and name like 'marketing/%'
  and (public.is_super_admin() or public.is_marketing_editor())
);
