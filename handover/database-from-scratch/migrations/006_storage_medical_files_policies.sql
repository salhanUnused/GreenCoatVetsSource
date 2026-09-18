-- =============================================================================
-- Handover migration 006/100
-- Original: supabase/migrations/20260321001000_storage_medical_files_policies.sql
-- Purpose: Storage bucket policies for medical-files (visit docs, PDFs, attachments).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-files',
  'medical-files',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/octet-stream'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "medical_files_select" on storage.objects;
create policy "medical_files_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'medical-files'
  and public.has_clinic_access(split_part(name, '/', 1)::uuid)
);

drop policy if exists "medical_files_insert" on storage.objects;
create policy "medical_files_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'medical-files'
  and public.has_clinic_access(split_part(name, '/', 1)::uuid)
);

drop policy if exists "medical_files_update" on storage.objects;
create policy "medical_files_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'medical-files'
  and public.has_clinic_access(split_part(name, '/', 1)::uuid)
)
with check (
  bucket_id = 'medical-files'
  and public.has_clinic_access(split_part(name, '/', 1)::uuid)
);

drop policy if exists "medical_files_delete" on storage.objects;
create policy "medical_files_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'medical-files'
  and public.has_clinic_access(split_part(name, '/', 1)::uuid)
);
