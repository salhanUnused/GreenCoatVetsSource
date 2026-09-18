-- =============================================================================
-- Handover migration 002/100
-- Original: supabase/migrations/20260320201000_rls_policies.sql
-- Purpose: Enables Row Level Security and tenant helper functions (has_clinic_access, role checks) plus baseline policies on core tables.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Helper functions for tenant checks
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_clinic_memberships m
    where m.user_id = auth.uid()
      and m.role = 'super_admin'
      and m.is_active = true
  );
$$;

create or replace function public.has_clinic_access(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.user_clinic_memberships m
    where m.user_id = auth.uid()
      and m.clinic_id = target_clinic_id
      and m.is_active = true
  );
$$;

create or replace function public.has_branch_access(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.user_clinic_memberships m
    join public.branches b on b.clinic_id = m.clinic_id
    where m.user_id = auth.uid()
      and b.id = target_branch_id
      and m.is_active = true
  );
$$;

-- Core tables with clinic_id
alter table public.clinics enable row level security;
alter table public.branches enable row level security;
alter table public.user_clinic_memberships enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.owners enable row level security;
alter table public.pets enable row level security;
alter table public.appointments enable row level security;
alter table public.visits enable row level security;
alter table public.medical_records enable row level security;
alter table public.prescriptions enable row level security;
alter table public.vaccination_records enable row level security;
alter table public.file_attachments enable row level security;
alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_reviews enable row level security;
alter table public.orders enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;
alter table public.notifications enable row level security;

-- Child tables without direct clinic_id
alter table public.prescription_items enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.order_items enable row level security;

-- Generic clinic_id policies
drop policy if exists clinics_policy on public.clinics;
create policy clinics_policy on public.clinics
for all using (public.has_clinic_access(id))
with check (public.has_clinic_access(id));

drop policy if exists branches_policy on public.branches;
create policy branches_policy on public.branches
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists user_clinic_memberships_policy on public.user_clinic_memberships;
create policy user_clinic_memberships_policy on public.user_clinic_memberships
for all using (
  user_id = auth.uid() or public.has_clinic_access(clinic_id)
)
with check (public.has_clinic_access(clinic_id));

drop policy if exists staff_profiles_policy on public.staff_profiles;
create policy staff_profiles_policy on public.staff_profiles
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists owners_policy on public.owners;
create policy owners_policy on public.owners
for all using (
  public.has_clinic_access(clinic_id) or user_id = auth.uid()
)
with check (public.has_clinic_access(clinic_id));

drop policy if exists pets_policy on public.pets;
create policy pets_policy on public.pets
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists appointments_policy on public.appointments;
create policy appointments_policy on public.appointments
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists visits_policy on public.visits;
create policy visits_policy on public.visits
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists medical_records_policy on public.medical_records;
create policy medical_records_policy on public.medical_records
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists prescriptions_policy on public.prescriptions;
create policy prescriptions_policy on public.prescriptions
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists vaccination_records_policy on public.vaccination_records;
create policy vaccination_records_policy on public.vaccination_records
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists file_attachments_policy on public.file_attachments;
create policy file_attachments_policy on public.file_attachments
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists suppliers_policy on public.suppliers;
create policy suppliers_policy on public.suppliers
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists inventory_items_policy on public.inventory_items;
create policy inventory_items_policy on public.inventory_items
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists inventory_movements_policy on public.inventory_movements;
create policy inventory_movements_policy on public.inventory_movements
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists purchase_orders_policy on public.purchase_orders;
create policy purchase_orders_policy on public.purchase_orders
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists product_categories_policy on public.product_categories;
create policy product_categories_policy on public.product_categories
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists products_policy on public.products;
create policy products_policy on public.products
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists product_reviews_policy on public.product_reviews;
create policy product_reviews_policy on public.product_reviews
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists orders_policy on public.orders;
create policy orders_policy on public.orders
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists blog_categories_policy on public.blog_categories;
create policy blog_categories_policy on public.blog_categories
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists blog_posts_policy on public.blog_posts;
create policy blog_posts_policy on public.blog_posts
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists notifications_policy on public.notifications;
create policy notifications_policy on public.notifications
for all using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

-- Child-table policies
drop policy if exists prescription_items_policy on public.prescription_items;
create policy prescription_items_policy on public.prescription_items
for all using (
  exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and public.has_clinic_access(p.clinic_id)
  )
)
with check (
  exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and public.has_clinic_access(p.clinic_id)
  )
);

drop policy if exists purchase_order_items_policy on public.purchase_order_items;
create policy purchase_order_items_policy on public.purchase_order_items
for all using (
  exists (
    select 1 from public.purchase_orders po
    where po.id = purchase_order_id
      and public.has_clinic_access(po.clinic_id)
  )
)
with check (
  exists (
    select 1 from public.purchase_orders po
    where po.id = purchase_order_id
      and public.has_clinic_access(po.clinic_id)
  )
);

drop policy if exists order_items_policy on public.order_items;
create policy order_items_policy on public.order_items
for all using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and public.has_clinic_access(o.clinic_id)
  )
)
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and public.has_clinic_access(o.clinic_id)
  )
);
