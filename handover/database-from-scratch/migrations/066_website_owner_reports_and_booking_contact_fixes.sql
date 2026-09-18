-- =============================================================================
-- Handover migration 066/100
-- Original: supabase/migrations/20260512114500_website_owner_reports_and_booking_contact_fixes.sql
-- Purpose: Owner-facing website visit report toggle, better owner profile seeding, and booking consent capture.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Owner-facing website visit report toggle, better owner profile seeding, and booking consent capture.
-- SQL-editor safe version:
-- - guards direct DDL so missing base tables do not abort the script immediately
-- - creates the booking RPC with enum signature when the enum exists
-- - otherwise creates a text-signature fallback so the script can still be pasted into SQL editor

do $$
begin
  if to_regclass('public.clinics') is not null then
    execute 'alter table public.clinics add column if not exists website_owner_visit_reports_enabled boolean not null default true';
    execute $sql$
      comment on column public.clinics.website_owner_visit_reports_enabled is
      'When true, pet owners can download generated visit-report PDFs from the public website portal.'
    $sql$;
  else
    raise notice 'Skipping public.clinics column update because the base clinics table does not exist in this database yet.';
  end if;
end
$$;

create or replace function public.ensure_primary_clinic_customer_membership(
  p_full_name text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_clinic_id uuid;
  v_email text;
  v_display_name text;
  v_phone text;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select primary_clinic_id
  into v_clinic_id
  from public.platform_branding
  where id = 'default'
  limit 1;

  if v_clinic_id is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.clinics c
    where c.id = v_clinic_id and c.is_active = true
  ) then
    return null;
  end if;

  insert into public.user_clinic_memberships (user_id, clinic_id, role, is_active)
  values (v_user_id, v_clinic_id, 'pet_owner', true)
  on conflict (user_id, clinic_id, role)
  do update set
    is_active = true,
    updated_at = now();

  select au.email
  into v_email
  from public.app_users au
  where au.id = v_user_id
  limit 1;

  v_display_name := coalesce(
    nullif(trim(coalesce(p_full_name, '')), ''),
    nullif(trim(split_part(coalesce(v_email, ''), '@', 1)), ''),
    'Pet Owner'
  );
  v_phone := coalesce(nullif(trim(coalesce(p_phone, '')), ''), 'NA');

  insert into public.owners (clinic_id, user_id, full_name, phone, email)
  values (v_clinic_id, v_user_id, v_display_name, v_phone, nullif(trim(v_email), ''))
  on conflict (clinic_id, user_id)
  do update set
    full_name = coalesce(nullif(trim(coalesce(excluded.full_name, '')), ''), public.owners.full_name),
    phone = coalesce(nullif(trim(coalesce(excluded.phone, '')), ''), public.owners.phone),
    email = coalesce(nullif(trim(coalesce(excluded.email, '')), ''), public.owners.email),
    updated_at = now();

  return v_clinic_id;
end;
$$;

create or replace function public.ensure_primary_clinic_customer_membership()
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.ensure_primary_clinic_customer_membership(null, null);
$$;

grant execute on function public.ensure_primary_clinic_customer_membership(text, text) to authenticated;
grant execute on function public.ensure_primary_clinic_customer_membership() to authenticated;

