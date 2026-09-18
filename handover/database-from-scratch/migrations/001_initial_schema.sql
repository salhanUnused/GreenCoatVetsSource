-- =============================================================================
-- Handover migration 001/100
-- Original: supabase/migrations/20260320194500_initial_schema.sql
-- Purpose: Creates core tables: clinics, branches, owners, pets, appointments, visits, prescriptions, inventory, ecommerce (products/cart/orders), staff, memberships, and related enums.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Extensions
create extension if not exists pgcrypto;

-- Enums
do $$ begin
  create type public.app_role as enum (
    'super_admin',
    'clinic_admin',
    'branch_admin',
    'doctor',
    'receptionist',
    'pet_owner'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.appointment_type as enum (
    'consultation',
    'vaccination',
    'surgery',
    'grooming',
    'emergency'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.appointment_status as enum (
    'scheduled',
    'checked_in',
    'completed',
    'cancelled',
    'no_show'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_status as enum (
    'pending',
    'paid',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.inventory_movement_type as enum (
    'purchase',
    'sale',
    'adjustment',
    'return',
    'expired',
    'damaged'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.blog_status as enum (
    'draft',
    'scheduled',
    'published',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.notification_channel as enum (
    'push',
    'email',
    'sms',
    'whatsapp'
  );
exception
  when duplicate_object then null;
end $$;

-- Shared trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tenant roots
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  subdomain text unique,
  custom_domain text unique,
  logo_url text,
  support_email text,
  support_phone text,
  timezone text default 'UTC',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  code text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  phone text,
  email text,
  emergency_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Identity and memberships
create table if not exists public.user_clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, clinic_id, role)
);

create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  role public.app_role not null,
  full_name text not null,
  phone text,
  specialization text,
  experience_years int,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, clinic_id, branch_id, role)
);

-- Owners and pets
create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  address text,
  city text,
  state text,
  postal_code text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  primary_branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  species text not null,
  breed text,
  gender text,
  date_of_birth date,
  age_months int,
  weight_kg numeric(6,2),
  color text,
  photo_url text,
  microchip_id text,
  allergies text,
  chronic_diseases text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Appointments and visits
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  doctor_id uuid references public.staff_profiles(id) on delete set null,
  appointment_type public.appointment_type not null,
  status public.appointment_status not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz,
  queue_number int,
  reason text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  doctor_id uuid references public.staff_profiles(id) on delete set null,
  check_in_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  symptoms text,
  diagnosis text,
  treatment_plan text,
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medical_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  pet_id uuid not null references public.pets(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  diagnosis text,
  lab_tests text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  visit_id uuid not null references public.visits(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  doctor_id uuid references public.staff_profiles(id) on delete set null,
  notes text,
  pdf_url text,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  medicine_name text not null,
  dosage text not null,
  frequency text,
  duration text,
  instructions text,
  created_at timestamptz not null default now()
);

create table if not exists public.vaccination_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  pet_id uuid not null references public.pets(id) on delete cascade,
  vaccine_name text not null,
  dose text,
  administered_on date,
  due_on date,
  status text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Files (x-rays, reports, summaries, pet photos)
create table if not exists public.file_attachments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  pet_id uuid references public.pets(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete cascade,
  record_id uuid references public.medical_records(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  file_name text,
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Inventory and pharmacy
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  sku text not null,
  name text not null,
  category text,
  batch_number text,
  expiry_date date,
  unit_cost numeric(10,2),
  price numeric(10,2) not null default 0,
  stock_quantity int not null default 0,
  reorder_level int not null default 5,
  requires_prescription boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, branch_id, sku)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type public.inventory_movement_type not null,
  quantity int not null,
  unit_price numeric(10,2),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status text not null default 'draft',
  expected_on date,
  total_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  quantity int not null,
  unit_cost numeric(10,2) not null default 0,
  line_total numeric(12,2) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now()
);

-- Ecommerce
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, slug)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  category_id uuid references public.product_categories(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  image_url text,
  price numeric(10,2) not null default 0,
  compare_at_price numeric(10,2),
  stock_quantity int not null default 0,
  requires_prescription boolean not null default false,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, slug)
);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text,
  body text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  owner_id uuid references public.owners(id) on delete set null,
  status public.order_status not null default 'pending',
  payment_provider text default 'razorpay',
  payment_reference text,
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  shipping_total numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  shipping_address jsonb,
  notes text,
  placed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  requires_prescription_verification boolean not null default false,
  line_total numeric(12,2) generated always as ((quantity * unit_price) - discount_amount) stored,
  created_at timestamptz not null default now()
);

