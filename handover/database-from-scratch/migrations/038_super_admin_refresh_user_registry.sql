-- =============================================================================
-- Handover migration 038/100
-- Original: supabase/migrations/20260326130000_super_admin_refresh_user_registry.sql
-- Purpose: Super-admin cleanup for user registry consistency.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Super-admin cleanup for user registry consistency.
-- If a user is removed from public.app_users, remove role/profile ties everywhere.

create or replace function public.cleanup_deleted_app_user_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_clinic_memberships m where m.user_id = old.id;
  delete from public.staff_profiles sp where sp.user_id = old.id;
  update public.owners o set user_id = null where o.user_id = old.id;
  delete from public.platform_super_admins p where p.user_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_cleanup_deleted_app_user_refs on public.app_users;
create trigger trg_cleanup_deleted_app_user_refs
after delete on public.app_users
for each row execute function public.cleanup_deleted_app_user_refs();

create or replace function public.super_admin_refresh_user_registry()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_memberships_removed int := 0;
  v_staff_removed int := 0;
  v_owners_detached int := 0;
  v_platform_super_removed int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'Only super admin can refresh user registry.';
  end if;

  delete from public.user_clinic_memberships m
  where not exists (select 1 from public.app_users au where au.id = m.user_id);
  get diagnostics v_memberships_removed = row_count;

  delete from public.staff_profiles sp
  where not exists (select 1 from public.app_users au where au.id = sp.user_id);
  get diagnostics v_staff_removed = row_count;

  update public.owners o
  set user_id = null
  where o.user_id is not null
    and not exists (select 1 from public.app_users au where au.id = o.user_id);
  get diagnostics v_owners_detached = row_count;

  delete from public.platform_super_admins p
  where not exists (select 1 from public.app_users au where au.id = p.user_id);
  get diagnostics v_platform_super_removed = row_count;

  return jsonb_build_object(
    'memberships_removed', v_memberships_removed,
    'staff_profiles_removed', v_staff_removed,
    'owners_detached', v_owners_detached,
    'platform_super_admin_removed', v_platform_super_removed
  );
end;
$$;

grant execute on function public.super_admin_refresh_user_registry() to authenticated;
