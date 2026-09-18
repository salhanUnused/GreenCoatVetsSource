-- =============================================================================
-- Handover migration 026/100
-- Original: supabase/migrations/20260323140000_marketing_site_admin.sql
-- Purpose: Marketing website: public content + super-admin-only management (login via Supabase Auth).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Marketing website: public content + super-admin-only management (login via Supabase Auth).

-- Allow anon to resolve active clinics on the marketing site (host / default clinic).
drop policy if exists clinics_select_active_public on public.clinics;
create policy clinics_select_active_public
on public.clinics
for select
to anon, authenticated
using (is_active = true);

comment on policy clinics_select_active_public on public.clinics is
  'Public marketing site can list active clinics for resolveClinic / booking context.';

-- ---------------------------------------------------------------------------
-- Singleton: default clinic for this deployment + homepage image URLs + socials
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_site_settings (
  id text primary key default 'default',
  default_clinic_id uuid references public.clinics (id) on delete set null,
  homepage_images jsonb not null default '{}'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.marketing_site_settings is
  'Website-wide marketing config: fallback clinic id, image URLs, footer social links.';
comment on column public.marketing_site_settings.homepage_images is
  'JSON keys: hero, mission_a, mission_b, surgery, facility_surgery, facility_calm, facility_lab, map_hero';
comment on column public.marketing_site_settings.social_links is
  'JSON keys: instagram_url, facebook_url, youtube_url, linkedin_url, website_url';

insert into public.marketing_site_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.marketing_site_settings enable row level security;

drop policy if exists marketing_site_settings_select on public.marketing_site_settings;
create policy marketing_site_settings_select
on public.marketing_site_settings
for select
to anon, authenticated
using (true);

drop policy if exists marketing_site_settings_write on public.marketing_site_settings;
create policy marketing_site_settings_write
on public.marketing_site_settings
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Locations shown on /locations (editable; public read)
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_locations (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null default 0,
  name text not null,
  address_lines jsonb not null default '[]'::jsonb,
  phone_display text,
  tel_href text,
  hours_label text not null default '',
  directions_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.marketing_locations is
  'Public branch list for the marketing website; managed in /admin.';

create index if not exists marketing_locations_sort_idx
  on public.marketing_locations (sort_order, name);

drop trigger if exists set_updated_at_marketing_locations on public.marketing_locations;
create trigger set_updated_at_marketing_locations
  before update on public.marketing_locations
  for each row execute function public.set_updated_at();

alter table public.marketing_locations enable row level security;

drop policy if exists marketing_locations_public_read on public.marketing_locations;
create policy marketing_locations_public_read
on public.marketing_locations
for select
to anon, authenticated
using (is_active = true);

drop policy if exists marketing_locations_super_admin on public.marketing_locations;
create policy marketing_locations_super_admin
on public.marketing_locations
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- RPC: used by admin UI to verify platform access
grant execute on function public.is_super_admin() to authenticated;