-- CMS/blog
create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, slug)
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  category_id uuid references public.blog_categories(id) on delete set null,
  title text not null,
  slug text not null,
  excerpt text,
  body_markdown text,
  body_html text,
  tags text[],
  status public.blog_status not null default 'draft',
  ai_generated boolean not null default false,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, slug)
);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete cascade,
  channel public.notification_channel not null,
  title text not null,
  message text not null,
  payload jsonb,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_branches_clinic_id on public.branches(clinic_id);
create index if not exists idx_staff_profiles_clinic_branch on public.staff_profiles(clinic_id, branch_id);
create index if not exists idx_owners_clinic_id on public.owners(clinic_id);
create index if not exists idx_pets_clinic_owner on public.pets(clinic_id, owner_id);
create index if not exists idx_appointments_clinic_branch_status on public.appointments(clinic_id, branch_id, status);
create index if not exists idx_appointments_doctor_starts_at on public.appointments(doctor_id, starts_at);
create index if not exists idx_visits_clinic_pet on public.visits(clinic_id, pet_id);
create index if not exists idx_medical_records_visit_id on public.medical_records(visit_id);
create index if not exists idx_vaccination_records_pet_due on public.vaccination_records(pet_id, due_on);
create index if not exists idx_inventory_items_clinic_branch on public.inventory_items(clinic_id, branch_id);
create index if not exists idx_inventory_items_expiry on public.inventory_items(expiry_date);
create index if not exists idx_products_clinic_slug on public.products(clinic_id, slug);
create index if not exists idx_orders_clinic_status on public.orders(clinic_id, status);
create index if not exists idx_blog_posts_clinic_status on public.blog_posts(clinic_id, status);
create index if not exists idx_notifications_user_sent on public.notifications(user_id, sent_at);

-- Updated-at triggers
create trigger set_updated_at_clinics before update on public.clinics for each row execute function public.set_updated_at();
create trigger set_updated_at_branches before update on public.branches for each row execute function public.set_updated_at();
create trigger set_updated_at_user_clinic_memberships before update on public.user_clinic_memberships for each row execute function public.set_updated_at();
create trigger set_updated_at_staff_profiles before update on public.staff_profiles for each row execute function public.set_updated_at();
create trigger set_updated_at_owners before update on public.owners for each row execute function public.set_updated_at();
create trigger set_updated_at_pets before update on public.pets for each row execute function public.set_updated_at();
create trigger set_updated_at_appointments before update on public.appointments for each row execute function public.set_updated_at();
create trigger set_updated_at_visits before update on public.visits for each row execute function public.set_updated_at();
create trigger set_updated_at_medical_records before update on public.medical_records for each row execute function public.set_updated_at();
create trigger set_updated_at_prescriptions before update on public.prescriptions for each row execute function public.set_updated_at();
create trigger set_updated_at_vaccination_records before update on public.vaccination_records for each row execute function public.set_updated_at();
create trigger set_updated_at_suppliers before update on public.suppliers for each row execute function public.set_updated_at();
create trigger set_updated_at_inventory_items before update on public.inventory_items for each row execute function public.set_updated_at();
create trigger set_updated_at_purchase_orders before update on public.purchase_orders for each row execute function public.set_updated_at();
create trigger set_updated_at_product_categories before update on public.product_categories for each row execute function public.set_updated_at();
create trigger set_updated_at_products before update on public.products for each row execute function public.set_updated_at();
create trigger set_updated_at_orders before update on public.orders for each row execute function public.set_updated_at();
create trigger set_updated_at_blog_categories before update on public.blog_categories for each row execute function public.set_updated_at();
create trigger set_updated_at_blog_posts before update on public.blog_posts for each row execute function public.set_updated_at();
