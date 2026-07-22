"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertAppointmentStartsInFuture,
  DEFAULT_PET_SPECIES_BOOKING_VALUE,
  normalizeLegacySpeciesToCanonical,
} from "@saasclinics/lib";
import { APPOINTMENT_BOOKING_CONSENT_TEXT, APPOINTMENT_BOOKING_CONSENT_VERSION } from "@/lib/booking/appointment-consent";
import { isSignaturePngDataUrl, uploadBookingConsentPdf } from "@/lib/booking/persist-booking-consent";
import { normalizeBookingPetGender, parseBookingAgeYearsToMonths } from "@/lib/booking/pet-demographics";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { sendAppointmentBookingNotificationEmail } from "@/lib/email/send-appointment-booking-notification-email";
import { createClient } from "@/lib/supabase/server";

const appointmentTypes = ["consultation", "vaccination", "surgery", "grooming", "emergency"] as const;

type GuestRpcResult = {
  appointment_id: string;
  merge_token: string;
  owner_id: string;
};

async function resolvePublicBranchNameForClinic(clinicId: string, branchId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_branches_for_clinic", {
    p_clinic_id: clinicId,
  });
  if (error) return branchId;
  const rows = (data ?? []) as Array<{ id: string; name: string }>;
  return rows.find((row) => row.id === branchId)?.name?.trim() || branchId;
}

export async function submitGuestBooking(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const clinic = await resolveClinic();
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const appointmentType = String(formData.get("appointment_type") ?? "consultation").trim();
  const doctorId = String(formData.get("doctor_id") ?? "").trim() || null;
  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();
  const fullName = String(formData.get("guest_full_name") ?? "").trim();
  const phone = String(formData.get("guest_phone") ?? "").trim();
  const email = String(formData.get("guest_email") ?? "").trim().toLowerCase();
  const petName = String(formData.get("pet_name") ?? "").trim();
  const petSpecies = String(formData.get("pet_species") ?? "").trim();
  const petGender = normalizeBookingPetGender(String(formData.get("pet_gender") ?? ""));
  const petAgeYears = String(formData.get("pet_age_years") ?? "").trim();
  const petAgeMonths = parseBookingAgeYearsToMonths(petAgeYears);
  const chiefComplaint = String(formData.get("chief_complaint") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const allergies = String(formData.get("allergies") ?? "").trim();
  const currentMedications = String(formData.get("current_medications") ?? "").trim();
  const consentAccepted = String(formData.get("booking_consent") ?? "") === "on";
  const signaturePng = String(formData.get("consent_signature_png") ?? "").trim();

  if (!branchId || !startsAtRaw || !fullName || !phone || !email || !petName) {
    throw new Error("Please fill in branch, date & time, your details, and pet name.");
  }
  if (!petGender) {
    throw new Error("Pet gender is required.");
  }
  if (!petAgeMonths) {
    throw new Error("Pet age is required.");
  }
  if (!consentAccepted) {
    throw new Error("You must accept the booking consent before submitting.");
  }
  if (!isSignaturePngDataUrl(signaturePng)) {
    throw new Error("Owner signature is required on the consent form.");
  }
  if (!appointmentTypes.includes(appointmentType as (typeof appointmentTypes)[number])) {
    throw new Error("Invalid appointment type.");
  }

  const startsAt = assertAppointmentStartsInFuture(startsAtRaw).toISOString();
  const branchName = await resolvePublicBranchNameForClinic(clinic.id, branchId);

  const { data, error } = await supabase.rpc("create_guest_website_booking", {
    p_clinic_id: clinic.id,
    p_branch_id: branchId,
    p_doctor_id: doctorId,
    p_starts_at: startsAt,
    p_appointment_type: appointmentType,
    p_owner_full_name: fullName,
    p_owner_phone: phone,
    p_owner_email: email,
    p_pet_name: petName,
    p_pet_species: normalizeLegacySpeciesToCanonical(petSpecies || DEFAULT_PET_SPECIES_BOOKING_VALUE),
    p_pet_gender: petGender,
    p_pet_age_months: petAgeMonths,
    p_chief_complaint: chiefComplaint,
    p_notes: notes,
    p_allergies: allergies,
    p_current_medications: currentMedications,
    p_consent_accepted: true,
    p_consent_text: APPOINTMENT_BOOKING_CONSENT_TEXT,
    p_consent_version: APPOINTMENT_BOOKING_CONSENT_VERSION,
  });

  if (error) throw new Error(error.message);

  const raw = data as unknown;
  const row =
    raw && typeof raw === "object" && "merge_token" in raw && "owner_id" in raw
      ? (raw as GuestRpcResult)
      : null;
  if (!row?.merge_token) throw new Error("Booking failed.");

  if (user?.email && user.email.toLowerCase() === email) {
    await supabase.from("owners").update({ user_id: user.id }).eq("id", row.owner_id);
  }

  let consentPdfAttachment: { filename: string; content: Buffer } | null = null;
  try {
    const uploaded = await uploadBookingConsentPdf({
      supabase,
      clinicId: clinic.id,
      appointmentId: row.appointment_id,
      clinicName: clinic.name,
      ownerName: fullName,
      petName,
      petSpecies: normalizeLegacySpeciesToCanonical(petSpecies || DEFAULT_PET_SPECIES_BOOKING_VALUE),
      chiefComplaint: chiefComplaint || null,
      appointmentAtIso: startsAt,
      signaturePngBase64: signaturePng,
    });
    if (uploaded) {
      consentPdfAttachment = { filename: `consent-${petName.replace(/\s+/g, "-").toLowerCase()}.pdf`, content: uploaded.buffer };
    }
  } catch (consentErr) {
    console.error("[book/guest] consent PDF failed", consentErr);
  }

  try {
    await sendAppointmentBookingNotificationEmail({
      clinicId: clinic.id,
      clinicName: clinic.name,
      branchName,
      appointmentType,
      startsAtIso: startsAt,
      petName,
      ownerDisplay: fullName,
      ownerEmail: email,
      ownerPhone: phone,
      chiefComplaint: chiefComplaint || null,
      notes: notes || null,
      bookingSource: "guest_website",
      bookingCode: row.merge_token,
      consentPdfAttachment,
    });
  } catch (mailErr) {
    console.error("[book/guest] admin notification email failed", mailErr);
  }

  redirect(`/book/confirmed?token=${encodeURIComponent(row.merge_token)}&branch=${encodeURIComponent(branchName)}`);
}

export async function claimGuestBookingWithToken(
  _prev: { ok?: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = createClient();
  const token = String(formData.get("merge_token") ?? "").trim();
  if (!token) return { ok: false, error: "Enter the code from your confirmation page." };

  const { error } = await supabase.rpc("claim_guest_booking_with_token", {
    p_token: token,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/account");
  redirect("/account?claimed=1");
}
