-- =============================================================================
-- Handover migration 015/100
-- Original: supabase/migrations/20260321070000_clinic_images_and_upload_policies.sql
-- Purpose: clinic images and upload policies
-- Apply in order. Do not skip or reorder.
-- =============================================================================

alter table public.clinics
add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('clinic-assets', 'clinic-assets', true, 10485760)
on conflict (id) do nothing;

drop policy if exists clinic_assets_select on storage.objects;
create policy clinic_assets_select
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'clinic-assets'
);

drop policy if exists clinic_assets_insert on storage.objects;
create policy clinic_assets_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'clinic-assets'
  and (
    public.is_super_admin()
    or public.has_clinic_access(((regexp_match(name, '^([0-9a-fA-F-]{36})/'))[1])::uuid)
  )
);

drop policy if exists clinic_assets_update on storage.objects;
create policy clinic_assets_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'clinic-assets'
  and (
    public.is_super_admin()
    or public.has_clinic_access(((regexp_match(name, '^([0-9a-fA-F-]{36})/'))[1])::uuid)
  )
)
with check (
  bucket_id = 'clinic-assets'
  and (
    public.is_super_admin()
    or public.has_clinic_access(((regexp_match(name, '^([0-9a-fA-F-]{36})/'))[1])::uuid)
  )
);

drop policy if exists clinic_assets_delete on storage.objects;
create policy clinic_assets_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'clinic-assets'
  and (
    public.is_super_admin()
    or public.has_clinic_access(((regexp_match(name, '^([0-9a-fA-F-]{36})/'))[1])::uuid)
  )
);
