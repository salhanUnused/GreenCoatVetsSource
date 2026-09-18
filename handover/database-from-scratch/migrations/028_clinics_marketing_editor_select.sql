-- =============================================================================
-- Handover migration 028/100
-- Original: supabase/migrations/20260323200000_clinics_marketing_editor_select.sql
-- Purpose: Allow marketing editors to read their assigned clinic row (has_clinic_access excludes them).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Allow marketing editors to read their assigned clinic row (has_clinic_access excludes them).
drop policy if exists clinics_marketing_editor_select on public.clinics;
create policy clinics_marketing_editor_select on public.clinics
for select
to authenticated
using (
  exists (
    select 1
    from public.user_clinic_memberships m
    where m.user_id = auth.uid()
      and m.clinic_id = public.clinics.id
      and m.role = 'marketing_editor'
      and m.is_active = true
  )
);
