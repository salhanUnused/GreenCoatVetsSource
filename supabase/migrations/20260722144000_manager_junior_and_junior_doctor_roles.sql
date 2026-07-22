-- Add manager, junior, and junior_doctor roles.
-- Junior doctor should behave like doctor for booking/availability checks.

do $$
begin
  alter type public.app_role add value if not exists 'junior_doctor';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type public.app_role add value if not exists 'manager';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter type public.app_role add value if not exists 'junior';
exception
  when duplicate_object then null;
end $$;

alter table public.staff_profiles
  drop constraint if exists staff_profiles_doctor_required_fields;

alter table public.staff_profiles
  add constraint staff_profiles_doctor_required_fields
  check (
    role::text not in ('doctor', 'junior_doctor', 'senior_doctor')
    or (
      nullif(trim(coalesce(full_name, '')), '') is not null
      and nullif(trim(coalesce(phone, '')), '') is not null
      and nullif(trim(coalesce(working_hours, '')), '') is not null
    )
  );

create or replace function public.assign_user_clinic_role(
  p_user_id uuid,
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
declare
  v_working_hours text;
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

  if p_role::text in (
    'clinic_admin', 'branch_admin', 'doctor', 'junior_doctor', 'senior_doctor', 'manager', 'junior', 'receptionist',
    'lab_technician', 'pharmacist'
  ) then
    v_working_hours := nullif(trim(coalesce(p_working_hours, '')), '');
    if p_role::text in ('doctor', 'junior_doctor', 'senior_doctor') and v_working_hours is null then
      raise exception 'Working hours are required for doctor onboarding.';
    end if;

    insert into public.staff_profiles (user_id, clinic_id, branch_id, role, full_name, phone, is_active, working_hours)
    values (
      p_user_id,
      p_clinic_id,
      null,
      p_role,
      coalesce(nullif(trim(coalesce(p_staff_full_name, '')), ''), 'Staff Member'),
      nullif(trim(coalesce(p_staff_phone, '')), ''),
      true,
      case when p_role::text in ('doctor', 'junior_doctor', 'senior_doctor') then v_working_hours else null end
    )
    on conflict (user_id, clinic_id, branch_id, role)
    do update set
      is_active = true,
      full_name = excluded.full_name,
      phone = excluded.phone,
      working_hours = case
        when excluded.role::text in ('doctor', 'junior_doctor', 'senior_doctor') then excluded.working_hours
        else staff_profiles.working_hours
      end,
      updated_at = now();
  end if;
end;
$$;

create or replace function public.consume_clinic_role_invite(
  p_token text,
  p_full_name text default null,
  p_phone text default null,
  p_working_hours text default null
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
  v_working_hours text;
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
  v_working_hours := nullif(trim(coalesce(p_working_hours, '')), '');

  if v_invite.role::text = 'pet_owner' then
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
  elsif v_invite.role::text in (
    'clinic_admin', 'branch_admin', 'doctor', 'junior_doctor', 'senior_doctor', 'manager', 'junior', 'receptionist',
    'lab_technician', 'pharmacist'
  ) then
    if v_invite.role::text in ('doctor', 'junior_doctor', 'senior_doctor') and v_working_hours is null then
      raise exception 'Working hours are required for doctor onboarding.';
    end if;

    if not exists (
      select 1
      from public.staff_profiles sp
      where sp.clinic_id = v_invite.clinic_id
        and sp.user_id = v_user_id
        and sp.role = v_invite.role
        and sp.branch_id is null
    ) then
      insert into public.staff_profiles (user_id, clinic_id, branch_id, role, full_name, phone, is_active, working_hours)
      values (
        v_user_id,
        v_invite.clinic_id,
        null,
        v_invite.role,
        coalesce(v_name, 'Staff Member'),
        v_phone,
        true,
        case when v_invite.role::text in ('doctor', 'junior_doctor', 'senior_doctor') then v_working_hours else null end
      );
    else
      update public.staff_profiles
      set
        full_name = coalesce(v_name, full_name),
        phone = coalesce(v_phone, phone),
        working_hours = case
          when v_invite.role::text in ('doctor', 'junior_doctor', 'senior_doctor') then coalesce(v_working_hours, working_hours)
          else working_hours
        end,
        is_active = true,
        updated_at = now()
      where clinic_id = v_invite.clinic_id
        and user_id = v_user_id
        and role = v_invite.role
        and branch_id is null;
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

create or replace function public.is_active_doctor_for_clinic(p_doctor_id uuid, p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.id = p_doctor_id
      and sp.clinic_id = p_clinic_id
      and sp.is_active = true
      and sp.role::text in ('doctor', 'junior_doctor', 'senior_doctor')
  );
$$;

create or replace function public.get_public_booking_doctors(p_clinic_id uuid)
returns table (
  id uuid,
  full_name text,
  branch_id uuid,
  working_hours text
)
language sql
stable
security definer
set search_path = public
as $$
  select sp.id, sp.full_name, sp.branch_id, sp.working_hours
  from public.staff_profiles sp
  where sp.clinic_id = p_clinic_id
    and sp.is_active = true
    and sp.role::text in ('doctor', 'junior_doctor', 'senior_doctor')
  order by sp.full_name asc;
$$;
