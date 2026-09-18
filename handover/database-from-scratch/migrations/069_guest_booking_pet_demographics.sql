-- =============================================================================
-- Handover migration 069/100
-- Original: supabase/migrations/20260512150000_guest_booking_pet_demographics.sql
-- Purpose: guest booking pet demographics
-- Apply in order. Do not skip or reorder.
-- =============================================================================

do $$
begin
  if to_regtype('public.appointment_type') is not null then
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
        p_pet_gender text default null,
        p_pet_age_months int default null,
        p_chief_complaint text default null,
        p_notes text default null,
        p_allergies text default null,
        p_current_medications text default null,
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
        v_gender text := lower(trim(coalesce(p_pet_gender, '')));
        v_age_months int := case when coalesce(p_pet_age_months, 0) > 0 then p_pet_age_months else null end;
        v_age_label text := null;
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

        if v_gender not in ('male', 'female', 'unknown') then
          v_gender := null;
        end if;

        if v_age_months is not null then
          v_age_label :=
            case
              when v_age_months < 12 then v_age_months::text || ' months'
              else ((round((v_age_months::numeric / 12.0) * 10) / 10)::text || ' years')
            end;
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

        insert into public.pets (clinic_id, owner_id, name, species, gender, age_months, primary_branch_id)
        values (
          p_clinic_id,
          v_owner_id,
          trim(p_pet_name),
          coalesce(v_species, 'unknown'),
          v_gender,
          v_age_months,
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
              'patient_gender', v_gender,
              'patient_age', v_age_label,
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

    execute 'grant execute on function public.create_guest_website_booking(uuid, uuid, uuid, timestamptz, public.appointment_type, text, text, text, text, text, text, int, text, text, text, text, boolean, text, text) to anon, authenticated';
  else
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
        p_pet_gender text default null,
        p_pet_age_months int default null,
        p_chief_complaint text default null,
        p_notes text default null,
        p_allergies text default null,
        p_current_medications text default null,
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
        v_gender text := lower(trim(coalesce(p_pet_gender, '')));
        v_age_months int := case when coalesce(p_pet_age_months, 0) > 0 then p_pet_age_months else null end;
        v_age_label text := null;
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

        if v_gender not in ('male', 'female', 'unknown') then
          v_gender := null;
        end if;

        if v_age_months is not null then
          v_age_label :=
            case
              when v_age_months < 12 then v_age_months::text || ' months'
              else ((round((v_age_months::numeric / 12.0) * 10) / 10)::text || ' years')
            end;
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

        insert into public.pets (clinic_id, owner_id, name, species, gender, age_months, primary_branch_id)
        values (
          p_clinic_id,
          v_owner_id,
          trim(p_pet_name),
          coalesce(v_species, 'unknown'),
          v_gender,
          v_age_months,
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
              'patient_gender', v_gender,
              'patient_age', v_age_label,
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

    execute 'grant execute on function public.create_guest_website_booking(uuid, uuid, uuid, timestamptz, text, text, text, text, text, text, text, int, text, text, text, text, boolean, text, text) to anon, authenticated';
  end if;
end
$$;
