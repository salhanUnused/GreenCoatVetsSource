-- =============================================================================
-- Handover migration 044/100
-- Original: supabase/migrations/20260328210000_team_management_rpcs.sql
-- Purpose: Team management: clinic admins and super admins can assign roles and remove clinic access safely.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Team management: clinic admins and super admins can assign roles and remove clinic access safely.

create or replace function public._actor_can_manage_clinic(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.user_clinic_memberships m
      where m.user_id = auth.uid()
        and m.clinic_id = p_clinic_id
        and m.role = 'clinic_admin'
        and m.is_active = true
    );
$$;

create or replace function public.list_clinic_team_members(p_clinic_id uuid)
returns table (
  user_id uuid,
  email text,
  role public.app_role,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not public._actor_can_manage_clinic(p_clinic_id) then
    raise exception 'Not allowed to view this clinic team.';
  end if;

  return query
  select m.user_id, coalesce(au.email, ''), m.role, m.is_active, m.updated_at
  from public.user_clinic_memberships m
  left join public.app_users au on au.id = m.user_id
  where m.clinic_id = p_clinic_id
  order by m.updated_at desc nulls last;
end;
$$;

create or replace function public.lookup_user_id_for_clinic_assignment(p_clinic_id uuid, p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not public._actor_can_manage_clinic(p_clinic_id) then
    raise exception 'Not allowed.';
  end if;

  select au.id into v_uid
  from public.app_users au
  where lower(trim(au.email)) = lower(trim(p_email))
  limit 1;

  return v_uid;
end;
$$;

create or replace function public.assign_user_to_clinic_by_admin(
  p_target_user_id uuid,
  p_clinic_id uuid,
  p_role public.app_role,
  p_staff_full_name text default null,
  p_staff_phone text default null,
  p_working_hours text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not public._actor_can_manage_clinic(p_clinic_id) then
    raise exception 'Not allowed to assign roles for this clinic.';
  end if;

  if p_role = 'super_admin' then
    raise exception 'Invalid role.';
  end if;

  if not public.is_super_admin() then
    if p_role = 'clinic_admin' then
      raise exception 'Only platform super admin can assign clinic admin.';
    end if;
  end if;

  perform public.assign_user_clinic_role(
    p_target_user_id,
    p_clinic_id,
    p_role,
    p_staff_full_name,
    p_staff_phone,
    p_working_hours
  );
end;
$$;

create or replace function public.deactivate_user_clinic_membership_by_admin(
  p_target_user_id uuid,
  p_clinic_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'You cannot remove your own access.';
  end if;
  if not public._actor_can_manage_clinic(p_clinic_id) then
    raise exception 'Not allowed.';
  end if;

  update public.user_clinic_memberships m
  set is_active = false, updated_at = now()
  where m.user_id = p_target_user_id
    and m.clinic_id = p_clinic_id;

  update public.staff_profiles sp
  set is_active = false, updated_at = now()
  where sp.user_id = p_target_user_id
    and sp.clinic_id = p_clinic_id;
end;
$$;

/** Deactivate all clinic access for a user (super admin). Does not delete the auth account. */
create or replace function public.super_admin_deactivate_user_everywhere(p_user_id uuid)
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
    raise exception 'You cannot remove your own access.';
  end if;

  update public.user_clinic_memberships m
  set is_active = false, updated_at = now()
  where m.user_id = p_user_id;

  update public.staff_profiles sp
  set is_active = false, updated_at = now()
  where sp.user_id = p_user_id;

  update public.owners o
  set user_id = null, updated_at = now()
  where o.user_id = p_user_id;

  delete from public.platform_super_admins p where p.user_id = p_user_id;
end;
$$;

grant execute on function public.list_clinic_team_members(uuid) to authenticated;
grant execute on function public.lookup_user_id_for_clinic_assignment(uuid, text) to authenticated;
grant execute on function public.assign_user_to_clinic_by_admin(uuid, uuid, public.app_role, text, text, text) to authenticated;
grant execute on function public.deactivate_user_clinic_membership_by_admin(uuid, uuid) to authenticated;
grant execute on function public.super_admin_deactivate_user_everywhere(uuid) to authenticated;
