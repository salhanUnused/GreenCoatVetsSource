-- =============================================================================
-- Handover migration 065/100
-- Original: supabase/migrations/20260511161000_handwritten_visit_template_and_pdf_source.sql
-- Purpose: handwritten visit template and pdf source
-- Apply in order. Do not skip or reorder.
-- =============================================================================

alter table public.clinics
add column if not exists handwritten_visit_template_url text,
add column if not exists handwritten_visit_template_updated_at timestamptz;

update public.clinics
set
  handwritten_visit_template_url = coalesce(handwritten_visit_template_url, prescription_template_url),
  handwritten_visit_template_updated_at = coalesce(handwritten_visit_template_updated_at, prescription_template_updated_at)
where prescription_template_url is not null;

alter table public.visits
add column if not exists visit_report_pdf_source text;

update public.visits
set visit_report_pdf_source = 'generated'
where visit_report_pdf_path is not null
  and visit_report_pdf_source is null;

alter table public.visits
drop constraint if exists visits_visit_report_pdf_source_check;

alter table public.visits
add constraint visits_visit_report_pdf_source_check
check (visit_report_pdf_source is null or visit_report_pdf_source in ('generated', 'handwritten'));
