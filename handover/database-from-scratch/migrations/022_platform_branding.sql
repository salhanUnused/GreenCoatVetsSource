-- =============================================================================
-- Handover migration 022/100
-- Original: supabase/migrations/20260321170000_platform_branding.sql
-- Purpose: Platform-wide product name and logo (web, mobile in-app, marketing site, favicon).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Platform-wide product name and logo (web, mobile in-app, marketing site, favicon).

create table if not exists public.platform_branding (
  id text primary key default 'default',
  product_name text not null default 'GreenCoatVets',
  logo_url text,
  favicon_url text,
  updated_at timestamptz not null default now()
);

insert into public.platform_branding (id, product_name)
values ('default', 'GreenCoatVets')
on conflict (id) do nothing;

alter table public.platform_branding enable row level security;

drop policy if exists platform_branding_select on public.platform_branding;
create policy platform_branding_select
on public.platform_branding
for select
to anon, authenticated
using (true);

drop policy if exists platform_branding_insert on public.platform_branding;
create policy platform_branding_insert
on public.platform_branding
for insert
to authenticated
with check (public.is_super_admin());

drop policy if exists platform_branding_update on public.platform_branding;
create policy platform_branding_update
on public.platform_branding
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists platform_branding_delete on public.platform_branding;
create policy platform_branding_delete
on public.platform_branding
for delete
to authenticated
using (public.is_super_admin());
