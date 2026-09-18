-- =============================================================================
-- Handover migration 032/100
-- Original: supabase/migrations/20260325160000_marketing_footer_nav.sql
-- Purpose: Configurable marketing site footer columns and links (super admin).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Configurable marketing site footer columns and links (super admin).

create table if not exists public.marketing_footer_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_footer_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.marketing_footer_groups (id) on delete cascade,
  label text not null,
  href text not null,
  sort_order int not null default 0,
  open_in_new_tab boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_footer_links_group_sort_idx
  on public.marketing_footer_links (group_id, sort_order, label);

comment on table public.marketing_footer_groups is 'Footer column titles for the marketing website.';
comment on table public.marketing_footer_links is 'Footer links; href may be internal path or absolute URL.';

create trigger set_updated_at_marketing_footer_groups
  before update on public.marketing_footer_groups
  for each row execute function public.set_updated_at();

create trigger set_updated_at_marketing_footer_links
  before update on public.marketing_footer_links
  for each row execute function public.set_updated_at();

alter table public.marketing_footer_groups enable row level security;
alter table public.marketing_footer_links enable row level security;

drop policy if exists marketing_footer_groups_select on public.marketing_footer_groups;
create policy marketing_footer_groups_select on public.marketing_footer_groups
for select
to anon, authenticated
using (true);

drop policy if exists marketing_footer_groups_write on public.marketing_footer_groups;
create policy marketing_footer_groups_write on public.marketing_footer_groups
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists marketing_footer_links_select on public.marketing_footer_links;
create policy marketing_footer_links_select on public.marketing_footer_links
for select
to anon, authenticated
using (is_active = true or public.is_super_admin());

drop policy if exists marketing_footer_links_write on public.marketing_footer_links;
create policy marketing_footer_links_write on public.marketing_footer_links
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Seed default columns + links (matches previous hardcoded footer).
insert into public.marketing_footer_groups (slug, title, sort_order)
values
  ('quick', 'Quick links', 0),
  ('account', 'Account & staff', 1)
on conflict (slug) do nothing;

insert into public.marketing_footer_links (group_id, label, href, sort_order, open_in_new_tab, is_active)
select g.id, v.label, v.href, v.ord, v.nt, true
from public.marketing_footer_groups g
cross join (values
  ('quick', 'About', '/about', 0, false),
  ('quick', 'Services', '/services', 1, false),
  ('quick', 'Locations', '/locations', 2, false),
  ('quick', 'Blog', '/blog', 3, false),
  ('quick', 'Our team', '/doctors', 4, false),
  ('quick', 'Community', '/community', 5, false),
  ('quick', 'FAQ', '/faq', 6, false),
  ('quick', 'Book appointment', '/book', 7, false),
  ('quick', 'Contact', '/contact', 8, false),
  ('account', 'Pet owner portal', '/account', 0, false),
  ('account', 'Pet owner login', '/login', 1, false),
  ('account', 'Create account', '/signup', 2, false),
  ('account', 'Online store', '/store', 3, false),
  ('account', 'Cart', '/cart', 4, false),
  ('account', 'Staff / admin login', '/admin/login', 5, false)
) as v(group_slug, label, href, ord, nt)
where g.slug = v.group_slug
  and not exists (
    select 1 from public.marketing_footer_links x where x.group_id = g.id and x.href = v.href and x.label = v.label
  );
