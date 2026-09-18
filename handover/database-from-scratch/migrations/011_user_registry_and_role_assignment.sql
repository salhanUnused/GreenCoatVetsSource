-- =============================================================================
-- Handover migration 011/100
-- Original: supabase/migrations/20260321035500_user_registry_and_role_assignment.sql
-- Purpose: Keep function callable only from privileged contexts (SQL editor/service role).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  raw_user_meta_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_users_email on public.app_users(email);

create trigger set_updated_at_app_users
before update on public.app_users
for each row execute function public.set_updated_at();

create or replace function public.sync_app_user_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (id, email, phone, raw_user_meta_data, created_at, updated_at)
  values (new.id, new.email, new.phone, new.raw_user_meta_data, now(), now())
  on conflict (id) do update
  set
    email = excluded.email,
    phone = excluded.phone,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sync_app_users on auth.users;
create trigger on_auth_user_created_sync_app_users
after insert or update on auth.users
for each row execute function public.sync_app_user_from_auth();

insert into public.app_users (id, email, phone, raw_user_meta_data, created_at, updated_at)
select u.id, u.email, u.phone, u.raw_user_meta_data, coalesce(u.created_at, now()), now()
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  phone = excluded.phone,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

alter table public.app_users enable row level security;

drop policy if exists app_users_select_self_or_super_admin on public.app_users;
create policy app_users_select_self_or_super_admin on public.app_users
for select
using (
  id = auth.uid() or public.is_super_admin()
);

drop policy if exists app_users_manage_super_admin on public.app_users;
create policy app_users_manage_super_admin on public.app_users
for all
using (public.is_super_admin())
with check (public.is_super_admin());

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

  if p_role in ('clinic_admin', 'branch_admin', 'doctor', 'receptionist') then
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

-- Keep function callable only from privileged contexts (SQL editor/service role).
revoke all on function public.assign_user_clinic_role(uuid, uuid, public.app_role, text, text) from public;
