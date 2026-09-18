-- =============================================================================
-- Handover migration 040/100
-- Original: supabase/migrations/20260326150000_fix_assign_user_clinic_role_overload.sql
-- Purpose: Resolve ambiguous overloads after adding doctor working_hours to assign_user_clinic_role.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Resolve ambiguous overloads after adding doctor working_hours to assign_user_clinic_role.

-- Old function signature (5 args) conflicts with new function (6 args with defaults).
drop function if exists public.assign_user_clinic_role(uuid, uuid, public.app_role, text, text);

-- Update manual role assignment trigger to call the 6-arg function explicitly.
create or replace function public.app_users_apply_manual_clinic_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if new.manual_clinic_id is null or new.manual_role is null then
    return new;
  end if;

  select u.email into v_email from auth.users u where u.id = new.id limit 1;

  perform public.assign_user_clinic_role(
    new.id,
    new.manual_clinic_id,
    new.manual_role,
    coalesce(nullif(trim(coalesce(v_email, '')), ''), 'User'),
    null::text,
    null::text
  );

  return new;
end;
$$;

