-- =============================================================================
-- Handover migration 041/100
-- Original: supabase/migrations/20260328120000_web_portal_orders_notifications_attachments_indexes.sql
-- Purpose: Web portal (apps/web): contact & patient Financial / Communication / Attachments views.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Web portal (apps/web): contact & patient Financial / Communication / Attachments views.
-- RLS: existing policies already allow clinic staff via public.has_clinic_access(clinic_id) on:
--   public.orders, public.notifications, public.file_attachments
--   and public.contact_inquiries (select) for matching clinic.
-- This migration adds indexes only — safe to run in Supabase SQL Editor even if already applied via CLI.

-- Ecommerce orders shown by owner (household) on contact & patient records
create index if not exists idx_orders_clinic_owner_placed
  on public.orders (clinic_id, owner_id, placed_at desc);

-- Notification log filtered by owner on communication tabs
create index if not exists idx_notifications_clinic_owner_created
  on public.notifications (clinic_id, owner_id, created_at desc);

-- File attachments listed per patient (and aggregated for all pets under a contact)
create index if not exists idx_file_attachments_clinic_pet_created
  on public.file_attachments (clinic_id, pet_id, created_at desc);

-- Website contact form threads matched to an owner by email (per clinic)
create index if not exists idx_contact_inquiries_clinic_email_created
  on public.contact_inquiries (clinic_id, email, created_at desc);

analyze public.orders;
analyze public.notifications;
analyze public.file_attachments;
analyze public.contact_inquiries;
