-- =============================================================================
-- Handover migration 045/100
-- Original: supabase/migrations/20260328220000_owners_walk_in_insert_policy.sql
-- Purpose: Allow clinic staff to create guest / walk-in owner records (user_id null) for desk registration.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Allow clinic staff to create guest / walk-in owner records (user_id null) for desk registration.
-- Keeps existing self-registration policy: owners_insert_self_policy (user_id = auth.uid()).

create policy owners_insert_staff_walkin on public.owners
for insert
with check (
  user_id is null
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.user_clinic_memberships m
      where m.user_id = auth.uid()
        and m.clinic_id = clinic_id
        and m.is_active = true
        and (m.role)::text in (
          'clinic_admin',
          'branch_admin',
          'doctor',
          'receptionist',
          'lab_technician',
          'pharmacist'
        )
    )
  )
);
