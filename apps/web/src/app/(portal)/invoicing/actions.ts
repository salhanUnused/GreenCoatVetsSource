"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensurePrescriptionForVisit } from "@/app/(portal)/visits/ensure-prescription";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { canEditInvoiceTemplate, canManageInvoices } from "@/lib/auth/invoice-access";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_INVOICE_TEMPLATE_LAYOUT,
  normalizeInvoiceTemplateLayout,
  type InvoiceTemplateLayout,
} from "@/lib/invoicing/invoice-template";
import { fetchClinicLogoBytesForPdf } from "@/lib/invoicing/fetch-clinic-logo";
import { buildInvoicePdfBytes, buildPrescriptionPdfBytes } from "@/lib/pdf/clinic-documents";

const MEDICAL_BUCKET = "medical-files";

async function uploadInvoicePdf(
  supabase: ReturnType<typeof createClient>,
  clinicId: string,
  invoiceId: string,
  pdfBytes: Uint8Array
) {
  const pdfPath = `${clinicId}/invoices/${invoiceId}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(MEDICAL_BUCKET)
    .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(upErr.message);

  const { error: updErr } = await supabase
    .from("clinic_invoices")
    .update({
      pdf_storage_path: pdfPath,
      pdf_generated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("clinic_id", clinicId);
  if (updErr) throw new Error(updErr.message);
}

function ownerDisplayName(owner: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
} | null): string {
  if (!owner) return "—";
  const f = owner.first_name?.trim();
  const l = owner.last_name?.trim();
  if (f && l) return `${f} ${l}`;
  return owner.full_name ?? "—";
}

function nextInvoiceNumber(): string {
  const y = new Date().getFullYear();
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `INV-${y}-${suffix}`;
}

export async function getInvoiceTemplateForClinic(): Promise<InvoiceTemplateLayout> {
  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const { data } = await supabase
    .from("clinic_invoice_templates")
    .select("layout")
    .eq("clinic_id", clinic_id)
    .maybeSingle();
  return normalizeInvoiceTemplateLayout(data?.layout);
}

export async function saveInvoiceTemplateLayout(layout: InvoiceTemplateLayout) {
  const { clinic_id } = await getActiveMembership();
  const access = await getUserAccess();
  if (!canEditInvoiceTemplate(access)) {
    throw new Error("Only clinic or branch admins can edit the invoice template.");
  }
  const normalized = normalizeInvoiceTemplateLayout(layout);
  const supabase = createClient();
  const { error } = await supabase.from("clinic_invoice_templates").upsert(
    {
      clinic_id,
      layout: normalized as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id" }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/clinic-profile/invoice-template");
}

type InvoiceLineInput = {
  line_type: "medicine" | "lab_test" | "service" | "custom";
  prescription_item_id?: string | null;
  test_code?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
};

type CreateInvoicePayload = {
  tax_rate: number | null;
  discount_total: number;
  notes: string;
  lines: InvoiceLineInput[];
};

export async function createInvoiceFromVisit(visitId: string, payload: CreateInvoicePayload) {
  const access = await getUserAccess();
  if (!canManageInvoices(access)) {
    throw new Error("You do not have permission to create invoices.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: visit, error: vErr } = await supabase
    .from("visits")
    .select(
      "id, clinic_id, branch_id, owner_id, appointment_id, pets(name), owners(first_name, last_name, full_name), branches(name, address_line1, address_line2, city, state, postal_code, country, phone)"
    )
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (vErr) throw new Error(vErr.message);
  if (!visit) throw new Error("Visit not found.");

  const prescriptionId = await ensurePrescriptionForVisit(visitId);

  const { data: clinic } = await supabase.from("clinics").select("name, image_url").eq("id", clinic_id).single();
  const logoBytes = await fetchClinicLogoBytesForPdf(supabase, clinic?.image_url as string | null | undefined);
  const { data: templateRow } = await supabase
    .from("clinic_invoice_templates")
    .select("layout")
    .eq("clinic_id", clinic_id)
    .maybeSingle();
  const layout = normalizeInvoiceTemplateLayout(templateRow?.layout ?? DEFAULT_INVOICE_TEMPLATE_LAYOUT);

  const lines = payload.lines.filter((l) => l.description.trim().length > 0);
  if (!lines.length) throw new Error("Add at least one line item.");

  let subtotal = 0;
  const dbLines: Array<{
    line_type: string;
    prescription_item_id: string | null;
    test_code: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }> = [];

  for (const row of lines) {
    const qty = Math.max(1, Math.floor(Number(row.quantity) || 1));
    const unit = Math.max(0, Number(row.unit_price) || 0);
    const lineTotal = Math.round(qty * unit * 100) / 100;
    subtotal += lineTotal;
    dbLines.push({
      line_type: row.line_type,
      prescription_item_id: row.prescription_item_id ?? null,
      test_code: row.test_code ?? null,
      description: row.description.trim(),
      quantity: qty,
      unit_price: unit,
      line_total: lineTotal,
    });
  }

  const discount = Math.max(0, Number(payload.discount_total) || 0);
  const afterDiscount = Math.max(0, subtotal - discount);
  const taxRate = payload.tax_rate != null ? Math.max(0, Number(payload.tax_rate)) : null;
  const taxTotal =
    taxRate != null && taxRate > 0 ? Math.round(afterDiscount * (taxRate / 100) * 100) / 100 : 0;
  const grandTotal = Math.round((afterDiscount + taxTotal) * 100) / 100;

  const invoiceNumber = nextInvoiceNumber();
  const owner = visit.owners as { first_name?: string; last_name?: string; full_name?: string } | null;
  const pet = visit.pets as { name?: string } | null;
  const branch = visit.branches as {
    name?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    phone?: string;
  } | null;

  const { data: invoice, error: invErr } = await supabase
    .from("clinic_invoices")
    .insert({
      clinic_id,
      branch_id: visit.branch_id,
      visit_id: visit.id,
      owner_id: visit.owner_id,
      prescription_id: prescriptionId,
      patient_name: pet?.name ?? "—",
      invoice_number: invoiceNumber,
      status: "issued",
      currency: "INR",
      subtotal,
      tax_rate: taxRate,
      tax_total: taxTotal,
      discount_total: discount,
      grand_total: grandTotal,
      notes: payload.notes?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (invErr) throw new Error(invErr.message);

  const { error: linesErr } = await supabase.from("invoice_line_items").insert(
    dbLines.map((r) => ({
      invoice_id: invoice.id,
      line_type: r.line_type,
      prescription_item_id: r.prescription_item_id,
      test_code: r.test_code,
      description: r.description,
      quantity: r.quantity,
      unit_price: r.unit_price,
      line_total: r.line_total,
    }))
  );
  if (linesErr) throw new Error(linesErr.message);

  const branchLines = [
    branch?.name ?? "",
    [branch?.address_line1, branch?.address_line2].filter(Boolean).join(", "),
    [branch?.city, branch?.state, branch?.postal_code].filter(Boolean).join(", "),
    branch?.country ?? "",
    branch?.phone ? `Tel: ${branch.phone}` : "",
  ].filter((s) => s && String(s).trim());

  const pdfBytes = await buildInvoicePdfBytes({
    layout,
    clinicName: clinic?.name ?? "Clinic",
    branchLines,
    invoiceNumber,
    issuedAt: new Date(),
    currency: "INR",
    ownerName: ownerDisplayName(owner),
    patientName: pet?.name ?? "—",
    lines: dbLines.map((r) => ({
      description: r.description,
      qty: r.quantity,
      unit: r.unit_price,
      total: r.line_total,
    })),
    subtotal,
    taxRate,
    taxTotal,
    discountTotal: discount,
    grandTotal,
    notes: payload.notes?.trim() || null,
    logoBytes,
  });

  await uploadInvoicePdf(supabase, clinic_id, invoice.id, pdfBytes);

  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/invoices");
  return invoice.id;
}

export type ManualInvoicePayload = CreateInvoicePayload & {
  branch_id: string;
  owner_id: string;
  patient_name: string;
};

/** Reception / admin: invoice not tied to a visit (walk-in, phone sale, adjustments). */
export async function createManualInvoice(payload: ManualInvoicePayload) {
  const access = await getUserAccess();
  if (!canManageInvoices(access)) {
    throw new Error("You do not have permission to create invoices.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const branchId = payload.branch_id.trim();
  const ownerId = payload.owner_id.trim();
  if (!branchId || !ownerId) throw new Error("Branch and owner are required.");

  const { data: branch, error: bErr } = await supabase
    .from("branches")
    .select("id, name, address_line1, address_line2, city, state, postal_code, country, phone")
    .eq("id", branchId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();
  if (bErr) throw new Error(bErr.message);
  if (!branch) throw new Error("Branch not found.");

  const { data: owner, error: oErr } = await supabase
    .from("owners")
    .select("id, first_name, last_name, full_name")
    .eq("id", ownerId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();
  if (oErr) throw new Error(oErr.message);
  if (!owner) throw new Error("Owner not found.");

  const { data: clinic } = await supabase.from("clinics").select("name, image_url").eq("id", clinic_id).single();
  const logoBytes = await fetchClinicLogoBytesForPdf(supabase, clinic?.image_url as string | null | undefined);
  const { data: templateRow } = await supabase
    .from("clinic_invoice_templates")
    .select("layout")
    .eq("clinic_id", clinic_id)
    .maybeSingle();
  const layout = normalizeInvoiceTemplateLayout(templateRow?.layout ?? DEFAULT_INVOICE_TEMPLATE_LAYOUT);

  const lines = payload.lines.filter((l) => l.description.trim().length > 0);
  if (!lines.length) throw new Error("Add at least one line item.");

  let subtotal = 0;
  const dbLines: Array<{
    line_type: string;
    prescription_item_id: string | null;
    test_code: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }> = [];

  for (const row of lines) {
    const qty = Math.max(1, Math.floor(Number(row.quantity) || 1));
    const unit = Math.max(0, Number(row.unit_price) || 0);
    const lineTotal = Math.round(qty * unit * 100) / 100;
    subtotal += lineTotal;
    dbLines.push({
      line_type: row.line_type,
      prescription_item_id: row.prescription_item_id ?? null,
      test_code: row.test_code ?? null,
      description: row.description.trim(),
      quantity: qty,
      unit_price: unit,
      line_total: lineTotal,
    });
  }

  const discount = Math.max(0, Number(payload.discount_total) || 0);
  const afterDiscount = Math.max(0, subtotal - discount);
  const taxRate = payload.tax_rate != null ? Math.max(0, Number(payload.tax_rate)) : null;
  const taxTotal =
    taxRate != null && taxRate > 0 ? Math.round(afterDiscount * (taxRate / 100) * 100) / 100 : 0;
  const grandTotal = Math.round((afterDiscount + taxTotal) * 100) / 100;

  const invoiceNumber = nextInvoiceNumber();
  const patientName = payload.patient_name.trim() || "—";

  const { data: invoice, error: invErr } = await supabase
    .from("clinic_invoices")
    .insert({
      clinic_id,
      branch_id: branchId,
      visit_id: null,
      owner_id: ownerId,
      prescription_id: null,
      patient_name: patientName,
      invoice_number: invoiceNumber,
      status: "issued",
      currency: "INR",
      subtotal,
      tax_rate: taxRate,
      tax_total: taxTotal,
      discount_total: discount,
      grand_total: grandTotal,
      notes: payload.notes?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (invErr) throw new Error(invErr.message);

  const { error: linesErr } = await supabase.from("invoice_line_items").insert(
    dbLines.map((r) => ({
      invoice_id: invoice.id,
      line_type: r.line_type,
      prescription_item_id: r.prescription_item_id,
      test_code: r.test_code,
      description: r.description,
      quantity: r.quantity,
      unit_price: r.unit_price,
      line_total: r.line_total,
    }))
  );
  if (linesErr) throw new Error(linesErr.message);

  const br = branch as {
    name?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    phone?: string;
  };
  const branchLines = [
    br?.name ?? "",
    [br?.address_line1, br?.address_line2].filter(Boolean).join(", "),
    [br?.city, br?.state, br?.postal_code].filter(Boolean).join(", "),
    br?.country ?? "",
    br?.phone ? `Tel: ${br.phone}` : "",
  ].filter((s) => s && String(s).trim());

  const pdfBytes = await buildInvoicePdfBytes({
    layout,
    clinicName: clinic?.name ?? "Clinic",
    branchLines,
    invoiceNumber,
    issuedAt: new Date(),
    currency: "INR",
    ownerName: ownerDisplayName(owner),
    patientName,
    lines: dbLines.map((r) => ({
      description: r.description,
      qty: r.quantity,
      unit: r.unit_price,
      total: r.line_total,
    })),
    subtotal,
    taxRate,
    taxTotal,
    discountTotal: discount,
    grandTotal,
    notes: payload.notes?.trim() || null,
    logoBytes,
  });

  await uploadInvoicePdf(supabase, clinic_id, invoice.id, pdfBytes);

  revalidatePath("/invoices");
  return invoice.id;
}

export async function regeneratePrescriptionPdf(prescriptionId: string) {
  const access = await getUserAccess();
  const role = access.membership?.role;
  if (
    !access.isSuperAdmin &&
    !["receptionist", "clinic_admin", "branch_admin", "doctor", "pharmacist", "lab_technician"].includes(role ?? "")
  ) {
    throw new Error("You do not have permission to generate prescription PDFs.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: rx, error } = await supabase
    .from("prescriptions")
    .select(
      "id, clinic_id, visit_id, pet_id, notes, issued_at, pets(name), staff_profiles(full_name), visits(owners(first_name, last_name, full_name))"
    )
    .eq("id", prescriptionId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!rx) throw new Error("Prescription not found.");

  const { data: items, error: iErr } = await supabase
    .from("prescription_items")
    .select("medicine_name, dosage, frequency, duration, instructions")
    .eq("prescription_id", prescriptionId)
    .order("created_at", { ascending: true });

  if (iErr) throw new Error(iErr.message);

  const { data: clinic } = await supabase.from("clinics").select("name, image_url, timezone").eq("id", clinic_id).single();
  const logoBytes = await fetchClinicLogoBytesForPdf(supabase, clinic?.image_url as string | null | undefined);

  const pet = rx.pets as { name?: string } | null;
  const doctor = rx.staff_profiles as { full_name?: string } | null;
  const visitJoin = rx.visits as
    | { owners?: { first_name?: string; last_name?: string; full_name?: string } }
    | { owners?: { first_name?: string; last_name?: string; full_name?: string } }[]
    | null;
  const visitData = Array.isArray(visitJoin) ? visitJoin[0] : visitJoin;
  const owner = visitData?.owners ?? null;

  const pdfBytes = await buildPrescriptionPdfBytes({
    clinicName: clinic?.name ?? "Clinic",
    petName: pet?.name ?? "—",
    ownerName: ownerDisplayName(owner),
    doctorName: doctor?.full_name ?? "—",
    issuedAt: new Date(rx.issued_at),
    clinicTimezone: clinic?.timezone,
    logoBytes,
    items: items ?? [],
    notes: rx.notes,
  });

  const pdfPath = `${clinic_id}/prescriptions/${prescriptionId}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(MEDICAL_BUCKET)
    .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(upErr.message);

  const { error: u2 } = await supabase.from("prescriptions").update({ pdf_url: pdfPath }).eq("id", prescriptionId);
  if (u2) throw new Error(u2.message);

  const visitId = rx.visit_id;
  revalidatePath(`/visits/${visitId}`);
  return pdfPath;
}

