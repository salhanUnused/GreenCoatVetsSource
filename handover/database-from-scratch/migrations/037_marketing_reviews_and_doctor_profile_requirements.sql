-- =============================================================================
-- Handover migration 037/100
-- Original: supabase/migrations/20260326113000_marketing_reviews_and_doctor_profile_requirements.sql
-- Purpose: Marketing reviews CMS + mandatory doctor profile fields during onboarding.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Marketing reviews CMS + mandatory doctor profile fields during onboarding.

-- ---------------------------------------------------------------------------
-- 1) Public marketing reviews (super-admin managed)
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_name text not null check (char_length(trim(reviewer_name)) > 0),
  pet_name text not null check (char_length(trim(pet_name)) > 0),
  message text not null check (char_length(trim(message)) > 0),
  stars int not null check (stars between 1 and 5),
  owner_image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_reviews_sort_idx
  on public.marketing_reviews (sort_order, created_at);

drop trigger if exists set_updated_at_marketing_reviews on public.marketing_reviews;
create trigger set_updated_at_marketing_reviews
  before update on public.marketing_reviews
  for each row execute function public.set_updated_at();

alter table public.marketing_reviews enable row level security;

drop policy if exists marketing_reviews_public_read on public.marketing_reviews;
create policy marketing_reviews_public_read on public.marketing_reviews
for select
to anon, authenticated
using (is_active = true or public.is_super_admin());

drop policy if exists marketing_reviews_super_admin_write on public.marketing_reviews;
create policy marketing_reviews_super_admin_write on public.marketing_reviews
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

insert into public.marketing_reviews (reviewer_name, pet_name, message, stars, owner_image_url, sort_order, is_active)
select x.reviewer_name, x.pet_name, x.message, x.stars, x.owner_image_url, x.sort_order, true
from (
  values
    ('Vikki', 'Hurley', 'Thank you for doing such a great job caring for our Hurley! Such good care, really put my mind at ease. Thanks!', 5, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXLIVwem-WWiNRC8HpPXFVnRo0P-yZIdo12_IMKZ64tgeUso48c0sEo1ybz4wN8ILmlgpVZ4UiRZHe4w_l1KqKqtsw8iYwYSEU0Kj_Uduj2egsu0-mlOFFiFKjsh5gSJ_nGh6ooZgvp3rt4vGj0Xo7QWz_a61N9hTA12kkNbVPP_zwLzi8cRm-GfZTjhJp338UxEdp18qvL44N6NutC6e194mEhOxqbXd6Th_LC0ciA5PP2hPrY_wmjdlOhNIsTFHFaWirWOLBcI4', 0),
    ('Uday', 'Jacky', 'Kind, friendly and professional — and best of all Jacky absolutely loved them. I would recommend them to anyone looking for dog care.', 5, 'https://lh3.googleusercontent.com/aida-public/AB6AXuAASNiqAa5i7M3JKCYXi4Byn3BaWf3Khqa9l0z9VWt7DIX7uAlPs7qlnFdw5519H7h5SjAxX5wlNjv-Uc6NqgtaL-jOGnRQsuo-y6K6TFSUqLeapYyg1JmNC8YiP_Hk73xYzZlGVajKZH7kQ7T6LHmE64-gre12TkuUZs8HgFogr0atwPnRKY49aN_bjC8hblSMZ3aVLHuEcJYLbW2TWVkM3w88y0Q1u9R9_7woJ9CBAjJ0QAHvIpEANHEuWUrvvXa_dmSWmNSIjCQ', 1)
) as x(reviewer_name, pet_name, message, stars, owner_image_url, sort_order)
where not exists (select 1 from public.marketing_reviews);

-- ---------------------------------------------------------------------------
-- 2) Doctor profile requirements
-- ---------------------------------------------------------------------------
alter table public.staff_profiles
  add column if not exists working_hours text;

update public.staff_profiles
set working_hours = coalesce(nullif(trim(working_hours), ''), 'To be updated')
where role = 'doctor';

alter table public.staff_profiles
  drop constraint if exists staff_profiles_doctor_required_fields;

alter table public.staff_profiles
  add constraint staff_profiles_doctor_required_fields
  check (
    role <> 'doctor'
    or (
      nullif(trim(full_name), '') is not null
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

  if p_role in (
    'clinic_admin', 'branch_admin', 'doctor', 'receptionist',
    'lab_technician', 'pharmacist'
  ) then
    v_working_hours := nullif(trim(coalesce(p_working_hours, '')), '');
    if p_role = 'doctor' and v_working_hours is null then
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
      case when p_role = 'doctor' then v_working_hours else null end
    )
    on conflict (user_id, clinic_id, branch_id, role)
    do update set
      is_active = true,
      full_name = excluded.full_name,
      phone = excluded.phone,
      working_hours = case
        when excluded.role = 'doctor' then excluded.working_hours
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
    if v_invite.role = 'doctor' and v_working_hours is null then
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
        case when v_invite.role = 'doctor' then v_working_hours else null end
      );
    else
      update public.staff_profiles
      set
        full_name = coalesce(v_name, full_name),
        phone = coalesce(v_phone, phone),
        working_hours = case
          when v_invite.role = 'doctor' then coalesce(v_working_hours, working_hours)
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

grant execute on function public.consume_clinic_role_invite(text, text, text, text) to authenticated;

drop function if exists public.get_public_booking_doctors(uuid);

create function public.get_public_booking_doctors(p_clinic_id uuid)
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
    and sp.role = 'doctor'
  order by sp.full_name asc;
$$;

revoke all on function public.get_public_booking_doctors(uuid) from public;
grant execute on function public.get_public_booking_doctors(uuid) to anon, authenticated;
