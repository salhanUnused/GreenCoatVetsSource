-- =============================================================================
-- Handover migration 097/100
-- Original: supabase/migrations/20260722140000_appointment_consent_pdf.sql
-- Purpose: Booking / walk-in signed consent PDF storage on appointments.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Booking / walk-in signed consent PDF storage on appointments.
alter table public.appointments
  add column if not exists consent_pdf_path text,
  add column if not exists consent_signed_at timestamptz;

comment on column public.appointments.consent_pdf_path is
  'Storage path in medical-files for the signed appointment booking / walk-in consent PDF.';
comment on column public.appointments.consent_signed_at is
  'When the owner signed the booking or walk-in consent form.';