export async function regeneratePrescriptionPdfForm(formData: FormData) {
  const prescriptionId = String(formData.get("prescription_id") ?? "").trim();
  if (!prescriptionId) throw new Error("Prescription id is required.");
  await regeneratePrescriptionPdf(prescriptionId);

  const visitId = String(formData.get("visit_id") ?? "").trim();
  const embed = String(formData.get("embed") ?? "").trim();
  if (visitId) {
    const q = new URLSearchParams();
    q.set("rx_pdf", "1");
    if (embed === "1") q.set("embed", "1");
    redirect(`/visits/${visitId}?${q.toString()}`);
  }
}

export type InvoiceTemplatePreviewSample = {
  clinicName?: string;
  branchLine1?: string;
  branchLine2?: string;
  invoiceNumber?: string;
  ownerName?: string;
  patientName?: string;
  line1Description?: string;
  line1Qty?: number;
  line1Unit?: number;
  line2Description?: string;
  line2Qty?: number;
  line2Unit?: number;
  taxRatePercent?: number | null;
  discountTotal?: number;
  notes?: string;
};

/** PDF preview for the invoice template editor — uses sample amounts you can edit before opening the PDF. */
export async function generateInvoiceTemplatePreviewPdf(
  layout: InvoiceTemplateLayout,
  sample?: InvoiceTemplatePreviewSample
): Promise<{ base64: string }> {
  const access = await getUserAccess();
  if (!canEditInvoiceTemplate(access)) {
    throw new Error("Not allowed.");
  }
  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const { data: clinicRow } = await supabase.from("clinics").select("image_url").eq("id", clinic_id).maybeSingle();
  const logoBytes = await fetchClinicLogoBytesForPdf(supabase, clinicRow?.image_url as string | null | undefined);

  const s = sample ?? {};
  const q1 = Number(s.line1Qty ?? 1);
  const u1 = Number(s.line1Unit ?? 500);
  const q2 = Number(s.line2Qty ?? 0);
  const u2 = Number(s.line2Unit ?? 0);
  const line1Total = (Number.isFinite(q1) ? q1 : 1) * (Number.isFinite(u1) ? u1 : 0);
  const linesRaw: Array<{ description: string; qty: number; unit: number; total: number }> = [
    {
      description: (s.line1Description ?? "Consultation fee").trim() || "Line item",
      qty: Number.isFinite(q1) && q1 > 0 ? q1 : 1,
      unit: Number.isFinite(u1) ? u1 : 0,
      total: line1Total,
    },
  ];
  const hasLine2 =
    (s.line2Description ?? "").trim().length > 0 || (Number.isFinite(q2) && q2 > 0 && Number.isFinite(u2) && u2 > 0);
  if (hasLine2) {
    const qty2 = Number.isFinite(q2) && q2 > 0 ? q2 : 1;
    const unit2 = Number.isFinite(u2) ? u2 : 0;
    linesRaw.push({
      description: (s.line2Description ?? "Lab test").trim() || "Line item",
      qty: qty2,
      unit: unit2,
      total: qty2 * unit2,
    });
  }
  const subtotal = linesRaw.reduce((sum, row) => sum + row.total, 0);
  const ratePercent =
    s.taxRatePercent != null && Number.isFinite(s.taxRatePercent) ? Number(s.taxRatePercent) : 18;
  const taxTotal = subtotal * (ratePercent / 100);
  const discount = Number(s.discountTotal ?? 0) || 0;
  const grandTotal = Math.max(0, subtotal + taxTotal - discount);

  const bytes = await buildInvoicePdfBytes({
    layout: normalizeInvoiceTemplateLayout(layout),
    clinicName: (s.clinicName ?? "Sample Veterinary Clinic").trim() || "Clinic",
    branchLines: [(s.branchLine1 ?? "12 Demo Road, Andheri East").trim(), (s.branchLine2 ?? "Mumbai, MH 400059").trim()],
    invoiceNumber: (s.invoiceNumber ?? nextInvoiceNumber()).trim(),
    issuedAt: new Date(),
    currency: "INR",
    ownerName: (s.ownerName ?? "Sample Owner").trim() || "Owner",
    patientName: (s.patientName ?? "Bruno (Dog)").trim() || "Patient",
    lines: linesRaw,
    subtotal,
    taxRate: ratePercent > 0 ? ratePercent : null,
    taxTotal,
    discountTotal: discount,
    grandTotal,
    notes: s.notes?.trim() || null,
    logoBytes,
  });

  return { base64: Buffer.from(bytes).toString("base64") };
}
