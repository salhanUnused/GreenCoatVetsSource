-- =============================================================================
-- Handover migration 013/100
-- Original: supabase/migrations/20260321050000_platform_super_admin_without_clinic.sql
-- Purpose: platform super admin without clinic
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create table if not exists public.platform_super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_super_admins enable row level security;

drop policy if exists platform_super_admins_select_self_or_super_admin on public.platform_super_admins;
create policy platform_super_admins_select_self_or_super_admin on public.platform_super_admins
for select
using (
  user_id = auth.uid() or public.is_super_admin()
);

drop policy if exists platform_super_admins_manage_super_admin on public.platform_super_admins;
create policy platform_super_admins_manage_super_admin on public.platform_super_admins
for all
using (public.is_super_admin())
with check (public.is_super_admin());

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.platform_super_admins psa
      where psa.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.user_clinic_memberships m
      where m.user_id = auth.uid()
        and m.role = 'super_admin'
        and m.is_active = true
    );
$$;

create or replace function public.bootstrap_super_admin(
  p_user_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_user_email is null or length(trim(p_user_email)) = 0 then
    raise exception 'User email is required.';
  end if;

  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_user_email))
  limit 1;

  if v_user_id is null then
    raise exception 'User not found in auth.users for email: %', p_user_email;
  end if;

  insert into public.platform_super_admins (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return v_user_id;
end;
$$;

grant execute on function public.bootstrap_super_admin(text) to service_role;
