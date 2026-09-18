# GreenCoat / SaaSClinics — recreate database from scratch

This folder is for **handover**. A new developer can build an empty Supabase project and apply these SQL files in order to match production schema, RLS, RPCs, and storage policies.

## Contents

- `migrations/` — **100** numbered SQL files (`001_…` → `100_…`)
- `00_MIGRATION_INDEX.md` — full table: number, filename, original path, purpose
- `apply-all.sh` — optional helper to concatenate in order (review before running)
- `snippets/` — helper SQL/docs (e.g. assign clinic admin) for post-migrate seeding

## Recommended setup (Supabase)

### Option A — Supabase CLI (preferred if keeping git history)

The live project already uses `supabase/migrations/` with timestamp names. For day-to-day development, keep using:

```bash
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

This handover folder is a **documented mirror** for onboarding and disaster recovery, not a second migration history for the CLI.

### Option B — Fresh project via SQL Editor / psql

1. Create a new Supabase project.
2. Open **SQL Editor** (or `psql` with the database connection string).
3. Run each file in `migrations/` from `001` through `100` **without skipping**.
4. Or concatenate:

```bash
cd handover/database-from-scratch
./apply-all.sh > /tmp/greencoat_full_schema.sql
# Then paste into SQL Editor in chunks if the file is too large, or:
# psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /tmp/greencoat_full_schema.sql
```

5. Enable **Realtime** for tables the apps subscribe to (at least `file_attachments` for visit uploads).
6. Create storage buckets if not created by migrations: `medical-files`, `clinic-assets` (policies are in early migrations).
7. Seed a clinic, `marketing_site_settings` row `id = 'default'`, `platform_branding` row `id = 'default'`, and a platform super admin (see `supabase/snippets/`).

## Migration phases (overview)

- **01–05** — Core schema, RLS, ecommerce checkout RPCs
- **06–22** — Storage, services, invites, RBAC, branding, clinic setup
- **23–40** — Marketing site CMS, owner portal, store/payments
- **41–56** — Web PMS: contacts, visits, invoices, bookings, consents
- **57–72** — Marketing locations/SEO/Instagram, visit PDF, auth OTP
- **73–88** — Online consult, senior doctor, photo sheet, vaccinations
- **89–100** — Team/favicon, membership fixes, roles, page CMS RLS

See `00_MIGRATION_INDEX.md` for every file.

## After migrations

1. Copy env vars from the old project (Supabase URL + anon + service role).
2. Point `apps/web` and `apps/website` at the new project.
3. Configure Auth redirect URLs for web + website.
4. Re-upload brand assets / CMS content as needed (or restore a DB dump if you have one).

## Note on originals

Source of truth in the repo remains:

`supabase/migrations/*.sql`

Handover copies add a numbered prefix and a purpose header. If production receives new migrations later, regenerate this folder from `supabase/migrations/`.
