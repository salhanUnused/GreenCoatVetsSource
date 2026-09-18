-- =============================================================================
-- Handover migration 072/100
-- Original: supabase/migrations/20260512161000_website_owner_pet_cleanup.sql
-- Purpose: website owner pet cleanup
-- Apply in order. Do not skip or reorder.
-- =============================================================================

do $$
begin
  if to_regclass('public.invoices') is not null then
    execute $create$
      create or replace function public.get_website_owner_pet_purge_stats(
        p_clinic_id uuid,
        p_cutoff timestamptz,
        p_excluded_email text default null
      )
      returns table(owner_count int, pet_count int)
      language sql
      security definer
      set search_path = public
      as $fn$
        with candidate_owners as (
          select o.id
          from public.owners o
          where o.clinic_id = p_clinic_id
            and o.created_at <= p_cutoff
            and coalesce(lower(trim(o.email)), '') <> lower(trim(coalesce(p_excluded_email, '')))
            and (
              o.user_id is not null
              or exists (
                select 1
                from public.appointments a
                where a.clinic_id = p_clinic_id
                  and a.owner_id = o.id
                  and a.booking_source in ('website_guest', 'owner_portal')
              )
            )
            and not exists (
              select 1
              from public.appointments a
              where a.clinic_id = p_clinic_id
                and a.owner_id = o.id
                and coalesce(a.booking_source, 'clinic_portal') = 'clinic_portal'
            )
            and not exists (
              select 1
              from public.appointments a
              where a.clinic_id = p_clinic_id
                and a.owner_id = o.id
                and a.created_at > p_cutoff
            )
            and not exists (
              select 1
              from public.pets p
              where p.clinic_id = p_clinic_id
                and p.owner_id = o.id
                and p.created_at > p_cutoff
            )
            and not exists (
              select 1
              from public.visits v
              where v.clinic_id = p_clinic_id
                and v.owner_id = o.id
            )
            and not exists (
              select 1
              from public.invoices i
              where i.clinic_id = p_clinic_id
                and i.owner_id = o.id
            )
        ),
        candidate_pets as (
          select p.id
          from public.pets p
          join candidate_owners o on o.id = p.owner_id
          where p.clinic_id = p_clinic_id
            and p.created_at <= p_cutoff
        )
        select
          (select count(*)::int from candidate_owners) as owner_count,
          (select count(*)::int from candidate_pets) as pet_count;
      $fn$;
    $create$;

    execute $create$
      create or replace function public.purge_website_owner_pet_records(
        p_clinic_id uuid,
        p_cutoff timestamptz,
        p_excluded_email text default null
      )
      returns table(owner_count int, pet_count int)
      language sql
      security definer
      set search_path = public
      as $fn$
        with candidate_owners as (
          select o.id
          from public.owners o
          where o.clinic_id = p_clinic_id
            and o.created_at <= p_cutoff
            and coalesce(lower(trim(o.email)), '') <> lower(trim(coalesce(p_excluded_email, '')))
            and (
              o.user_id is not null
              or exists (
                select 1
                from public.appointments a
                where a.clinic_id = p_clinic_id
                  and a.owner_id = o.id
                  and a.booking_source in ('website_guest', 'owner_portal')
              )
            )
            and not exists (
              select 1
              from public.appointments a
              where a.clinic_id = p_clinic_id
                and a.owner_id = o.id
                and coalesce(a.booking_source, 'clinic_portal') = 'clinic_portal'
            )
            and not exists (
              select 1
              from public.appointments a
              where a.clinic_id = p_clinic_id
                and a.owner_id = o.id
                and a.created_at > p_cutoff
            )
            and not exists (
              select 1
              from public.pets p
              where p.clinic_id = p_clinic_id
                and p.owner_id = o.id
                and p.created_at > p_cutoff
            )
            and not exists (
              select 1
              from public.visits v
              where v.clinic_id = p_clinic_id
                and v.owner_id = o.id
            )
            and not exists (
              select 1
              from public.invoices i
              where i.clinic_id = p_clinic_id
                and i.owner_id = o.id
            )
        ),
        candidate_pets as (
          select p.id
          from public.pets p
          join candidate_owners o on o.id = p.owner_id
          where p.clinic_id = p_clinic_id
            and p.created_at <= p_cutoff
        ),
        deleted_owners as (
          delete from public.owners o
          using candidate_owners c
          where o.id = c.id
          returning o.id
        )
        select
          (select count(*)::int from deleted_owners) as owner_count,
          (select count(*)::int from candidate_pets) as pet_count;
      $fn$;
    $create$;
  else
    execute $create$
      create or replace function public.get_website_owner_pet_purge_stats(
        p_clinic_id uuid,
        p_cutoff timestamptz,
        p_excluded_email text default null
      )
      returns table(owner_count int, pet_count int)
      language sql
      security definer
      set search_path = public
      as $fn$
        with candidate_owners as (
          select o.id
          from public.owners o
          where o.clinic_id = p_clinic_id
            and o.created_at <= p_cutoff
            and coalesce(lower(trim(o.email)), '') <> lower(trim(coalesce(p_excluded_email, '')))
            and (
              o.user_id is not null
              or exists (
                select 1
                from public.appointments a
                where a.clinic_id = p_clinic_id
                  and a.owner_id = o.id
                  and a.booking_source in ('website_guest', 'owner_portal')
              )
            )
            and not exists (
              select 1
              from public.appointments a
              where a.clinic_id = p_clinic_id
                and a.owner_id = o.id
                and coalesce(a.booking_source, 'clinic_portal') = 'clinic_portal'
            )
            and not exists (
              select 1
              from public.appointments a
              where a.clinic_id = p_clinic_id
                and a.owner_id = o.id
                and a.created_at > p_cutoff
            )
            and not exists (
              select 1
              from public.pets p
              where p.clinic_id = p_clinic_id
                and p.owner_id = o.id
                and p.created_at > p_cutoff
            )
            and not exists (
              select 1
              from public.visits v
              where v.clinic_id = p_clinic_id
                and v.owner_id = o.id
            )
        ),
        candidate_pets as (
          select p.id
          from public.pets p
          join candidate_owners o on o.id = p.owner_id
          where p.clinic_id = p_clinic_id
            and p.created_at <= p_cutoff
        )
        select
          (select count(*)::int from candidate_owners) as owner_count,
          (select count(*)::int from candidate_pets) as pet_count;
      $fn$;
    $create$;

    execute $create$
      create or replace function public.purge_website_owner_pet_records(
        p_clinic_id uuid,
        p_cutoff timestamptz,
        p_excluded_email text default null
      )
      returns table(owner_count int, pet_count int)
      language sql
      security definer
      set search_path = public
      as $fn$
        with candidate_owners as (
          select o.id
          from public.owners o
          where o.clinic_id = p_clinic_id
            and o.created_at <= p_cutoff
            and coalesce(lower(trim(o.email)), '') <> lower(trim(coalesce(p_excluded_email, '')))
            and (
              o.user_id is not null
              or exists (
                select 1
                from public.appointments a
                where a.clinic_id = p_clinic_id
                  and a.owner_id = o.id
                  and a.booking_source in ('website_guest', 'owner_portal')
              )
            )
            and not exists (
              select 1
              from public.appointments a
              where a.clinic_id = p_clinic_id
                and a.owner_id = o.id
                and coalesce(a.booking_source, 'clinic_portal') = 'clinic_portal'
            )
            and not exists (
              select 1
              from public.appointments a
              where a.clinic_id = p_clinic_id
                and a.owner_id = o.id
                and a.created_at > p_cutoff
            )
            and not exists (
              select 1
              from public.pets p
              where p.clinic_id = p_clinic_id
                and p.owner_id = o.id
                and p.created_at > p_cutoff
            )
            and not exists (
              select 1
              from public.visits v
              where v.clinic_id = p_clinic_id
                and v.owner_id = o.id
            )
        ),
        candidate_pets as (
          select p.id
          from public.pets p
          join candidate_owners o on o.id = p.owner_id
          where p.clinic_id = p_clinic_id
            and p.created_at <= p_cutoff
        ),
        deleted_owners as (
          delete from public.owners o
          using candidate_owners c
          where o.id = c.id
          returning o.id
        )
        select
          (select count(*)::int from deleted_owners) as owner_count,
          (select count(*)::int from candidate_pets) as pet_count;
      $fn$;
    $create$;
  end if;
end
$$;

revoke all on function public.get_website_owner_pet_purge_stats(uuid, timestamptz, text) from public;
revoke all on function public.purge_website_owner_pet_records(uuid, timestamptz, text) from public;
grant execute on function public.get_website_owner_pet_purge_stats(uuid, timestamptz, text) to authenticated, service_role;
grant execute on function public.purge_website_owner_pet_records(uuid, timestamptz, text) to service_role;
