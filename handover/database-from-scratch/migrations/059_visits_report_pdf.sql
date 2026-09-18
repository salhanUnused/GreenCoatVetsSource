-- =============================================================================
-- Handover migration 059/100
-- Original: supabase/migrations/20260414100000_visits_report_pdf.sql
-- Purpose: Stored visit summary PDF (medical-files bucket path) for owner/staff download.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Stored visit summary PDF (medical-files bucket path) for owner/staff download.

alter table public.visits
  add column if not exists visit_report_pdf_path text,
  add column if not exists visit_report_pdf_generated_at timestamptz;

comment on column public.visits.visit_report_pdf_path is
  'Path in medical-files bucket: {clinic_id}/pets/{pet_id}/visits/{visit_id}/visit-report.pdf';
