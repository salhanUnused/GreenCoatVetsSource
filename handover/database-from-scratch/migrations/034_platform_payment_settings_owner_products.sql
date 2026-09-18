-- =============================================================================
-- Handover migration 034/100
-- Original: supabase/migrations/20260325210000_platform_payment_settings_owner_products.sql
-- Purpose: Platform-wide Razorpay credentials (super admin only via RLS; website API uses service role).
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Platform-wide Razorpay credentials (super admin only via RLS; website API uses service role).
-- Pet owners can read active products for their clinic (mobile / owner flows).

create table if not exists public.platform_payment_settings (
  id text primary key default 'default',
  razorpay_key_id text,
  razorpay_key_secret text,
  /** test = Razorpay test keys / sandbox behaviour; live = production. */
  payment_mode text not null default 'test' check (payment_mode in ('test', 'live')),
  updated_at timestamptz not null default now()
);

insert into public.platform_payment_settings (id, payment_mode)
values ('default', 'test')
on conflict (id) do nothing;

create trigger set_updated_at_platform_payment_settings
  before update on public.platform_payment_settings
  for each row execute function public.set_updated_at();

alter table public.platform_payment_settings enable row level security;

drop policy if exists platform_payment_settings_super_select on public.platform_payment_settings;
create policy platform_payment_settings_super_select on public.platform_payment_settings
for select
to authenticated
using (public.is_super_admin());

drop policy if exists platform_payment_settings_super_all on public.platform_payment_settings;
create policy platform_payment_settings_super_all on public.platform_payment_settings
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Users listed in platform_super_admins (may not have membership role = super_admin).
drop policy if exists platform_payment_settings_platform_table on public.platform_payment_settings;
create policy platform_payment_settings_platform_table on public.platform_payment_settings
for all
to authenticated
using (
  exists (select 1 from public.platform_super_admins p where p.user_id = auth.uid())
)
with check (
  exists (select 1 from public.platform_super_admins p where p.user_id = auth.uid())
);

comment on table public.platform_payment_settings is 'Razorpay API keys and mode; super admins only via RLS.';

-- Pet owners: browse active catalog for the clinic they belong to (mobile app shop).
drop policy if exists products_select_owner_same_clinic on public.products;
create policy products_select_owner_same_clinic on public.products
for select
to authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.owners o
    where o.clinic_id = products.clinic_id
      and o.user_id = auth.uid()
  )
);
