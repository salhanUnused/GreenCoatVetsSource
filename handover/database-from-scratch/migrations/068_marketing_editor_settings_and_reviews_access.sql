-- =============================================================================
-- Handover migration 068/100
-- Original: supabase/migrations/20260512132000_marketing_editor_settings_and_reviews_access.sql
-- Purpose: marketing editor settings and reviews access
-- Apply in order. Do not skip or reorder.
-- =============================================================================

drop policy if exists marketing_site_settings_write on public.marketing_site_settings;
create policy marketing_site_settings_write
on public.marketing_site_settings
for all
to authenticated
using (public.is_super_admin() or public.is_marketing_editor())
with check (public.is_super_admin() or public.is_marketing_editor());

drop policy if exists marketing_reviews_public_read on public.marketing_reviews;
create policy marketing_reviews_public_read on public.marketing_reviews
for select
to anon, authenticated
using (is_active = true or public.is_super_admin() or public.is_marketing_editor());

drop policy if exists marketing_reviews_super_admin_write on public.marketing_reviews;
create policy marketing_reviews_super_admin_write on public.marketing_reviews
for all
to authenticated
using (public.is_super_admin() or public.is_marketing_editor())
with check (public.is_super_admin() or public.is_marketing_editor());
