-- =============================================================================
-- Handover migration 090/100
-- Original: supabase/migrations/20260607120000_marketing_team_members.sql
-- Purpose: Homepage "Our team" carousel managed from website marketing admin.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Homepage "Our team" carousel managed from website marketing admin.

create table if not exists public.marketing_team_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role_title text,
  image_url text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_team_members_sort_idx
  on public.marketing_team_members (sort_order, full_name);

drop trigger if exists set_updated_at_marketing_team_members on public.marketing_team_members;
create trigger set_updated_at_marketing_team_members
  before update on public.marketing_team_members
  for each row execute function public.set_updated_at();

alter table public.marketing_team_members enable row level security;

drop policy if exists marketing_team_members_public_read on public.marketing_team_members;
create policy marketing_team_members_public_read on public.marketing_team_members
for select
to anon, authenticated
using (is_active = true or public.is_super_admin() or public.is_marketing_editor());

drop policy if exists marketing_team_members_admin_write on public.marketing_team_members;
create policy marketing_team_members_admin_write on public.marketing_team_members
for all
to authenticated
using (public.is_super_admin() or public.is_marketing_editor())
with check (public.is_super_admin() or public.is_marketing_editor());

comment on table public.marketing_team_members is
  'Staff shown in the homepage Our team section; photos uploaded via /admin/team.';

-- Marketing editors can upload team photos to clinic-assets/marketing/team/*
drop policy if exists clinic_assets_marketing_team_insert on storage.objects;
create policy clinic_assets_marketing_team_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'clinic-assets'
  and name like 'marketing/team/%'
  and (public.is_super_admin() or public.is_marketing_editor())
);

drop policy if exists clinic_assets_marketing_team_update on storage.objects;
create policy clinic_assets_marketing_team_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'clinic-assets'
  and name like 'marketing/team/%'
  and (public.is_super_admin() or public.is_marketing_editor())
)
with check (
  bucket_id = 'clinic-assets'
  and name like 'marketing/team/%'
  and (public.is_super_admin() or public.is_marketing_editor())
);

drop policy if exists clinic_assets_marketing_team_delete on storage.objects;
create policy clinic_assets_marketing_team_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'clinic-assets'
  and name like 'marketing/team/%'
  and (public.is_super_admin() or public.is_marketing_editor())
);
