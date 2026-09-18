# One active role per clinic

Changing `manual_role` on `public.app_users` (or using `assign_user_clinic_role`) used to **add** a new `user_clinic_memberships` row while leaving the old role (e.g. `clinic_admin`) **still active**. The mobile app then read an arbitrary row.

**Fix:** migration `20260321140000_single_active_membership_per_clinic.sql`:

- After assigning a role, all **other** memberships for the same `user_id` + `clinic_id` are set to `is_active = false`.
- Existing duplicate active rows are cleaned (keeps the most recently updated row per user+clinic).
- The app loads membership with `order by updated_at desc limit 1`.

Apply the migration, then **refresh the app** (or sign out / sign in). If the role still looks wrong, check **Table Editor → `user_clinic_memberships`** for your user: there should be **only one** `is_active = true` row per clinic.
