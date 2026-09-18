-- =============================================================================
-- Handover migration 083/100
-- Original: supabase/migrations/20260527191000_add_senior_doctor_enum.sql
-- Purpose: add senior doctor enum
-- Apply in order. Do not skip or reorder.
-- =============================================================================

do $$ begin
  alter type public.app_role add value if not exists 'senior_doctor';
exception
  when duplicate_object then null;
end $$;
