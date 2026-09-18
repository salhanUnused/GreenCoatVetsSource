-- Grant clinic admin to a user by email (run in Supabase SQL Editor as postgres / service role).
-- Prerequisites: user must exist in auth.users (signed up at least once).
-- Replace placeholders: YOUR_EMAIL, YOUR_CLINIC_SLUG (from public.clinics.slug), optional display name.

-- Option A — recommended: uses assign_user_clinic_role (also creates/updates staff_profiles for staff roles)
select public.assign_user_clinic_role(
  (select id from auth.users where lower(email) = lower('YOUR_EMAIL@example.com') limit 1),
  (select id from public.clinics where slug = 'YOUR_CLINIC_SLUG' limit 1),
  'clinic_admin'::public.app_role,
  'Clinic Admin',  -- full_name on staff_profiles
  null             -- phone (optional)
);

-- Option C — Table Editor (after migrations `20260321120000_*` and `20260321130000_*`):
-- Open public.app_users, find the row by id (= auth.users id), set:
--   manual_clinic_slug = <pick from dropdown — FK to public.clinics.slug>
--   OR manual_clinic_id = <uuid> if you prefer
--   manual_role = clinic_admin  (enum dropdown)
-- Saving triggers assign_user_clinic_role automatically.

-- Option B — raw inserts (if you prefer not to use the function)
/*
insert into public.user_clinic_memberships (user_id, clinic_id, role, is_active)
values (
  (select id from auth.users where lower(email) = lower('YOUR_EMAIL@example.com') limit 1),
  (select id from public.clinics where slug = 'YOUR_CLINIC_SLUG' limit 1),
  'clinic_admin',
  true
)
on conflict (user_id, clinic_id, role)
do update set is_active = true, updated_at = now();

insert into public.staff_profiles (user_id, clinic_id, branch_id, role, full_name, phone, is_active)
values (
  (select id from auth.users where lower(email) = lower('YOUR_EMAIL@example.com') limit 1),
  (select id from public.clinics where slug = 'YOUR_CLINIC_SLUG' limit 1),
  null,
  'clinic_admin',
  'Clinic Admin',
  null,
  true
)
on conflict (user_id, clinic_id, branch_id, role)
do update set is_active = true, full_name = excluded.full_name, updated_at = now();
*/

-- List clinics to pick slug:
-- select id, name, slug from public.clinics order by created_at;
