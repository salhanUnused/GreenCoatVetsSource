"use server";

import { revalidatePath } from "next/cache";
import { createHostingerTransport, getHostingerFromAddress } from "@/lib/email/hostinger-mail";
import { renderBrandedEmail } from "@/lib/email/render-branded-email";
import { fetchClinicLogoBytesForPdf } from "@/lib/invoicing/fetch-clinic-logo";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getPlatformBranding } from "@/lib/platform-branding";
import { buildHandwrittenCanvasPdfBytes } from "@/lib/pdf/clinic-documents";
import { createClient } from "@/lib/supabase/server";
import { buildVisitReportPdfForVisit } from "@/lib/pdf/visit-report-pdf";
import { buildHandwrittenVisitStatePath } from "@/lib/visits/handwritten-visit-sheet";
import { recognizeHandwrittenRegionCore } from "@/lib/visits/recognize-handwritten-region-server";
import { assertVisitReportAccess } from "@/lib/visits/visit-report-access";

const BUCKET = "medical-files";

export async function recognizeHandwrittenRegionAction(
  input: Parameters<typeof recognizeHandwrittenRegionCore>[0],
) {
  return recognizeHandwrittenRegionCore(input);
}

/**
 * Generates the PDF, uploads to medical-files, and stores the path on the visit row (attachment for pet profile).
 */
export async function regenerateVisitReportPdfAttachment(visitId: string, options?: { force?: boolean }) {
  const access = await getUserAccess();
  if (access.membership?.role === "pet_owner") {
    throw new Error("Only clinic staff can save visit PDFs to the record.");
  }
  const supabase = createClient();
  await assertVisitReportAccess(supabase, access, visitId);

  const { data: visit, error: vErr } = await supabase
    .from("visits")
    .select("*")
    .eq("id", visitId)
    .single();

  if (vErr || !visit) throw new Error(vErr?.message ?? "Visit not found.");
  const pdfSource = (visit as { visit_report_pdf_source?: string | null }).visit_report_pdf_source;
  if ((pdfSource === "handwritten" || pdfSource === "photo_sheet") && !options?.force) {
    return;
  }

  const bytes = await buildVisitReportPdfForVisit(supabase, visitId);
  const path = `${visit.clinic_id}/pets/${visit.pet_id}/visits/${visitId}/visit-report.pdf`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) throw new Error(upErr.message);

  const nowIso = new Date().toISOString();
  let { error: upRow } = await supabase
    .from("visits")
    .update({
      visit_report_pdf_path: path,
      visit_report_pdf_generated_at: nowIso,
      visit_report_pdf_source: "generated",
    })
    .eq("id", visitId)
    .eq("clinic_id", visit.clinic_id as string);

  if (upRow && /visit_report_pdf_source/i.test(upRow.message)) {
    const fallback = await supabase
      .from("visits")
      .update({
        visit_report_pdf_path: path,
        visit_report_pdf_generated_at: nowIso,
      })
      .eq("id", visitId)
      .eq("clinic_id", visit.clinic_id as string);
    upRow = fallback.error;
  }

  if (upRow) throw new Error(upRow.message);

  revalidatePath(`/visits/${visitId}`);
  revalidatePath(`/pets/${visit.pet_id}`);
}

export async function regenerateVisitReportPdfFormAction(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  if (!visitId) throw new Error("Visit id is required.");
  await regenerateVisitReportPdfAttachment(visitId, { force: true });
}

type SaveHandwrittenVisitPdfResult = { ok: true; pdfPath: string } | { ok: false; error: string };

function decodeImageDataUrl(dataUrl: string): Uint8Array {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) {
    throw new Error("Handwritten visit image is invalid.");
  }
  return Uint8Array.from(Buffer.from(match[2] ?? "", "base64"));
}

async function readHandwrittenImageUpload(formData: FormData): Promise<Uint8Array> {
  const uploaded = formData.get("image_file");
  const file = uploaded instanceof File ? uploaded : null;
  if (file && file.size > 0) {
    if (!(file.type || "").startsWith("image/")) {
      throw new Error("Handwritten visit upload must be an image.");
    }
    return new Uint8Array(await file.arrayBuffer());
  }

  const imageDataUrl = String(formData.get("image_data_url") ?? "").trim();
  if (!imageDataUrl) {
    throw new Error("Visit and handwritten image are required.");
  }
  return decodeImageDataUrl(imageDataUrl);
}

