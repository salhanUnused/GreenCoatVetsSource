-- =============================================================================
-- Handover migration 078/100
-- Original: supabase/migrations/20260519160000_reconcile_portal_oauth_service_role.sql
-- Purpose: Service-role OAuth reconcile (Google sign-in user id may differ from admin-provisioned auth user).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Service-role OAuth reconcile (Google sign-in user id may differ from admin-provisioned auth user).

create or replace function public.reconcile_portal_user_for_oauth(p_current uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_legacy uuid;
begin
  if p_current is null then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;

  if public.user_has_web_portal_access(p_current) then
    return jsonb_build_object('ok', true, 'reconciled', false, 'reason', 'already_has_access');
  end if;

  if v_email = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_email');
  end if;

  select au.id
  into v_legacy
  from public.app_users au
  where lower(trim(coalesce(au.email, ''))) = v_email
    and au.id <> p_current
    and public.user_has_web_portal_access(au.id)
  order by au.updated_at desc nulls last
  limit 1;

  if v_legacy is null then
    return jsonb_build_object('ok', true, 'reconciled', false, 'reason', 'no_legacy_staff_user');
  end if;

  update public.user_clinic_memberships m
  set user_id = p_current, updated_at = now()
  where m.user_id = v_legacy
    and not exists (
      select 1
      from public.user_clinic_memberships x
      where x.user_id = p_current
        and x.clinic_id = m.clinic_id
        and x.role = m.role
    );

  delete from public.user_clinic_memberships where user_id = v_legacy;

  update public.staff_profiles sp
  set user_id = p_current, updated_at = now()
  where sp.user_id = v_legacy
    and not exists (
      select 1
      from public.staff_profiles x
      where x.user_id = p_current
        and x.clinic_id = sp.clinic_id
        and x.branch_id is not distinct from sp.branch_id
        and x.role = sp.role
    );

  delete from public.staff_profiles where user_id = v_legacy;

  insert into public.platform_super_admins (user_id)
  select p_current
  from public.platform_super_admins psa
  where psa.user_id = v_legacy
  on conflict (user_id) do nothing;

  delete from public.platform_super_admins where user_id = v_legacy;

  return jsonb_build_object(
    'ok',
    true,
    'reconciled',
    true,
    'from_user_id',
    v_legacy,
    'has_access',
    public.user_has_web_portal_access(p_current)
  );
end;
$$;

revoke all on function public.reconcile_portal_user_for_oauth(uuid, text) from public;
grant execute on function public.reconcile_portal_user_for_oauth(uuid, text) to service_role;
