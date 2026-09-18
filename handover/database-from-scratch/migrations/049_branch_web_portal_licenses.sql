-- =============================================================================
-- Handover migration 049/100
-- Original: supabase/migrations/20260328270000_branch_web_portal_licenses.sql
-- Purpose: Branch web portal access: Razorpay checkout, per-clinic price overrides, license rows per branch.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Branch web portal access: Razorpay checkout, per-clinic price overrides, license rows per branch.

alter table public.platform_payment_settings
  add column if not exists default_branch_web_license_price_paise int not null default 49900
    check (default_branch_web_license_price_paise > 0),
  add column if not exists default_branch_web_license_period_days int not null default 30
    check (default_branch_web_license_period_days > 0);

comment on column public.platform_payment_settings.default_branch_web_license_price_paise is
  'Default branch web portal license price in paise (INR smallest unit); super admin configurable.';
comment on column public.platform_payment_settings.default_branch_web_license_period_days is
  'Default paid access length in days for branch web portal.';

alter table public.clinics
  add column if not exists branch_web_license_price_paise int
    check (branch_web_license_price_paise is null or branch_web_license_price_paise > 0),
  add column if not exists branch_web_license_period_days int
    check (branch_web_license_period_days is null or branch_web_license_period_days > 0);

comment on column public.clinics.branch_web_license_price_paise is
  'Optional override in paise; null uses platform default.';
comment on column public.clinics.branch_web_license_period_days is
  'Optional override for license length in days; null uses platform default.';

create table if not exists public.branch_web_portal_licenses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  purchased_by_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'cancelled')),
  valid_from timestamptz,
  valid_until timestamptz,
  amount_paise int not null check (amount_paise > 0),
  license_period_days int not null check (license_period_days > 0),
  currency text not null default 'INR',
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_branch_web_portal_licenses
  before update on public.branch_web_portal_licenses
  for each row execute function public.set_updated_at();

create index if not exists branch_web_portal_licenses_branch_id_idx
  on public.branch_web_portal_licenses (branch_id);
create index if not exists branch_web_portal_licenses_clinic_id_idx
  on public.branch_web_portal_licenses (clinic_id);
create index if not exists branch_web_portal_licenses_pending_user_idx
  on public.branch_web_portal_licenses (purchased_by_user_id)
  where status = 'pending';

comment on table public.branch_web_portal_licenses is
  'Paid web portal access for a branch; branch admins checkout via Razorpay.';

alter table public.branch_web_portal_licenses enable row level security;

drop policy if exists branch_web_portal_licenses_select on public.branch_web_portal_licenses;
create policy branch_web_portal_licenses_select on public.branch_web_portal_licenses
for select
to authenticated
using (
  public.has_clinic_access(clinic_id)
  or purchased_by_user_id = auth.uid()
);

-- Writes only through SECURITY DEFINER RPCs below.

