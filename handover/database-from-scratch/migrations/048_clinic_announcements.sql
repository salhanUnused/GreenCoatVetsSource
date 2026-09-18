-- =============================================================================
-- Handover migration 048/100
-- Original: supabase/migrations/20260328260000_clinic_announcements.sql
-- Purpose: Clinic-wide announcements: audit row + fan-out to staff notifications (channel push, payload kind clinic_announcement).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Clinic-wide announcements: audit row + fan-out to staff notifications (channel push, payload kind clinic_announcement).

create table if not exists public.clinic_announcements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  message text not null check (char_length(trim(message)) > 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists clinic_announcements_clinic_created_idx
  on public.clinic_announcements (clinic_id, created_at desc);

comment on table public.clinic_announcements is
  'Internal announcements published by clinic/branch admins or super-admin; fan-out copies live in public.notifications per staff user.';

alter table public.clinic_announcements enable row level security;

drop policy if exists clinic_announcements_select on public.clinic_announcements;
create policy clinic_announcements_select
on public.clinic_announcements
for select
to authenticated
using (public.has_clinic_access(clinic_id));

-- Inserts only via publish_clinic_announcement (security definer).

create or replace function public.publish_clinic_announcement(
  p_clinic_id uuid,
  p_title text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ann_id uuid;
  r record;
  v_title text := trim(coalesce(p_title, ''));
  v_message text := trim(coalesce(p_message, ''));
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if v_title = '' then
    raise exception 'Title is required';
  end if;
  if v_message = '' then
    raise exception 'Message is required';
  end if;

  if not public.is_super_admin() then
    if not exists (
      select 1
      from public.user_clinic_memberships m
      where m.user_id = v_uid
        and m.clinic_id = p_clinic_id
        and m.is_active = true
        and (m.role)::text in ('clinic_admin', 'branch_admin')
    ) then
      raise exception 'Not allowed to publish announcements for this clinic';
    end if;
  end if;

  insert into public.clinic_announcements (clinic_id, title, message, created_by)
  values (p_clinic_id, v_title, v_message, v_uid)
  returning id into v_ann_id;

  for r in
    select distinct m.user_id as uid
    from public.user_clinic_memberships m
    where m.clinic_id = p_clinic_id
      and m.is_active = true
      and (m.role)::text <> 'pet_owner'
  loop
    insert into public.notifications (
      clinic_id,
      user_id,
      owner_id,
      channel,
      title,
      message,
      payload,
      sent_at
    ) values (
      p_clinic_id,
      r.uid,
      null,
      'push',
      v_title,
      v_message,
      jsonb_build_object(
        'kind', 'clinic_announcement',
        'announcement_id', v_ann_id
      ),
      now()
    );
  end loop;

  return v_ann_id;
end;
$$;

revoke all on function public.publish_clinic_announcement(uuid, text, text) from public;
grant execute on function public.publish_clinic_announcement(uuid, text, text) to authenticated;
