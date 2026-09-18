-- =============================================================================
-- Handover migration 010/100
-- Original: supabase/migrations/20260321032000_clinic_role_invites.sql
-- Purpose: Invite tokens for joining a clinic with a role (QR / email invites).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

create table if not exists public.clinic_role_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  role public.app_role not null,
  token text not null unique,
  label text,
  is_active boolean not null default true,
  max_uses int,
  used_count int not null default 0,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  used_by_last uuid references auth.users(id) on delete set null,
  used_at_last timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_uses is null or max_uses > 0),
  check (used_count >= 0)
);

create index if not exists idx_clinic_role_invites_clinic on public.clinic_role_invites(clinic_id, role, created_at desc);
create index if not exists idx_clinic_role_invites_token on public.clinic_role_invites(token);

create trigger set_updated_at_clinic_role_invites
before update on public.clinic_role_invites
for each row execute function public.set_updated_at();

alter table public.clinic_role_invites enable row level security;

drop policy if exists clinic_role_invites_select on public.clinic_role_invites;
create policy clinic_role_invites_select on public.clinic_role_invites
for select
using (
  public.has_clinic_access(clinic_id)
);

drop policy if exists clinic_role_invites_manage on public.clinic_role_invites;
create policy clinic_role_invites_manage on public.clinic_role_invites
for all
using (
  public.has_clinic_access(clinic_id)
)
with check (
  public.has_clinic_access(clinic_id)
);

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
  elsif v_invite.role in ('clinic_admin', 'branch_admin', 'doctor', 'receptionist') then
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
