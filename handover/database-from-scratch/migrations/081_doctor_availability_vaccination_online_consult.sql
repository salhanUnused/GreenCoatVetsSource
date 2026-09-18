-- =============================================================================
-- Handover migration 081/100
-- Original: supabase/migrations/20260520110000_doctor_availability_vaccination_online_consult.sql
-- Purpose: Doctor weekly availability, vaccination reminder preferences, Senior Vet online consultation.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Doctor weekly availability, vaccination reminder preferences, Senior Vet online consultation.
-- (appointment_type online_consult added in 20260520105000_appointment_type_online_consult.sql)

-- ─── Doctor availability (weekly rules per doctor) ───
create table if not exists public.doctor_availability_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  doctor_id uuid not null references public.staff_profiles(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null default '09:00',
  end_time time not null default '17:00',
  slot_minutes int not null default 30 check (slot_minutes between 10 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, day_of_week, start_time, end_time)
);

create index if not exists idx_doctor_availability_clinic_doctor
  on public.doctor_availability_rules (clinic_id, doctor_id, is_active);

drop trigger if exists set_updated_at_doctor_availability_rules on public.doctor_availability_rules;
create trigger set_updated_at_doctor_availability_rules
before update on public.doctor_availability_rules
for each row execute function public.set_updated_at();

alter table public.doctor_availability_rules enable row level security;

drop policy if exists doctor_availability_rules_policy on public.doctor_availability_rules;
create policy doctor_availability_rules_policy on public.doctor_availability_rules
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

-- ─── Vaccination reminder tokens (public respond link) ───
create table if not exists public.vaccination_reminder_tokens (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  vaccination_record_id uuid not null references public.vaccination_records(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  opted_out boolean not null default false,
  interval_days int not null default 30 check (interval_days between 1 and 365),
  last_status text check (last_status is null or last_status in ('pending', 'completed', 'not_done')),
  last_responded_at timestamptz,
  next_reminder_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vaccination_record_id)
);

create index if not exists idx_vaccination_reminder_tokens_next
  on public.vaccination_reminder_tokens (clinic_id, next_reminder_on)
  where opted_out = false;

drop trigger if exists set_updated_at_vaccination_reminder_tokens on public.vaccination_reminder_tokens;
create trigger set_updated_at_vaccination_reminder_tokens
before update on public.vaccination_reminder_tokens
for each row execute function public.set_updated_at();

alter table public.vaccination_reminder_tokens enable row level security;

drop policy if exists vaccination_reminder_tokens_staff on public.vaccination_reminder_tokens;
create policy vaccination_reminder_tokens_staff on public.vaccination_reminder_tokens
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

-- ─── Senior Vet online consultation (per clinic) ───
create table if not exists public.clinic_online_consult_settings (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  enabled boolean not null default false,
  product_name text not null default 'Senior Vet consultation',
  price_paise int not null default 99900 check (price_paise >= 0),
  duration_minutes int not null default 10 check (duration_minutes between 5 and 60),
  consent_version text not null default 'senior-vet-online-v1',
  reminder_minutes_before int not null default 20 check (reminder_minutes_before between 5 and 120),
  updated_at timestamptz not null default now()
);

alter table public.clinic_online_consult_settings enable row level security;

drop policy if exists clinic_online_consult_settings_read on public.clinic_online_consult_settings;
create policy clinic_online_consult_settings_read on public.clinic_online_consult_settings
for select using (true);

drop policy if exists clinic_online_consult_settings_manage on public.clinic_online_consult_settings;
create policy clinic_online_consult_settings_manage on public.clinic_online_consult_settings
for all using (
  exists (select 1 from public.platform_super_admins psa where psa.user_id = auth.uid())
  or exists (
    select 1 from public.user_clinic_memberships m
    where m.user_id = auth.uid() and m.is_active = true and m.role in ('clinic_admin', 'branch_admin', 'super_admin')
  )
)
with check (
  exists (select 1 from public.platform_super_admins psa where psa.user_id = auth.uid())
  or exists (
    select 1 from public.user_clinic_memberships m
    where m.user_id = auth.uid() and m.is_active = true and m.role in ('clinic_admin', 'branch_admin', 'super_admin')
  )
);

alter table public.appointments
  add column if not exists meet_link text,
  add column if not exists video_consent_pdf_path text,
  add column if not exists online_consult_paid_at timestamptz,
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists recording_url text,
  add column if not exists online_consent_signed_at timestamptz;