do $$
begin
  if to_regtype('public.appointment_type') is not null then
    execute 'drop function if exists public.create_guest_website_booking(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, text, text, boolean, text, text)';

    execute $create$
      create or replace function public.create_guest_website_booking(
        p_clinic_id uuid,
        p_branch_id uuid,
        p_doctor_id uuid,
        p_starts_at timestamptz,
        p_appointment_type public.appointment_type,
        p_owner_full_name text,
        p_owner_phone text,
        p_owner_email text,
        p_pet_name text,
        p_pet_species text,
        p_chief_complaint text,
        p_notes text,
        p_allergies text,
        p_current_medications text,
        p_consent_accepted boolean default false,
        p_consent_text text default null,
        p_consent_version text default null
      )
      returns jsonb
      language plpgsql
      security definer
      set search_path = public
      as $fn$
      declare
        v_owner_id uuid;
        v_pet_id uuid;
        v_appt_id uuid;
        v_merge_token uuid := gen_random_uuid();
        v_count int;
        v_email text := lower(trim(coalesce(p_owner_email, '')));
        v_species text := nullif(trim(coalesce(p_pet_species, '')), '');
      begin
        if v_email = '' then
          raise exception 'Email is required';
        end if;
        if nullif(trim(p_owner_full_name), '') is null then
          raise exception 'Name is required';
        end if;
        if nullif(trim(p_owner_phone), '') is null then
          raise exception 'Phone is required';
        end if;
        if nullif(trim(p_pet_name), '') is null then
          raise exception 'Pet name is required';
        end if;
        if coalesce(p_consent_accepted, false) = false then
          raise exception 'Consent is required';
        end if;

        if not exists (
          select 1 from public.branches b
          where b.id = p_branch_id and b.clinic_id = p_clinic_id and b.is_active = true
        ) then
          raise exception 'Invalid branch';
        end if;

        if p_doctor_id is not null then
          if not public.is_active_doctor_for_clinic(p_doctor_id, p_clinic_id) then
            raise exception 'Invalid doctor';
          end if;
          select count(*)::int into v_count
          from public.appointments a
          where a.clinic_id = p_clinic_id
            and a.doctor_id = p_doctor_id
            and a.starts_at = p_starts_at
            and a.status in ('scheduled', 'checked_in');
          if v_count > 0 then
            raise exception 'Selected doctor slot is not available';
          end if;
        end if;

        select o.id into v_owner_id
        from public.owners o
        where o.clinic_id = p_clinic_id
          and o.user_id is null
          and lower(trim(o.email)) = v_email
        limit 1;

        if v_owner_id is null then
          insert into public.owners (clinic_id, user_id, full_name, phone, email)
          values (
            p_clinic_id,
            null,
            trim(p_owner_full_name),
            trim(p_owner_phone),
            v_email
          )
          returning id into v_owner_id;
        else
          update public.owners
          set
            full_name = trim(p_owner_full_name),
            phone = trim(p_owner_phone),
            updated_at = now()
          where id = v_owner_id;
        end if;

        insert into public.pets (clinic_id, owner_id, name, species, primary_branch_id)
        values (
          p_clinic_id,
          v_owner_id,
          trim(p_pet_name),
          coalesce(v_species, 'unknown'),
          p_branch_id
        )
        returning id into v_pet_id;

        insert into public.appointments (
          clinic_id,
          branch_id,
          pet_id,
          owner_id,
          doctor_id,
          appointment_type,
          status,
          starts_at,
          reason,
          notes,
          owner_intake,
          booking_source,
          guest_merge_token,
          created_by
        )
        values (
          p_clinic_id,
          p_branch_id,
          v_pet_id,
          v_owner_id,
          p_doctor_id,
          p_appointment_type,
          'scheduled',
          p_starts_at,
          nullif(trim(p_chief_complaint), ''),
          nullif(trim(p_notes), ''),
          jsonb_strip_nulls(
            jsonb_build_object(
              'chief_complaint', nullif(trim(p_chief_complaint), ''),
              'allergies', nullif(trim(p_allergies), ''),
              'current_medications', nullif(trim(p_current_medications), ''),
              'contact_name', trim(p_owner_full_name),
              'contact_phone', trim(p_owner_phone),
              'contact_email', v_email,
              'consent_accepted', true,
              'consent_text', nullif(trim(coalesce(p_consent_text, '')), ''),
              'consent_version', nullif(trim(coalesce(p_consent_version, '')), ''),
              'consent_at', now(),
              'guest_booking', true
            )
          ),
          'website_guest',
          v_merge_token,
          null
        )
        returning id into v_appt_id;

        return jsonb_build_object(
          'appointment_id', v_appt_id,
          'merge_token', v_merge_token,
          'owner_id', v_owner_id
        );
      end;
      $fn$;
    $create$;

    execute 'grant execute on function public.create_guest_website_booking(uuid, uuid, uuid, timestamptz, public.appointment_type, text, text, text, text, text, text, text, text, text, boolean, text, text) to anon, authenticated';
  else
    execute 'drop function if exists public.create_guest_website_booking(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, text, text, boolean, text, text)';

    execute $create$
      create or replace function public.create_guest_website_booking(
        p_clinic_id uuid,
        p_branch_id uuid,
        p_doctor_id uuid,
        p_starts_at timestamptz,
        p_appointment_type text,
        p_owner_full_name text,
        p_owner_phone text,
        p_owner_email text,
        p_pet_name text,
        p_pet_species text,
        p_chief_complaint text,
        p_notes text,
        p_allergies text,
        p_current_medications text,
        p_consent_accepted boolean default false,
        p_consent_text text default null,
        p_consent_version text default null
      )
      returns jsonb
      language plpgsql
      security definer
      set search_path = public
      as $fn$
      declare
        v_owner_id uuid;
        v_pet_id uuid;
        v_appt_id uuid;
        v_merge_token uuid := gen_random_uuid();
        v_count int;
        v_email text := lower(trim(coalesce(p_owner_email, '')));
        v_species text := nullif(trim(coalesce(p_pet_species, '')), '');
      begin
        if v_email = '' then
          raise exception 'Email is required';
        end if;
        if nullif(trim(p_owner_full_name), '') is null then
          raise exception 'Name is required';
        end if;
        if nullif(trim(p_owner_phone), '') is null then
          raise exception 'Phone is required';
        end if;
        if nullif(trim(p_pet_name), '') is null then
          raise exception 'Pet name is required';
        end if;
        if coalesce(p_consent_accepted, false) = false then
          raise exception 'Consent is required';
        end if;

        if not exists (
          select 1 from public.branches b
          where b.id = p_branch_id and b.clinic_id = p_clinic_id and b.is_active = true
        ) then
          raise exception 'Invalid branch';
        end if;

        if p_doctor_id is not null then
          if not public.is_active_doctor_for_clinic(p_doctor_id, p_clinic_id) then
            raise exception 'Invalid doctor';
          end if;
          select count(*)::int into v_count
          from public.appointments a
          where a.clinic_id = p_clinic_id
            and a.doctor_id = p_doctor_id
            and a.starts_at = p_starts_at
            and a.status in ('scheduled', 'checked_in');
          if v_count > 0 then
            raise exception 'Selected doctor slot is not available';
          end if;
        end if;

        select o.id into v_owner_id
        from public.owners o
        where o.clinic_id = p_clinic_id
          and o.user_id is null
          and lower(trim(o.email)) = v_email
        limit 1;

        if v_owner_id is null then
          insert into public.owners (clinic_id, user_id, full_name, phone, email)
          values (
            p_clinic_id,
            null,
            trim(p_owner_full_name),
            trim(p_owner_phone),
            v_email
          )
          returning id into v_owner_id;
        else
          update public.owners
          set
            full_name = trim(p_owner_full_name),
            phone = trim(p_owner_phone),
            updated_at = now()
          where id = v_owner_id;
        end if;

        insert into public.pets (clinic_id, owner_id, name, species, primary_branch_id)
        values (
          p_clinic_id,
          v_owner_id,
          trim(p_pet_name),
          coalesce(v_species, 'unknown'),
          p_branch_id
        )
        returning id into v_pet_id;

        insert into public.appointments (
          clinic_id,
          branch_id,
          pet_id,
          owner_id,
          doctor_id,
          appointment_type,
          status,
          starts_at,
          reason,
          notes,
          owner_intake,
          booking_source,
          guest_merge_token,
          created_by
        )
        values (
          p_clinic_id,
          p_branch_id,
          v_pet_id,
          v_owner_id,
          p_doctor_id,
          p_appointment_type,
          'scheduled',
          p_starts_at,
          nullif(trim(p_chief_complaint), ''),
          nullif(trim(p_notes), ''),
          jsonb_strip_nulls(
            jsonb_build_object(
              'chief_complaint', nullif(trim(p_chief_complaint), ''),
              'allergies', nullif(trim(p_allergies), ''),
              'current_medications', nullif(trim(p_current_medications), ''),
              'contact_name', trim(p_owner_full_name),
              'contact_phone', trim(p_owner_phone),
              'contact_email', v_email,
              'consent_accepted', true,
              'consent_text', nullif(trim(coalesce(p_consent_text, '')), ''),
              'consent_version', nullif(trim(coalesce(p_consent_version, '')), ''),
              'consent_at', now(),
              'guest_booking', true
            )
          ),
          'website_guest',
          v_merge_token,
          null
        )
        returning id into v_appt_id;

        return jsonb_build_object(
          'appointment_id', v_appt_id,
          'merge_token', v_merge_token,
          'owner_id', v_owner_id
        );
      end;
      $fn$;
    $create$;

    execute 'grant execute on function public.create_guest_website_booking(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, text, text, text, text, boolean, text, text) to anon, authenticated';
    raise notice 'Created text-signature fallback for public.create_guest_website_booking because public.appointment_type is not present yet.';
  end if;
end
$$;
