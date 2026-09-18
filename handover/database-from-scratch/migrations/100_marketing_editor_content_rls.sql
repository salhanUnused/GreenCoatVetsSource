-- =============================================================================
-- Handover migration 100/100
-- Original: supabase/migrations/20260802121000_marketing_editor_content_rls.sql
-- Purpose: Allow marketing editors to manage FAQs, locations, and footer (content tools).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Allow marketing editors to manage FAQs, locations, and footer (content tools).
-- Acquire exclusive locks in a fixed order first to avoid deadlocks with live traffic.
-- ALTER POLICY (in place) is safer than DROP+CREATE rename churn.

begin;

set local lock_timeout = '30s';
set local deadlock_timeout = '1s';

lock table
  public.marketing_locations,
  public.marketing_faqs,
  public.marketing_footer_groups,
  public.marketing_footer_links
in access exclusive mode;

alter policy marketing_locations_super_admin on public.marketing_locations
  using (public.is_super_admin() or public.is_marketing_editor())
  with check (public.is_super_admin() or public.is_marketing_editor());

alter policy marketing_faqs_public_read on public.marketing_faqs
  using (is_active = true or public.is_super_admin() or public.is_marketing_editor());

alter policy marketing_faqs_super_admin_write on public.marketing_faqs
  using (public.is_super_admin() or public.is_marketing_editor())
  with check (public.is_super_admin() or public.is_marketing_editor());

alter policy marketing_footer_groups_write on public.marketing_footer_groups
  using (public.is_super_admin() or public.is_marketing_editor())
  with check (public.is_super_admin() or public.is_marketing_editor());

alter policy marketing_footer_links_select on public.marketing_footer_links
  using (is_active = true or public.is_super_admin() or public.is_marketing_editor());

alter policy marketing_footer_links_write on public.marketing_footer_links
  using (public.is_super_admin() or public.is_marketing_editor())
  with check (public.is_super_admin() or public.is_marketing_editor());

commit;
