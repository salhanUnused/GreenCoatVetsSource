-- =============================================================================
-- Handover migration 093/100
-- Original: supabase/migrations/20260618140000_owners_dedupe_unique_clinic_user.sql
-- Purpose: Prevent duplicate owner rows per clinic+user (fixes "multiple rows returned" on mobile/website).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Prevent duplicate owner rows per clinic+user (fixes "multiple rows returned" on mobile/website).

delete from public.owners a
using public.owners b
where a.clinic_id = b.clinic_id
  and a.user_id is not null
  and b.user_id is not null
  and a.user_id = b.user_id
  and a.id <> b.id
  and a.created_at > b.created_at;

create unique index if not exists owners_clinic_user_uidx
  on public.owners (clinic_id, user_id)
  where user_id is not null;