-- Public booking slots for a doctor on a calendar day (clinic timezone)
create or replace function public.get_public_booking_slots(
  p_clinic_id uuid,
  p_branch_id uuid,
  p_doctor_id uuid,
  p_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text := coalesce(nullif(trim((select timezone from public.clinics where id = p_clinic_id)), ''), 'UTC');
  v_dow int;
  v_slot jsonb := '[]'::jsonb;
  v_rule record;
  v_cursor timestamptz;
  v_end timestamptz;
  v_slot_end timestamptz;
  v_taken boolean;
begin
  if p_clinic_id is null or p_doctor_id is null or p_date is null then
    return '[]'::jsonb;
  end if;

  if not public.is_active_doctor_for_clinic(p_doctor_id, p_clinic_id) then
    return '[]'::jsonb;
  end if;

  v_dow := extract(dow from (p_date::timestamp at time zone v_tz))::int;

  for v_rule in
    select r.start_time, r.end_time, r.slot_minutes
    from public.doctor_availability_rules r
    where r.clinic_id = p_clinic_id
      and r.doctor_id = p_doctor_id
      and r.is_active = true
      and r.day_of_week = v_dow
      and (r.branch_id is null or r.branch_id = p_branch_id)
    order by r.start_time
  loop
    v_cursor := (p_date::text || ' ' || v_rule.start_time::text)::timestamp at time zone v_tz;
    v_end := (p_date::text || ' ' || v_rule.end_time::text)::timestamp at time zone v_tz;
    while v_cursor < v_end loop
      v_slot_end := v_cursor + make_interval(mins => v_rule.slot_minutes);
      if v_slot_end > v_end then exit; end if;
      if v_cursor > now() then
        select exists (
          select 1 from public.appointments a
          where a.clinic_id = p_clinic_id
            and a.doctor_id = p_doctor_id
            and a.starts_at = v_cursor
            and a.status in ('scheduled', 'checked_in')
        ) into v_taken;
        if not v_taken then
          v_slot := v_slot || jsonb_build_array(
            jsonb_build_object(
              'starts_at', to_char(v_cursor at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'ends_at', to_char(v_slot_end at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'label', to_char(v_cursor at time zone v_tz, 'HH12:MI AM')
            )
          );
        end if;
      end if;
      v_cursor := v_slot_end;
    end loop;
  end loop;

  -- Default Mon–Sat 9–17 if no rules configured
  if v_slot = '[]'::jsonb and not exists (
    select 1 from public.doctor_availability_rules r
    where r.clinic_id = p_clinic_id and r.doctor_id = p_doctor_id and r.is_active = true
  ) then
    if v_dow between 1 and 6 then
      v_cursor := (p_date::text || ' 09:00:00')::timestamp at time zone v_tz;
      v_end := (p_date::text || ' 17:00:00')::timestamp at time zone v_tz;
      while v_cursor < v_end loop
        v_slot_end := v_cursor + interval '30 minutes';
        if v_cursor > now() then
          select exists (
            select 1 from public.appointments a
            where a.clinic_id = p_clinic_id and a.doctor_id = p_doctor_id
              and a.starts_at = v_cursor and a.status in ('scheduled', 'checked_in')
          ) into v_taken;
          if not v_taken then
            v_slot := v_slot || jsonb_build_array(
              jsonb_build_object(
                'starts_at', to_char(v_cursor at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                'ends_at', to_char(v_slot_end at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                'label', to_char(v_cursor at time zone v_tz, 'HH12:MI AM')
              )
            );
          end if;
        end if;
        v_cursor := v_slot_end;
      end loop;
    end if;
  end if;

  return v_slot;
end;
$$;

revoke all on function public.get_public_booking_slots(uuid, uuid, uuid, date) from public;
grant execute on function public.get_public_booking_slots(uuid, uuid, uuid, date) to anon, authenticated;

-- Ensure vaccination reminder token exists for a record
create or replace function public.ensure_vaccination_reminder_token(p_vaccination_record_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_clinic uuid;
  v_due date;
begin
  select clinic_id, due_on::date into v_clinic, v_due
  from public.vaccination_records where id = p_vaccination_record_id;
  if v_clinic is null then
    raise exception 'Vaccination record not found';
  end if;

  insert into public.vaccination_reminder_tokens (
    clinic_id, vaccination_record_id, next_reminder_on
  )
  values (v_clinic, p_vaccination_record_id, coalesce(v_due, current_date))
  on conflict (vaccination_record_id) do update set updated_at = now()
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.ensure_vaccination_reminder_token(uuid) from public;
grant execute on function public.ensure_vaccination_reminder_token(uuid) to authenticated, service_role;

-- Public: owner responds to vaccination reminder
create or replace function public.respond_vaccination_reminder(
  p_token uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.vaccination_reminder_tokens%rowtype;
  v_status text := lower(trim(coalesce(p_status, '')));
  v_next date;
begin
  if v_status not in ('completed', 'not_done') then
    raise exception 'Invalid status';
  end if;

  select * into v_row from public.vaccination_reminder_tokens where token = p_token;
  if not found then
    raise exception 'Invalid or expired reminder link';
  end if;

  if v_status = 'completed' then
    update public.vaccination_records
    set status = 'completed', administered_on = coalesce(administered_on, current_date), updated_at = now()
    where id = v_row.vaccination_record_id;
    v_next := (current_date + (v_row.interval_days || ' days')::interval)::date;
    update public.vaccination_reminder_tokens
    set last_status = 'completed', last_responded_at = now(), next_reminder_on = v_next, updated_at = now()
    where id = v_row.id;
  else
    v_next := (current_date + interval '1 day')::date;
    update public.vaccination_reminder_tokens
    set last_status = 'not_done', last_responded_at = now(), next_reminder_on = v_next, updated_at = now()
    where id = v_row.id;
    update public.vaccination_records set status = 'due', reminder_sent_at = now() where id = v_row.vaccination_record_id;
  end if;

  return jsonb_build_object('ok', true, 'next_reminder_on', v_next, 'status', v_status);
end;
$$;

revoke all on function public.respond_vaccination_reminder(uuid, text) from public;
grant execute on function public.respond_vaccination_reminder(uuid, text) to anon, authenticated;

create or replace function public.opt_out_vaccination_reminder(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.vaccination_reminder_tokens
  set opted_out = true, updated_at = now()
  where token = p_token;
  if not found then
    raise exception 'Invalid reminder link';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.opt_out_vaccination_reminder(uuid) from public;
grant execute on function public.opt_out_vaccination_reminder(uuid) to anon, authenticated;

-- Senior Vet booking RPC is defined in 20260521120000_fix_senior_vet_consult_video_room.sql
