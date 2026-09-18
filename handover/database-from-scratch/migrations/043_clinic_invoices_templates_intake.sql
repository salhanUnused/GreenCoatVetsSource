-- =============================================================================
-- Handover migration 043/100
-- Original: supabase/migrations/20260328180000_clinic_invoices_templates_intake.sql
-- Purpose: Invoicing from visits (medicines + referred tests), editable invoice templates, owner intake on booking.
-- Apply in order. Do not skip or reorder.
-- =============================================================================

-- Invoicing from visits (medicines + referred tests), editable invoice templates, owner intake on booking.

-- ---------------------------------------------------------------------------
-- Booking: structured owner-provided info for clinical / visit context
-- ---------------------------------------------------------------------------
alter table public.appointments add column if not exists owner_intake jsonb not null default '{}'::jsonb;

comment on column public.appointments.owner_intake is
  'Owner-submitted intake: chief_complaint, allergies, current_medications, diet_notes, travel_history, etc.';

-- ---------------------------------------------------------------------------
-- Invoice template (admin: block order, visibility, optional footer text)
-- ---------------------------------------------------------------------------
create table if not exists public.clinic_invoice_templates (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  layout jsonb not null default '{"blocks":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger set_updated_at_clinic_invoice_templates
before update on public.clinic_invoice_templates
for each row execute function public.set_updated_at();

alter table public.clinic_invoice_templates enable row level security;

drop policy if exists clinic_invoice_templates_policy on public.clinic_invoice_templates;
create policy clinic_invoice_templates_policy on public.clinic_invoice_templates
for all
using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

comment on table public.clinic_invoice_templates is
  'layout.blocks[]: { id, type, order, enabled, customText? }. Types: clinic_header, invoice_meta, owner_patient, line_items, totals, footer_note.';

-- ---------------------------------------------------------------------------
-- Clinic invoices (PDF path in medical-files bucket)
-- ---------------------------------------------------------------------------
create table if not exists public.clinic_invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  visit_id uuid not null references public.visits(id) on delete restrict,
  owner_id uuid not null references public.owners(id) on delete restrict,
  prescription_id uuid references public.prescriptions(id) on delete set null,
  invoice_number text not null,
  status text not null default 'issued',
  currency text not null default 'INR',
  subtotal numeric(12, 2) not null default 0,
  tax_rate numeric(6, 3),
  tax_total numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  grand_total numeric(12, 2) not null default 0,
  notes text,
  pdf_storage_path text,
  pdf_generated_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinic_invoices_status_check check (status in ('draft', 'issued', 'void')),
  constraint clinic_invoices_number_unique unique (clinic_id, invoice_number)
);

create index if not exists idx_clinic_invoices_clinic on public.clinic_invoices (clinic_id);
create index if not exists idx_clinic_invoices_visit on public.clinic_invoices (visit_id);

create trigger set_updated_at_clinic_invoices
before update on public.clinic_invoices
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Invoice lines (medicines from Rx, lab tests from visit evaluation, custom)
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.clinic_invoices(id) on delete cascade,
  line_type text not null,
  prescription_item_id uuid references public.prescription_items(id) on delete set null,
  test_code text,
  description text not null,
  quantity int not null default 1,
  unit_price numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_line_items_type_check check (
    line_type in ('medicine', 'lab_test', 'service', 'custom')
  ),
  constraint invoice_line_items_qty_check check (quantity > 0)
);

create index if not exists idx_invoice_line_items_invoice on public.invoice_line_items (invoice_id);

alter table public.clinic_invoices enable row level security;
alter table public.invoice_line_items enable row level security;

drop policy if exists clinic_invoices_policy on public.clinic_invoices;
create policy clinic_invoices_policy on public.clinic_invoices
for all
using (public.has_clinic_access(clinic_id))
with check (public.has_clinic_access(clinic_id));

drop policy if exists invoice_line_items_policy on public.invoice_line_items;
create policy invoice_line_items_policy on public.invoice_line_items
for all
using (
  exists (
    select 1
    from public.clinic_invoices i
    where i.id = invoice_line_items.invoice_id
      and public.has_clinic_access(i.clinic_id)
  )
)
with check (
  exists (
    select 1
    from public.clinic_invoices i
    where i.id = invoice_line_items.invoice_id
      and public.has_clinic_access(i.clinic_id)
  )
);

comment on table public.clinic_invoices is 'Visit billing; PDF stored at pdf_storage_path in medical-files bucket.';
comment on column public.invoice_line_items.test_code is 'Referred test code from visit_clinical_evaluations when line_type=lab_test.';
