-- =============================================================================
-- Handover migration 071/100
-- Original: supabase/migrations/20260512152000_appointment_source_defaults.sql
-- Purpose: appointment source defaults
-- Apply in order. Do not skip or reorder.
-- =============================================================================

alter table public.appointments
  alter column booking_source set default 'clinic_portal';

update public.appointments
set booking_source = 'clinic_portal'
where booking_source = 'owner_portal'
  and coalesce(owner_intake->>'consent_accepted', 'false') <> 'true';
