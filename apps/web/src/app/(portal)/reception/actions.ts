"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { APPOINTMENT_BOOKING_CONSENT_TEXT, APPOINTMENT_BOOKING_CONSENT_VERSION } from "@/lib/booking/appointment-consent";
import { createHostingerTransport, getHostingerFromAddress } from "@/lib/email/hostinger-mail";
import { buildBookingConsentPdf } from "@/lib/pdf/booking-consent-pdf";
import { normalizeLegacySpeciesToCanonical } from "@saasclinics/lib";
import { createClient } from "@/lib/supabase/server";

const STAFF_ROLES = new Set([
  "clinic_admin",
  "branch_admin",
  "doctor",
  "receptionist",
  "lab_technician",
  "pharmacist",
]);

function splitOwnerName(raw: string): { first: string; last: string; full: string } {
  const t = raw.trim();
  if (!t) return { first: "Guest", last: "Walk-in", full: "Guest Walk-in" };
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0]!, last: "Walk-in", full: `${parts[0]} Walk-in` };
  const first = parts[0]!;
  const last = parts.slice(1).join(" ");
  return { first, last, full: `${first} ${last}` };
}

function isSignaturePngDataUrl(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith("data:image/png") && value.length > 80);
}

/** One-step walk-in: guest contact (no portal account) + patient; optional appointment slot. */
export async function createWalkInGuestPatient(formData: FormData) {
  const access = await getUserAccess();
  const r = access.membership?.role;
  if (!access.isSuperAdmin && (!r || !STAFF_ROLES.has(r))) {
    throw new Error("Only clinic staff can register walk-in guests.");
  }

  const ownerRaw = String(formData.get("owner_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const petName = String(formData.get("pet_name") ?? "").trim();
  const species = normalizeLegacySpeciesToCanonical(String(formData.get("species") ?? "").trim() || "unknown");
  const breed = String(formData.get("breed") ?? "").trim();
  const ageValueRaw = String(formData.get("age_value") ?? formData.get("age_months") ?? "").trim();
  const ageUnitRaw = String(formData.get("age_unit") ?? "months").trim().toLowerCase();
  const weightKgRaw = String(formData.get("weight_kg") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const createAppointment = String(formData.get("create_appointment") ?? "") === "on";
  const notes = String(formData.get("notes") ?? "").trim();
  const consentAccepted = String(formData.get("booking_consent") ?? "") === "on";
  const signaturePng = String(formData.get("consent_signature_png") ?? "").trim();

  if (!phone) throw new Error("Phone is required for walk-in.");
  if (!petName) throw new Error("Patient name is required.");
  if (!consentAccepted) throw new Error("Owner booking consent is required.");
  if (!isSignaturePngDataUrl(signaturePng)) throw new Error("Owner signature is required.");
  const ageAmount = ageValueRaw ? Number(ageValueRaw) : null;
  const weightKg = weightKgRaw ? Number.parseFloat(weightKgRaw) : null;
  if (ageValueRaw && (!Number.isFinite(ageAmount as number) || (ageAmount as number) < 0)) {
    throw new Error("Age must be a valid non-negative number.");
  }
  const ageMonths =
    ageAmount == null
      ? null
      : ageUnitRaw === "years"
        ? Math.max(0, Math.round(ageAmount * 12))
        : Math.max(0, Math.round(ageAmount));
  if (weightKgRaw && (!Number.isFinite(weightKg as number) || (weightKg as number) < 0)) {
    throw new Error("Weight (kg) must be a valid non-negative number.");
  }

  const { first, last, full } = splitOwnerName(ownerRaw || "");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: clinic } = await supabase.from("clinics").select("name, timezone, support_email").eq("id", clinic_id).maybeSingle();
  const clinicName = (clinic?.name as string | undefined)?.trim() || "Clinic";

  const { data: ownerRow, error: oErr } = await supabase
    .from("owners")
    .insert({
      clinic_id,
      user_id: null,
      first_name: first,
      last_name: last,
      full_name: full,
      phone,
      email: email || null,
      contact_type: "customer",
      contact_notes: notes ? `Walk-in (desk). ${notes}` : "Walk-in (desk) — no portal account yet.",
    })
    .select("id")
    .single();

  if (oErr) throw new Error(oErr.message);
  if (!ownerRow?.id) throw new Error("Could not create contact record.");

  const patientCode = `P-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;

  const { data: petRow, error: pErr } = await supabase
    .from("pets")
    .insert({
      clinic_id,
      owner_id: ownerRow.id,
      name: petName,
      species,
      breed: breed || null,
      age_months: ageMonths,
      weight_kg: weightKg,
      patient_code: patientCode,
      primary_branch_id: branchId || null,
    })
    .select("id")
    .single();

  if (pErr) throw new Error(pErr.message);
  if (!petRow?.id) throw new Error("Could not create patient.");

  let appointmentId: string | null = null;
  const startsAt = new Date().toISOString();
  const signedAt = startsAt;
  const ownerIntake = {
    consent_accepted: true,
    consent_text: APPOINTMENT_BOOKING_CONSENT_TEXT,
    consent_version: APPOINTMENT_BOOKING_CONSENT_VERSION,
    consent_at: signedAt,
    walk_in: true,
  };

  if (createAppointment && branchId) {
    const { data: appt, error: aErr } = await supabase
      .from("appointments")
      .insert({
        clinic_id,
        branch_id: branchId,
        pet_id: petRow.id,
        owner_id: ownerRow.id,
        appointment_type: "consultation",
        status: "scheduled",
        starts_at: startsAt,
        notes: notes ? `Walk-in from web front desk. ${notes}` : "Walk-in from web front desk",
        owner_intake: ownerIntake,
        booking_source: "clinic_portal",
        consent_signed_at: signedAt,
      })
      .select("id")
      .single();
    if (aErr) throw new Error(aErr.message);
    appointmentId = appt?.id ?? null;
  }

  if (appointmentId && isSignaturePngDataUrl(signaturePng)) {
    try {
      const pdfBytes = await buildBookingConsentPdf({
        clinicName,
        ownerName: full,
        petName,
        petSpecies: species,
        appointmentAtIso: startsAt,
        signedAtIso: signedAt,
        consentText: APPOINTMENT_BOOKING_CONSENT_TEXT,
        signaturePngBase64: signaturePng,
        documentTitle: "Walk-in visit consent",
        documentSubtitle: "Signed consent form",
        footerLabel: `${clinicName} · Walk-in consent`,
        clinicTimezone: (clinic as { timezone?: string | null } | null)?.timezone,
      });
      const path = `${clinic_id}/consent/${appointmentId}.pdf`;
      const { error: upErr } = await supabase.storage.from("medical-files").upload(path, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (!upErr) {
        await supabase
          .from("appointments")
          .update({
            consent_pdf_path: path,
            owner_intake: { ...ownerIntake, consent_pdf_path: path },
          })
          .eq("id", appointmentId)
          .eq("clinic_id", clinic_id);

        const transporter = createHostingerTransport();
        const from = getHostingerFromAddress();
        if (transporter && from) {
          const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim().toLowerCase();
          const supportEmail = (clinic as { support_email?: string | null } | null)?.support_email?.trim().toLowerCase();
          const recipients = Array.from(new Set([adminEmail, supportEmail].filter((value): value is string => Boolean(value))));
          await Promise.allSettled(
            recipients.map((recipient) =>
              transporter.sendMail({
                from,
                to: recipient,
                replyTo: email || undefined,
                subject: `${clinicName} walk-in consent for ${petName}`,
                text: `Walk-in consent form attached.\n\nOwner: ${full}\nPhone: ${phone}\nEmail: ${email || "—"}\nPatient: ${petName}\n`,
                attachments: [
                  {
                    filename: `consent-${petName.replace(/\s+/g, "-").toLowerCase()}.pdf`,
                    content: Buffer.from(pdfBytes),
                    contentType: "application/pdf",
                  },
                ],
              }),
            ),
          );
        }
      }
    } catch (consentErr) {
      console.error("[walk-in] consent PDF/email failed", consentErr);
    }
  }

  revalidatePath("/owners");
  revalidatePath("/pets");
  revalidatePath("/appointments");
  redirect("/appointments");
}
