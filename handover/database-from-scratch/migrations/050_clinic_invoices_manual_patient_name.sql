-- =============================================================================
-- Handover migration 050/100
-- Original: supabase/migrations/20260328280000_clinic_invoices_manual_patient_name.sql
-- Purpose: Manual / walk-in invoices: visit optional; denormalized patient name on PDF.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Manual / walk-in invoices: visit optional; denormalized patient name on PDF.

alter table public.clinic_invoices alter column visit_id drop not null;

alter table public.clinic_invoices add column if not exists patient_name text;

comment on column public.clinic_invoices.visit_id is
  'Visit this invoice relates to; null for manual reception invoices.';
comment on column public.clinic_invoices.patient_name is
  'Patient animal name shown on the invoice PDF (snapshot; from visit pet or entered manually).';

update public.clinic_invoices ci
set patient_name = p.name
from public.visits v
join public.pets p on p.id = v.pet_id
where ci.visit_id = v.id
  and (ci.patient_name is null or trim(ci.patient_name) = '');
