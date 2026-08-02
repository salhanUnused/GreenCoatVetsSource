-- Allow marketing editors to manage FAQs, locations, and footer (content tools).

drop policy if exists marketing_locations_super_admin on public.marketing_locations;
create policy marketing_locations_manager_write
on public.marketing_locations
for all
to authenticated
using (public.is_super_admin() or public.is_marketing_editor())
with check (public.is_super_admin() or public.is_marketing_editor());

drop policy if exists marketing_faqs_public_read on public.marketing_faqs;
create policy marketing_faqs_public_read on public.marketing_faqs
for select
to anon, authenticated
using (is_active = true or public.is_super_admin() or public.is_marketing_editor());

drop policy if exists marketing_faqs_super_admin_write on public.marketing_faqs;
create policy marketing_faqs_manager_write on public.marketing_faqs
for all
to authenticated
using (public.is_super_admin() or public.is_marketing_editor())
with check (public.is_super_admin() or public.is_marketing_editor());

drop policy if exists marketing_footer_groups_write on public.marketing_footer_groups;
create policy marketing_footer_groups_manager_write on public.marketing_footer_groups
for all
to authenticated
using (public.is_super_admin() or public.is_marketing_editor())
with check (public.is_super_admin() or public.is_marketing_editor());

drop policy if exists marketing_footer_links_select on public.marketing_footer_links;
create policy marketing_footer_links_select on public.marketing_footer_links
for select
to anon, authenticated
using (is_active = true or public.is_super_admin() or public.is_marketing_editor());

drop policy if exists marketing_footer_links_write on public.marketing_footer_links;
create policy marketing_footer_links_manager_write on public.marketing_footer_links
for all
to authenticated
using (public.is_super_admin() or public.is_marketing_editor())
with check (public.is_super_admin() or public.is_marketing_editor());
