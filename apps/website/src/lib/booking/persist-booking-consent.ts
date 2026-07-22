import { APPOINTMENT_BOOKING_CONSENT_TEXT } from "@/lib/booking/appointment-consent";
import { buildBookingConsentPdf } from "@/lib/pdf/online-consent-pdf";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "medical-files";

export function isSignaturePngDataUrl(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith("data:image/png") && value.length > 80);
}

export async function uploadBookingConsentPdf(params: {
  supabase: SupabaseClient;
  clinicId: string;
  appointmentId: string;
  clinicName: string;
  ownerName: string;
  petName: string;
  petSpecies?: string | null;
  chiefComplaint?: string | null;
  appointmentAtIso?: string | null;
  signaturePngBase64: string;
  consentText?: string;
  documentTitle?: string;
  documentSubtitle?: string;
  clinicTimezone?: string | null;
}): Promise<{ path: string; buffer: Buffer; signedAtIso: string } | null> {
  if (!isSignaturePngDataUrl(params.signaturePngBase64)) return null;

  let clinicTimezone = params.clinicTimezone ?? null;
  if (!clinicTimezone) {
    const { data: clinicRow } = await params.supabase
      .from("clinics")
      .select("timezone")
      .eq("id", params.clinicId)
      .maybeSingle();
    clinicTimezone = (clinicRow as { timezone?: string | null } | null)?.timezone ?? null;
  }

  const signedAtIso = new Date().toISOString();
  const pdfBytes = await buildBookingConsentPdf({
    clinicName: params.clinicName,
    ownerName: params.ownerName,
    petName: params.petName,
    petSpecies: params.petSpecies,
    chiefComplaint: params.chiefComplaint,
    appointmentAtIso: params.appointmentAtIso,
    signedAtIso,
    consentText: params.consentText ?? APPOINTMENT_BOOKING_CONSENT_TEXT,
    signaturePngBase64: params.signaturePngBase64,
    documentTitle: params.documentTitle ?? "Appointment booking consent",
    documentSubtitle: params.documentSubtitle ?? "Signed consent form",
    footerLabel: `${params.clinicName} · Booking consent`,
    clinicTimezone: clinicTimezone,
  });

  const path = `${params.clinicId}/consent/${params.appointmentId}.pdf`;
  const { error: upErr } = await params.supabase.storage.from(BUCKET).upload(path, pdfBytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upErr) {
    console.error("[booking-consent] upload failed", upErr.message);
    return null;
  }

  await params.supabase
    .from("appointments")
    .update({ consent_pdf_path: path, consent_signed_at: signedAtIso })
    .eq("id", params.appointmentId)
    .eq("clinic_id", params.clinicId);

  return { path, buffer: Buffer.from(pdfBytes), signedAtIso };
}