export async function saveHandwrittenVisitPdfAction(formData: FormData): Promise<SaveHandwrittenVisitPdfResult> {
  try {
    const access = await getUserAccess();
    if (access.membership?.role === "pet_owner") {
      return { ok: false, error: "Only clinic staff can save handwritten visit sheets." };
    }

    const visitId = String(formData.get("visit_id") ?? "").trim();
    if (!visitId) {
      return { ok: false, error: "Visit and handwritten image are required." };
    }

    const supabase = createClient();
    await assertVisitReportAccess(supabase, access, visitId);

    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .select("id, clinic_id, pet_id, branch_id")
      .eq("id", visitId)
      .single();

    if (visitError || !visit) {
      return { ok: false, error: visitError?.message ?? "Visit not found." };
    }

    const uploadedImageBytes = await readHandwrittenImageUpload(formData);
    const { data: brandingRow } = await supabase.from("platform_branding").select("logo_url").eq("id", "default").maybeSingle();
    const logoBytes = await fetchClinicLogoBytesForPdf(supabase, (brandingRow?.logo_url as string | null | undefined) ?? null);
    const pdfBytes = await buildHandwrittenCanvasPdfBytes({
      imageBytes: uploadedImageBytes,
      footerText: `Handwritten visit sheet saved ${new Date().toLocaleString()}.`,
      logoBytes,
    });
    const path = `${visit.clinic_id}/pets/${visit.pet_id}/visits/${visitId}/visit-report-handwritten.pdf`;
    const stateJson = String(formData.get("editor_state_json") ?? "").trim();

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadError) return { ok: false, error: uploadError.message };

    if (stateJson) {
      const statePath = buildHandwrittenVisitStatePath(
        String(visit.clinic_id),
        String(visit.pet_id),
        visitId,
      );
      const stateBytes = new TextEncoder().encode(stateJson);
      const { error: stateUploadError } = await supabase.storage.from(BUCKET).upload(statePath, stateBytes, {
        contentType: "application/json",
        upsert: true,
      });
      if (stateUploadError) return { ok: false, error: stateUploadError.message };
    }

    const nowIso = new Date().toISOString();
    let { error: visitUpdateError } = await supabase
      .from("visits")
      .update({
        visit_report_pdf_path: path,
        visit_report_pdf_generated_at: nowIso,
        visit_report_pdf_source: "handwritten",
      })
      .eq("id", visitId)
      .eq("clinic_id", visit.clinic_id as string);
    if (visitUpdateError && /visit_report_pdf_source/i.test(visitUpdateError.message)) {
      const fallback = await supabase
        .from("visits")
        .update({
          visit_report_pdf_path: path,
          visit_report_pdf_generated_at: nowIso,
        })
        .eq("id", visitId)
        .eq("clinic_id", visit.clinic_id as string);
      visitUpdateError = fallback.error;
    }
    if (visitUpdateError) return { ok: false, error: visitUpdateError.message };

    revalidatePath(`/visits/${visitId}`);
    revalidatePath(`/pets/${visit.pet_id}`);
    return { ok: true, pdfPath: path };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save handwritten visit PDF." };
  }
}

export async function saveVisitPhotoSheetPdfAction(formData: FormData): Promise<SaveHandwrittenVisitPdfResult> {
  try {
    const access = await getUserAccess();
    if (access.membership?.role === "pet_owner") {
      return { ok: false, error: "Only clinic staff can save visit photo sheets." };
    }

    const visitId = String(formData.get("visit_id") ?? "").trim();
    if (!visitId) {
      return { ok: false, error: "Visit and photo are required." };
    }

    const supabase = createClient();
    await assertVisitReportAccess(supabase, access, visitId);

    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .select("id, clinic_id, pet_id, branch_id")
      .eq("id", visitId)
      .single();

    if (visitError || !visit) {
      return { ok: false, error: visitError?.message ?? "Visit not found." };
    }

    const uploadedImageBytes = await readHandwrittenImageUpload(formData);
    const capturedAtRaw = String(formData.get("captured_at") ?? "").trim();
    const capturedAt = capturedAtRaw ? new Date(capturedAtRaw) : new Date();
    const scannedLabel = Number.isNaN(capturedAt.getTime())
      ? new Date().toLocaleString()
      : capturedAt.toLocaleString();
    const { data: brandingRow } = await supabase.from("platform_branding").select("logo_url").eq("id", "default").maybeSingle();
    const logoBytes = await fetchClinicLogoBytesForPdf(supabase, (brandingRow?.logo_url as string | null | undefined) ?? null);
    const pdfBytes = await buildHandwrittenCanvasPdfBytes({
      imageBytes: uploadedImageBytes,
      footerText: `Photo visit sheet captured ${scannedLabel}.`,
      logoBytes,
    });
    const path = `${visit.clinic_id}/pets/${visit.pet_id}/visits/${visitId}/visit-report-photo.pdf`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadError) return { ok: false, error: uploadError.message };

    const nowIso = new Date().toISOString();
    let { error: visitUpdateError } = await supabase
      .from("visits")
      .update({
        visit_report_pdf_path: path,
        visit_report_pdf_generated_at: nowIso,
        visit_report_pdf_source: "photo_sheet",
      })
      .eq("id", visitId)
      .eq("clinic_id", visit.clinic_id as string);
    if (visitUpdateError && /visit_report_pdf_source/i.test(visitUpdateError.message)) {
      const fallback = await supabase
        .from("visits")
        .update({
          visit_report_pdf_path: path,
          visit_report_pdf_generated_at: nowIso,
        })
        .eq("id", visitId)
        .eq("clinic_id", visit.clinic_id as string);
      visitUpdateError = fallback.error;
    }
    if (visitUpdateError) return { ok: false, error: visitUpdateError.message };

    revalidatePath(`/visits/${visitId}`);
    revalidatePath(`/pets/${visit.pet_id}`);
    return { ok: true, pdfPath: path };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save photo visit sheet PDF." };
  }
}

