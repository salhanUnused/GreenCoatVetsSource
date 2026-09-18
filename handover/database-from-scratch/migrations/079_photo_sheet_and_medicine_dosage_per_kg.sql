-- =============================================================================
-- Handover migration 079/100
-- Original: supabase/migrations/20260520100000_photo_sheet_and_medicine_dosage_per_kg.sql
-- Purpose: Allow photo-sheet visit PDF source; medicine catalog dosage per kg for weight-based Rx.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Allow photo-sheet visit PDF source; medicine catalog dosage per kg for weight-based Rx.

alter table public.visits
drop constraint if exists visits_visit_report_pdf_source_check;

alter table public.visits
add constraint visits_visit_report_pdf_source_check
check (visit_report_pdf_source is null or visit_report_pdf_source in ('generated', 'handwritten', 'photo_sheet'));

alter table public.medicine_catalog_entries
add column if not exists dosage_per_kg text;

comment on column public.medicine_catalog_entries.dosage_per_kg is
  'Dose per kg body weight, e.g. 10 mg/kg or 0.5 ml/kg — used to calculate prescription dosage from pet weight.';
