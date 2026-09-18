-- =============================================================================
-- Handover migration 062/100
-- Original: supabase/migrations/20260415150000_visit_patient_complaint.sql
-- Purpose: Stated reason for visit at presentation (owner/patient complaint), distinct from CC/HPI narrative.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Stated reason for visit at presentation (owner/patient complaint), distinct from CC/HPI narrative.

alter table public.visit_clinical_evaluations
  add column if not exists patient_complaint text;

comment on column public.visit_clinical_evaluations.patient_complaint is
  'What the owner or patient reports as the reason for today''s visit; may be pre-filled from booking intake.';