type ShareVisitReportPdfResult = { ok: true; sentTo: string } | { ok: false; error: string };

export async function shareVisitReportPdfByEmailAction(formData: FormData): Promise<ShareVisitReportPdfResult> {
  try {
    const access = await getUserAccess();
    if (access.membership?.role === "pet_owner") {
      return { ok: false, error: "Only clinic staff can share visit PDFs by email." };
    }

    const visitId = String(formData.get("visit_id") ?? "").trim();
    if (!visitId) {
      return { ok: false, error: "Visit id is required." };
    }

    const manualRecipient = String(formData.get("recipient_email") ?? "").trim().toLowerCase();
    const supabase = createClient();
    await assertVisitReportAccess(supabase, access, visitId);

    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .select("id, clinic_id, branch_id, owner_id, visit_report_pdf_path, pets(name), owners(full_name, email), appointments(owner_intake)")
      .eq("id", visitId)
      .maybeSingle();
    if (visitError || !visit) {
      return { ok: false, error: visitError?.message ?? "Visit not found." };
    }

    const path = String((visit as { visit_report_pdf_path?: string | null }).visit_report_pdf_path ?? "").trim();
    if (!path) {
      return { ok: false, error: "Save the visit report PDF before sharing it." };
    }

    const appointmentRaw = (visit as { appointments?: Record<string, unknown> | Record<string, unknown>[] | null }).appointments ?? null;
    const appointment = Array.isArray(appointmentRaw) ? appointmentRaw[0] ?? null : appointmentRaw;
    const intake =
      appointment?.owner_intake && typeof appointment.owner_intake === "object" && !Array.isArray(appointment.owner_intake)
        ? (appointment.owner_intake as Record<string, unknown>)
        : null;
    const intakeEmail = String(intake?.contact_email ?? "").trim().toLowerCase();
    const owner = visit.owners as { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
    const ownerRow = Array.isArray(owner) ? owner[0] ?? null : owner;
    const recipient = manualRecipient || intakeEmail || String(ownerRow?.email ?? "").trim().toLowerCase();
    if (!recipient) {
      return { ok: false, error: "No recipient email is available for this visit." };
    }

    const transporter = createHostingerTransport();
    const from = getHostingerFromAddress();
    if (!transporter || !from) {
      return { ok: false, error: "Hostinger SMTP is not configured on the server." };
    }

    const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
    if (downloadError || !blob) {
      return { ok: false, error: "Visit report file is missing from storage." };
    }

    const pet = visit.pets as { name?: string | null } | { name?: string | null }[] | null;
    const petRow = Array.isArray(pet) ? pet[0] ?? null : pet;
    const ownerName = String(ownerRow?.full_name ?? "").trim() || "pet owner";
    const petName = String(petRow?.name ?? "").trim() || "patient";
    const attachmentName = `visit-report-${petName.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase() || visitId.slice(0, 8)}.pdf`;
    const fileBytes = Buffer.from(await blob.arrayBuffer());
    const branding = await getPlatformBranding();
    const brandName = branding.product_name || "GreenCoatVets";
    const mail = renderBrandedEmail({
      brandName,
      heading: `Visit report for ${petName}`,
      intro: `Hi ${ownerName}, your saved visit report PDF for ${petName} is attached.`,
      body: [
        "Keep this report for your records and contact the clinic if you need any clarification on the visit summary.",
        "You can also open the GreenCoatVets mobile app → Reports to download this PDF anytime.",
      ],
      footer: `${brandName} visit reports`,
    });

    await transporter.sendMail({
      from,
      to: recipient,
      subject: `Visit report for ${petName}`,
      text: mail.text,
      html: mail.html,
      attachments: [
        {
          filename: attachmentName,
          content: fileBytes,
          contentType: "application/pdf",
        },
      ],
    });

    const ownerId = (visit as { owner_id?: string | null }).owner_id;
    const clinicId = String((visit as { clinic_id?: string }).clinic_id ?? "");
    const branchId = ((visit as { branch_id?: string | null }).branch_id as string | null) ?? null;
    if (ownerId && clinicId) {
      const { error: notifError } = await supabase.from("notifications").insert({
        clinic_id: clinicId,
        branch_id: branchId,
        owner_id: ownerId,
        channel: "push",
        title: `Visit report shared for ${petName}`,
        message: `Your clinic emailed the visit report PDF for ${petName} to ${recipient}. Open Reports in the app to download it anytime.`,
        payload: {
          kind: "visit_report_shared",
          visit_id: visitId,
          pet_name: petName,
          emailed_to: recipient,
        },
        sent_at: new Date().toISOString(),
      });
      if (notifError) {
        console.error("[shareVisitReportPdf] owner notification failed", notifError.message);
      }
    }

    revalidatePath(`/visits/${visitId}`);
    return { ok: true, sentTo: recipient };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to email the visit report." };
  }
}