create or replace function public.create_branch_web_portal_license_pending()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_clinic_id uuid;
  v_branch_id uuid;
  v_amount int;
  v_days int;
  lic_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select sp.clinic_id, sp.branch_id
  into v_clinic_id, v_branch_id
  from public.staff_profiles sp
  inner join public.user_clinic_memberships m
    on m.user_id = sp.user_id
    and m.clinic_id = sp.clinic_id
    and m.is_active = true
    and m.role = 'branch_admin'
  where sp.user_id = uid
    and sp.is_active = true
    and sp.role = 'branch_admin'
  limit 1;

  if v_clinic_id is null then
    raise exception 'Only branch admins can purchase branch web portal access';
  end if;

  if v_branch_id is null then
    select b.id into v_branch_id
    from public.branches b
    where b.clinic_id = v_clinic_id and b.is_active = true
    order by b.created_at asc
    limit 1;
  end if;

  if v_branch_id is null then
    raise exception 'No active branch found for this clinic';
  end if;

  update public.branch_web_portal_licenses
  set status = 'expired', updated_at = now()
  where status = 'active' and valid_until <= now();

  if exists (
    select 1
    from public.branch_web_portal_licenses l
    where l.branch_id = v_branch_id
      and l.status = 'active'
      and l.valid_until > now()
  ) then
    raise exception 'This branch already has active web portal access';
  end if;

  delete from public.branch_web_portal_licenses l
  where l.branch_id = v_branch_id
    and l.status = 'pending'
    and l.purchased_by_user_id = uid;

  select
    coalesce(c.branch_web_license_price_paise, p.default_branch_web_license_price_paise),
    coalesce(c.branch_web_license_period_days, p.default_branch_web_license_period_days)
  into v_amount, v_days
  from public.clinics c
  cross join public.platform_payment_settings p
  where c.id = v_clinic_id and p.id = 'default';

  if v_amount is null or v_amount <= 0 or v_days is null or v_days <= 0 then
    raise exception 'License price or term is not configured';
  end if;

  insert into public.branch_web_portal_licenses (
    clinic_id,
    branch_id,
    purchased_by_user_id,
    status,
    amount_paise,
    license_period_days
  ) values (
    v_clinic_id,
    v_branch_id,
    uid,
    'pending',
    v_amount,
    v_days
  )
  returning id into lic_id;

  return jsonb_build_object(
    'license_id', lic_id,
    'clinic_id', v_clinic_id,
    'branch_id', v_branch_id,
    'amount_paise', v_amount,
    'period_days', v_days
  );
end;
$$;

create or replace function public.complete_branch_web_portal_license(
  p_license_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lic public.branch_web_portal_licenses%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_license_id is null
    or p_razorpay_order_id is null or length(trim(p_razorpay_order_id)) = 0
    or p_razorpay_payment_id is null or length(trim(p_razorpay_payment_id)) = 0
  then
    raise exception 'Missing payment reference';
  end if;

  select * into lic
  from public.branch_web_portal_licenses
  where id = p_license_id
  for update;

  if not found then
    raise exception 'License not found';
  end if;

  if lic.purchased_by_user_id is distinct from auth.uid() then
    raise exception 'Not your checkout session';
  end if;

  if lic.status <> 'pending' then
    raise exception 'License is not awaiting payment';
  end if;

  if lic.razorpay_order_id is null or lic.razorpay_order_id is distinct from trim(p_razorpay_order_id) then
    raise exception 'Order does not match this checkout session';
  end if;

  update public.branch_web_portal_licenses
  set
    status = 'active',
    valid_from = now(),
    valid_until = now() + (lic.license_period_days || ' days')::interval,
    razorpay_order_id = trim(p_razorpay_order_id),
    razorpay_payment_id = trim(p_razorpay_payment_id),
    razorpay_signature_verified_at = now()
  where id = p_license_id;
end;
$$;

create or replace function public.attach_branch_web_portal_license_order(
  p_license_id uuid,
  p_razorpay_order_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  lic public.branch_web_portal_licenses%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into lic
  from public.branch_web_portal_licenses
  where id = p_license_id
  for update;

  if not found then
    raise exception 'License not found';
  end if;

  if lic.purchased_by_user_id is distinct from auth.uid() then
    raise exception 'Not your checkout session';
  end if;

  if lic.status <> 'pending' then
    raise exception 'License is not awaiting payment';
  end if;

  update public.branch_web_portal_licenses
  set razorpay_order_id = trim(p_razorpay_order_id)
  where id = p_license_id;
end;
$$;

create or replace function public.get_branch_web_portal_quote(p_clinic_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'amount_paise', coalesce(c.branch_web_license_price_paise, p.default_branch_web_license_price_paise),
    'period_days', coalesce(c.branch_web_license_period_days, p.default_branch_web_license_period_days)
  )
  from public.clinics c
  cross join public.platform_payment_settings p
  where c.id = p_clinic_id
    and p.id = 'default'
    and (public.has_clinic_access(p_clinic_id) or public.is_super_admin());
$$;

grant execute on function public.get_branch_web_portal_quote(uuid) to authenticated;
grant execute on function public.create_branch_web_portal_license_pending() to authenticated;
grant execute on function public.attach_branch_web_portal_license_order(uuid, text) to authenticated;
grant execute on function public.complete_branch_web_portal_license(uuid, text, text) to authenticated;
