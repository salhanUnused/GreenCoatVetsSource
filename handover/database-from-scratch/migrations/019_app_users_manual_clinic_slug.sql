-- =============================================================================
-- Handover migration 019/100
-- Original: supabase/migrations/20260321130000_app_users_manual_clinic_slug.sql
-- Purpose: Human-readable clinic picker: FK to clinics.slug (unique) gives a dropdown in Supabase Table Editor.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Human-readable clinic picker: FK to clinics.slug (unique) gives a dropdown in Supabase Table Editor.
-- Use either manual_clinic_id OR manual_clinic_slug (slug is often easier to pick than UUID).

alter table public.app_users
  add column if not exists manual_clinic_slug text;

do $$
begin
  alter table public.app_users
    add constraint app_users_manual_clinic_slug_fkey
    foreign key (manual_clinic_slug) references public.clinics(slug) on delete set null;
exception
  when duplicate_object then null;
end $$;

comment on column public.app_users.manual_clinic_slug is 'Optional: set this OR manual_clinic_id. References clinics.slug for dropdown UX in Studio.';

create or replace function public.app_users_apply_manual_clinic_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_clinic_id uuid;
begin
  if new.manual_role is null then
    return new;
  end if;

  v_clinic_id := new.manual_clinic_id;
  if v_clinic_id is null and new.manual_clinic_slug is not null and length(trim(new.manual_clinic_slug)) > 0 then
    select c.id
    into v_clinic_id
    from public.clinics c
    where c.slug = trim(new.manual_clinic_slug)
    limit 1;
  end if;

  if v_clinic_id is null then
    return new;
  end if;

  select u.email into v_email from auth.users u where u.id = new.id limit 1;

  perform public.assign_user_clinic_role(
    new.id,
    v_clinic_id,
    new.manual_role,
    coalesce(nullif(trim(coalesce(v_email, '')), ''), 'User'),
    null
  );

  return new;
end;
$$;

drop trigger if exists trg_app_users_manual_role on public.app_users;
create trigger trg_app_users_manual_role
after insert or update of manual_clinic_id, manual_clinic_slug, manual_role on public.app_users
for each row
when (
  new.manual_role is not null
  and (
    new.manual_clinic_id is not null
    or (new.manual_clinic_slug is not null and length(trim(new.manual_clinic_slug)) > 0)
  )
)
execute function public.app_users_apply_manual_clinic_role();
