-- =============================================================================
-- Handover migration 077/100
-- Original: supabase/migrations/20260519150000_portal_oauth_email_reconcile.sql
-- Purpose: Web portal access checks and OAuth email reconciliation (admin-created staff + Google sign-in).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Web portal access checks and OAuth email reconciliation (admin-created staff + Google sign-in).

create or replace function public.user_has_web_portal_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.platform_super_admins psa where psa.user_id = p_user_id)
    or exists (
      select 1
      from public.user_clinic_memberships m
      where m.user_id = p_user_id
        and m.is_active = true
        and m.role in (
          'super_admin',
          'clinic_admin',
          'branch_admin',
          'doctor',
          'receptionist',
          'lab_technician',
          'pharmacist'
        )
    )
    or exists (
      select 1
      from public.staff_profiles sp
      where sp.user_id = p_user_id
        and sp.is_active = true
        and sp.role in (
          'super_admin',
          'clinic_admin',
          'branch_admin',
          'doctor',
          'receptionist',
          'lab_technician',
          'pharmacist'
        )
    );
$$;

create or replace function public.email_has_web_portal_access(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users au
    where lower(trim(au.email)) = lower(trim(p_email))
      and public.user_has_web_portal_access(au.id)
  );
$$;

create or replace function public.reconcile_portal_auth_user_by_email()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current uuid := auth.uid();
  v_email text;
  v_legacy uuid;
  v_reconciled boolean := false;
begin
  if v_current is null then
    raise exception 'Not authenticated';
  end if;

  if public.user_has_web_portal_access(v_current) then
    return jsonb_build_object('ok', true, 'reconciled', false, 'reason', 'already_has_access');
  end if;

  select u.email into v_email from auth.users u where u.id = v_current;
  if v_email is null or trim(v_email) = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_email');
  end if;

  select au.id
  into v_legacy
  from public.app_users au
  where lower(trim(au.email)) = lower(trim(v_email))
    and au.id <> v_current
    and public.user_has_web_portal_access(au.id)
  order by au.updated_at desc nulls last
  limit 1;

  if v_legacy is null then
    return jsonb_build_object('ok', true, 'reconciled', false, 'reason', 'no_legacy_staff_user');
  end if;

  update public.user_clinic_memberships m
  set user_id = v_current, updated_at = now()
  where m.user_id = v_legacy
    and not exists (
      select 1
      from public.user_clinic_memberships x
      where x.user_id = v_current
        and x.clinic_id = m.clinic_id
        and x.role = m.role
    );

  delete from public.user_clinic_memberships where user_id = v_legacy;

  update public.staff_profiles sp
  set user_id = v_current, updated_at = now()
  where sp.user_id = v_legacy
    and not exists (
      select 1
      from public.staff_profiles x
      where x.user_id = v_current
        and x.clinic_id = sp.clinic_id
        and x.branch_id is not distinct from sp.branch_id
        and x.role = sp.role
    );

  delete from public.staff_profiles where user_id = v_legacy;

  insert into public.platform_super_admins (user_id)
  select v_current
  from public.platform_super_admins psa
  where psa.user_id = v_legacy
  on conflict (user_id) do nothing;

  delete from public.platform_super_admins where user_id = v_legacy;

  v_reconciled := true;
  return jsonb_build_object(
    'ok',
    true,
    'reconciled',
    v_reconciled,
    'from_user_id',
    v_legacy,
    'has_access',
    public.user_has_web_portal_access(v_current)
  );
end;
$$;

comment on function public.reconcile_portal_auth_user_by_email is
  'When Google OAuth creates a new auth user for an email that already has clinic staff rows, move memberships and staff profiles to auth.uid().';

grant execute on function public.user_has_web_portal_access(uuid) to authenticated, service_role;
grant execute on function public.email_has_web_portal_access(text) to authenticated, service_role;
grant execute on function public.reconcile_portal_auth_user_by_email() to authenticated;
