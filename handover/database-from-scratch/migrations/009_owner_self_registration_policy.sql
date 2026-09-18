-- =============================================================================
-- Handover migration 009/100
-- Original: supabase/migrations/20260321024500_owner_self_registration_policy.sql
-- Purpose: RLS so pet owners can create their own owner profile on signup.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

drop policy if exists owners_policy on public.owners;

create policy owners_select_policy on public.owners
for select
using (
  public.has_clinic_access(clinic_id) or user_id = auth.uid()
);

create policy owners_insert_self_policy on public.owners
for insert
with check (
  user_id = auth.uid()
);

create policy owners_update_policy on public.owners
for update
using (
  public.has_clinic_access(clinic_id) or user_id = auth.uid()
)
with check (
  public.has_clinic_access(clinic_id) or user_id = auth.uid()
);
