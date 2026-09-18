-- =============================================================================
-- Handover migration 020/100
-- Original: supabase/migrations/20260321140000_single_active_membership_per_clinic.sql
-- Purpose: Problem: assign_user_clinic_role only activated the new role row; older rows for the same
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Problem: assign_user_clinic_role only activated the new role row; older rows for the same
-- (user_id, clinic_id) stayed is_active = true. The app used .limit(1) without ORDER BY,
-- so the UI could keep showing "clinic_admin" after changing manual_role to another role.

create or replace function public.deactivate_other_membership_roles(
  p_user_id uuid,
  p_clinic_id uuid,
  p_keep_role public.app_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_clinic_id is null or p_keep_role is null then
    return;
  end if;

  update public.user_clinic_memberships
  set is_active = false, updated_at = now()
  where user_id = p_user_id
    and clinic_id = p_clinic_id
    and role is distinct from p_keep_role
    and is_active = true;

  -- Align staff_profiles (null branch = clinic-wide staff role rows)
  update public.staff_profiles
  set is_active = false, updated_at = now()
  where user_id = p_user_id
    and clinic_id = p_clinic_id
    and branch_id is null
    and role is distinct from p_keep_role
    and is_active = true;
end;
$$;

revoke all on function public.deactivate_other_membership_roles(uuid, uuid, public.app_role) from public;

create or replace function public.assign_user_clinic_role(
  p_user_id uuid,
  p_clinic_id uuid,
  p_role public.app_role,
  p_staff_full_name text default null,
  p_staff_phone text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_clinic_id is null or p_role is null then
    raise exception 'user_id, clinic_id and role are required.';
  end if;

  insert into public.user_clinic_memberships (user_id, clinic_id, role, is_active)
  values (p_user_id, p_clinic_id, p_role, true)
  on conflict (user_id, clinic_id, role)
  do update set
    is_active = true,
    updated_at = now();

  perform public.deactivate_other_membership_roles(p_user_id, p_clinic_id, p_role);

  if p_role in (
    'clinic_admin', 'branch_admin', 'doctor', 'receptionist',
    'lab_technician', 'pharmacist'
  ) then
    insert into public.staff_profiles (user_id, clinic_id, branch_id, role, full_name, phone, is_active)
    values (
      p_user_id,
      p_clinic_id,
      null,
      p_role,
      coalesce(nullif(trim(coalesce(p_staff_full_name, '')), ''), 'Staff Member'),
      nullif(trim(coalesce(p_staff_phone, '')), ''),
      true
    )
    on conflict (user_id, clinic_id, branch_id, role)
    do update set
      is_active = true,
      full_name = excluded.full_name,
      phone = excluded.phone,
      updated_at = now();
  end if;
end;
$$;

-- After invite consumption, only one active role per clinic for this user
create or replace function public.consume_clinic_role_invite(
  p_token text,
  p_full_name text default null,
  p_phone text default null
)
returns table (clinic_id uuid, role public.app_role)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_invite public.clinic_role_invites%rowtype;
  v_name text;
  v_phone text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'Invite token is required.';
  end if;

  select *
  into v_invite
  from public.clinic_role_invites i
  where i.token = trim(p_token)
    and i.is_active = true
    and (i.expires_at is null or i.expires_at > now())
    and (i.max_uses is null or i.used_count < i.max_uses)
  limit 1
  for update;

  if not found then
    raise exception 'Invalid or expired invite.';
  end if;

  insert into public.user_clinic_memberships (user_id, clinic_id, role, is_active)
  values (v_user_id, v_invite.clinic_id, v_invite.role, true)
  on conflict (user_id, clinic_id, role)
  do update set
    is_active = true,
    updated_at = now();

  perform public.deactivate_other_membership_roles(v_user_id, v_invite.clinic_id, v_invite.role);

  v_name := nullif(trim(coalesce(p_full_name, '')), '');
  v_phone := nullif(trim(coalesce(p_phone, '')), '');

  if v_invite.role = 'pet_owner' then
    if not exists (
      select 1
      from public.owners o
      where o.clinic_id = v_invite.clinic_id
        and o.user_id = v_user_id
    ) then
      insert into public.owners (clinic_id, user_id, full_name, phone)
      values (
        v_invite.clinic_id,
        v_user_id,
        coalesce(v_name, 'Pet Owner'),
        coalesce(v_phone, 'NA')
      );
    end if;
  elsif v_invite.role in (
    'clinic_admin', 'branch_admin', 'doctor', 'receptionist',
    'lab_technician', 'pharmacist'
  ) then
    if not exists (
      select 1
      from public.staff_profiles sp
      where sp.clinic_id = v_invite.clinic_id
        and sp.user_id = v_user_id
        and sp.role = v_invite.role
        and sp.branch_id is null
    ) then
      insert into public.staff_profiles (user_id, clinic_id, branch_id, role, full_name, phone, is_active)
      values (
        v_user_id,
        v_invite.clinic_id,
        null,
        v_invite.role,
        coalesce(v_name, 'Staff Member'),
        v_phone,
        true
      );
    end if;
  end if;

  update public.clinic_role_invites
  set
    used_count = used_count + 1,
    used_by_last = v_user_id,
    used_at_last = now(),
    updated_at = now()
  where id = v_invite.id;

  return query
  select v_invite.clinic_id, v_invite.role;
end;
$$;

grant execute on function public.consume_clinic_role_invite(text, text, text) to authenticated;

-- One-time cleanup: for each (user_id, clinic_id) with multiple active rows, keep the newest and deactivate the rest
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, clinic_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM public.user_clinic_memberships
  WHERE is_active = true
)
UPDATE public.user_clinic_memberships m
SET is_active = false, updated_at = now()
FROM ranked r
WHERE m.id = r.id
  AND r.rn > 1;
