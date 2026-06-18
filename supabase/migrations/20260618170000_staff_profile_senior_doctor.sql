-- Allow senior_doctor rows to use update_my_staff_profile (mobile staff profile screen).

create or replace function public.update_my_staff_profile(
  p_full_name text,
  p_phone text,
  p_specialization text,
  p_experience_years int,
  p_bio text,
  p_photo_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_row uuid;
begin
  if uid is null then
    raise exception 'Authentication required.';
  end if;

  if p_full_name is null or length(trim(p_full_name)) = 0 then
    raise exception 'Full name is required.';
  end if;

  update public.staff_profiles sp
  set
    full_name = trim(p_full_name),
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    specialization = nullif(trim(coalesce(p_specialization, '')), ''),
    experience_years = p_experience_years,
    bio = nullif(trim(coalesce(p_bio, '')), ''),
    photo_url = nullif(trim(coalesce(p_photo_url, '')), ''),
    updated_at = now()
  where sp.user_id = uid
    and sp.is_active = true
    and exists (
      select 1
      from public.user_clinic_memberships m
      where m.user_id = uid
        and m.clinic_id = sp.clinic_id
        and m.role = sp.role
        and m.is_active = true
    )
    and sp.role in ('doctor', 'senior_doctor', 'lab_technician', 'pharmacist')
  returning sp.id into v_row;

  if v_row is null then
    raise exception 'No editable staff profile found for this account.';
  end if;
end;
$$;
