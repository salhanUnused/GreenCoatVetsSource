-- =============================================================================
-- Handover migration 053/100
-- Original: supabase/migrations/20260330090000_super_admin_delete_user_from_database.sql
-- Purpose: super admin delete user from database
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create or replace function public.super_admin_delete_user_from_database(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not public.is_super_admin() then
    raise exception 'Only super admin can perform this action.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;

  -- First remove active access and role bindings.
  perform public.super_admin_deactivate_user_everywhere(p_user_id);

  -- Remove from app registry table (auth.users remains managed separately).
  delete from public.app_users u
  where u.id = p_user_id;
end;
$$;

grant execute on function public.super_admin_delete_user_from_database(uuid) to authenticated;
