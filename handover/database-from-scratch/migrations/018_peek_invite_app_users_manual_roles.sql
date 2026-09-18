-- =============================================================================
-- Handover migration 018/100
-- Original: supabase/migrations/20260321120000_peek_invite_app_users_manual_roles.sql
-- Purpose: Preview invite (for mobile QR UX) without consuming.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Preview invite (for mobile QR UX) without consuming.
create or replace function public.peek_clinic_role_invite(p_token text)
returns table (role public.app_role, clinic_name text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return;
  end if;

  return query
  select i.role, c.name
  from public.clinic_role_invites i
  join public.clinics c on c.id = i.clinic_id
  where i.token = trim(p_token)
    and i.is_active = true
    and (i.expires_at is null or i.expires_at > now())
    and (i.max_uses is null or i.used_count < i.max_uses)
  limit 1;
end;
$$;

grant execute on function public.peek_clinic_role_invite(text) to anon, authenticated;

-- Staff roles: include lab + pharmacy in membership helpers (used by manual assign + invites).
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

-- Manual role assignment via public.app_users (Supabase Table Editor: enum dropdowns).
alter table public.app_users
  add column if not exists manual_clinic_id uuid references public.clinics(id) on delete set null;

alter table public.app_users
  add column if not exists manual_role public.app_role;

comment on column public.app_users.manual_clinic_id is 'Optional: clinic to grant access when manual_role is set (super admin / SQL only).';
comment on column public.app_users.manual_role is 'Optional: role to grant together with manual_clinic_id. Fires assign_user_clinic_role via trigger.';

create or replace function public.app_users_apply_manual_clinic_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if new.manual_clinic_id is null or new.manual_role is null then
    return new;
  end if;

  select u.email into v_email from auth.users u where u.id = new.id limit 1;

  perform public.assign_user_clinic_role(
    new.id,
    new.manual_clinic_id,
    new.manual_role,
    coalesce(nullif(trim(coalesce(v_email, '')), ''), 'User'),
    null
  );

  return new;
end;
$$;

drop trigger if exists trg_app_users_manual_role on public.app_users;
create trigger trg_app_users_manual_role
after insert or update of manual_clinic_id, manual_role on public.app_users
for each row
when (new.manual_clinic_id is not null and new.manual_role is not null)
execute function public.app_users_apply_manual_clinic_role();
