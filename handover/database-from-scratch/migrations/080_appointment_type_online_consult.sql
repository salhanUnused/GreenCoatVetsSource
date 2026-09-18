-- =============================================================================
-- Handover migration 080/100
-- Original: supabase/migrations/20260520105000_appointment_type_online_consult.sql
-- Purpose: appointment type online consult
-- Apply in order. Do not skip or reorder.
-- =============================================================================

do $$ begin
  alter type public.appointment_type add value if not exists 'online_consult';
exception when duplicate_object then null;
end $$;
