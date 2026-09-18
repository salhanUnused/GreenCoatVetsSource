-- =============================================================================
-- Handover migration 027/100
-- Original: supabase/migrations/20260323180000_marketing_editor_blog_analytics.sql
-- Purpose: Marketing editor role (blog-only), public blog read, page-view analytics.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Marketing editor role (blog-only), public blog read, page-view analytics.

-- 1) New role for staff who may only manage marketing blog content for a clinic
do $$
begin
  alter type public.app_role add value if not exists 'marketing_editor';
exception
  when duplicate_object then null;
end $$;

-- 2) Staff access excludes marketing_editor from non-blog resources (appointments, etc.)
create or replace function public.has_clinic_access(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.user_clinic_memberships m
    where m.user_id = auth.uid()
      and m.clinic_id = target_clinic_id
      and m.is_active = true
      -- Cast to text: new enum values cannot be referenced in the same txn as ADD VALUE (55P04).
      and (m.role)::text is distinct from 'marketing_editor'
  );
$$;

-- 3) Blog/CMS helpers
create or replace function public.is_marketing_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_clinic_memberships m
    where m.user_id = auth.uid()
      and (m.role)::text = 'marketing_editor'
      and m.is_active = true
  );
$$;

create or replace function public.is_marketing_editor_for_clinic(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_clinic_memberships m
    where m.user_id = auth.uid()
      and m.clinic_id = target_clinic_id
      and (m.role)::text = 'marketing_editor'
      and m.is_active = true
  );
$$;

grant execute on function public.is_marketing_editor() to authenticated;
grant execute on function public.is_marketing_editor_for_clinic(uuid) to authenticated;

-- 4) Featured image for blog cards / hero
alter table public.blog_posts
  add column if not exists featured_image_url text;

comment on column public.blog_posts.featured_image_url is 'Hero/card image URL for marketing site blog.';

-- 5) Anonymous page views (marketing site traffic)
create table if not exists public.marketing_site_page_views (
  id bigserial primary key,
  path text not null check (char_length(path) <= 2048),
  created_at timestamptz not null default now()
);

create index if not exists marketing_site_page_views_created_at_idx
  on public.marketing_site_page_views (created_at desc);

create index if not exists marketing_site_page_views_path_idx
  on public.marketing_site_page_views (path);

comment on table public.marketing_site_page_views is 'Append-only hits from the public marketing site; used for admin traffic stats.';

alter table public.marketing_site_page_views enable row level security;

drop policy if exists marketing_site_page_views_insert_public on public.marketing_site_page_views;
create policy marketing_site_page_views_insert_public
on public.marketing_site_page_views
for insert
to anon, authenticated
with check (char_length(path) >= 1);

drop policy if exists marketing_site_page_views_select_super on public.marketing_site_page_views;
create policy marketing_site_page_views_select_super
on public.marketing_site_page_views
for select
to authenticated
using (public.is_super_admin());

-- 6) Blog RLS: replace single policies with staff + editor + public read
drop policy if exists blog_posts_policy on public.blog_posts;
drop policy if exists blog_categories_policy on public.blog_categories;

-- Staff (non–marketing-editor) full CRUD via has_clinic_access
create policy blog_posts_tenant_staff on public.blog_posts
for all
to authenticated
using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

create policy blog_categories_tenant_staff on public.blog_categories
for all
to authenticated
using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

-- Marketing editor: blog + categories only for assigned clinic
create policy blog_posts_marketing_editor on public.blog_posts
for all
to authenticated
using (public.is_marketing_editor_for_clinic(clinic_id))
with check (public.is_marketing_editor_for_clinic(clinic_id));

create policy blog_categories_marketing_editor on public.blog_categories
for all
to authenticated
using (public.is_marketing_editor_for_clinic(clinic_id))
with check (public.is_marketing_editor_for_clinic(clinic_id));

-- 7) Safe public reads (anon): scoped by clinic — no cross-tenant leakage
create or replace function public.get_public_blog_posts(p_clinic_id uuid, p_limit int default 50)
returns table (
  id uuid,
  title text,
  slug text,
  excerpt text,
  featured_image_url text,
  published_at timestamptz,
  category_id uuid,
  category_name text,
  category_slug text,
  tags text[],
  ai_generated boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.title,
    p.slug,
    p.excerpt,
    p.featured_image_url,
    p.published_at,
    p.category_id,
    c.name as category_name,
    c.slug as category_slug,
    p.tags,
    p.ai_generated
  from public.blog_posts p
  left join public.blog_categories c on c.id = p.category_id
  where p.clinic_id = p_clinic_id
    and p.status = 'published'
    and exists (select 1 from public.clinics cl where cl.id = p_clinic_id and cl.is_active = true)
  order by p.published_at desc nulls last
  limit greatest(1, least(p_limit, 100));
$$;

create or replace function public.get_public_blog_post_by_slug(p_clinic_id uuid, p_slug text)
returns table (
  id uuid,
  title text,
  slug text,
  excerpt text,
  body_markdown text,
  body_html text,
  featured_image_url text,
  published_at timestamptz,
  category_id uuid,
  category_name text,
  category_slug text,
  tags text[],
  ai_generated boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.title,
    p.slug,
    p.excerpt,
    p.body_markdown,
    p.body_html,
    p.featured_image_url,
    p.published_at,
    p.category_id,
    c.name as category_name,
    c.slug as category_slug,
    p.tags,
    p.ai_generated
  from public.blog_posts p
  left join public.blog_categories c on c.id = p.category_id
  where p.clinic_id = p_clinic_id
    and p.slug = p_slug
    and p.status = 'published'
    and exists (select 1 from public.clinics cl where cl.id = p_clinic_id and cl.is_active = true)
  limit 1;
$$;

create or replace function public.get_public_blog_categories_list(p_clinic_id uuid)
returns table (id uuid, name text, slug text)
language sql
stable
security definer
set search_path = public
as $$
  select bc.id, bc.name, bc.slug
  from public.blog_categories bc
  where bc.clinic_id = p_clinic_id
    and exists (select 1 from public.clinics c where c.id = bc.clinic_id and c.is_active = true);
$$;

create or replace function public.get_public_blog_tag_counts(p_clinic_id uuid)
returns table (tag text, post_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select x.tag, count(*)::bigint as post_count
  from public.blog_posts p
  cross join lateral unnest(coalesce(p.tags, array[]::text[])) as x(tag)
  where p.clinic_id = p_clinic_id
    and p.status = 'published'
  group by x.tag
  order by count(*) desc
  limit 20;
$$;

grant execute on function public.get_public_blog_posts(uuid, int) to anon, authenticated;
grant execute on function public.get_public_blog_post_by_slug(uuid, text) to anon, authenticated;
grant execute on function public.get_public_blog_categories_list(uuid) to anon, authenticated;
grant execute on function public.get_public_blog_tag_counts(uuid) to anon, authenticated;
