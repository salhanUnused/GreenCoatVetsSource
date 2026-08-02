"use server";

import {
  assertAppointmentStartsInFuture,
  DEFAULT_PET_SPECIES_BOOKING_VALUE,
  normalizeLegacySpeciesToCanonical,
} from "@saasclinics/lib";
import { redirect } from "next/navigation";
import { APPOINTMENT_BOOKING_CONSENT_TEXT, APPOINTMENT_BOOKING_CONSENT_VERSION } from "@/lib/booking/appointment-consent";
import { isSignaturePngDataUrl, uploadBookingConsentPdf } from "@/lib/booking/persist-booking-consent";
import {
  formatBookingAgeLabel,
  normalizeBookingAgeUnit,
  normalizeBookingPetGender,
  parseBookingAgeToMonths,
} from "@/lib/booking/pet-demographics";
import { sendAppointmentBookingNotificationEmail } from "@/lib/email/send-appointment-booking-notification-email";
import { getOwnerPortalContext } from "@/lib/owner/portal";
import { createClient } from "@/lib/supabase/server";

const appointmentTypes = ["consultation", "vaccination", "surgery", "grooming", "emergency"] as const;

async function resolvePublicBranchNameForClinic(clinicId: string, branchId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_branches_for_clinic", {
    p_clinic_id: clinicId,
  });
  if (error) return branchId;
  const rows = (data ?? []) as Array<{ id: string; name: string }>;
  return rows.find((row) => row.id === branchId)?.name?.trim() || branchId;
}

export async function submitOwnerBooking(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/book");

  const portalCtx = await getOwnerPortalContext(user.id);
  if (!portalCtx) throw new Error("Owner profile not found.");
  const { owner: ownerRow, clinic } = portalCtx;

  const branchId = String(formData.get("branch_id") ?? "").trim();
  const existingPetId = String(formData.get("pet_id") ?? "").trim();
  const newPetName = String(formData.get("new_pet_name") ?? "").trim();
  const newPetSpecies = String(formData.get("new_pet_species") ?? "").trim();
  const petGender = normalizeBookingPetGender(String(formData.get("pet_gender") ?? ""));
  const petAgeYears = String(formData.get("pet_age_years") ?? "").trim();
  const petAgeUnit = normalizeBookingAgeUnit(String(formData.get("pet_age_unit") ?? ""));
  const petAgeMonths = parseBookingAgeToMonths(petAgeYears, petAgeUnit);
  const appointmentType = String(formData.get("appointment_type") ?? "consultation").trim();
  const doctorId = String(formData.get("doctor_id") ?? "").trim() || null;
  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const chiefComplaint = String(formData.get("chief_complaint") ?? "").trim();
  const allergies = String(formData.get("allergies") ?? "").trim();
  const currentMedications = String(formData.get("current_medications") ?? "").trim();
  const contactFullName = String(formData.get("contact_full_name") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim();
  const consentAccepted = String(formData.get("booking_consent") ?? "") === "on";
  const signaturePng = String(formData.get("consent_signature_png") ?? "").trim();

  if (!branchId || !startsAtRaw) {
    throw new Error("Branch and time are required.");
  }
  if (!existingPetId && !newPetName) {
    throw new Error("Branch, pet and time are required.");
  }
  if (!existingPetId && !petGender) {
    throw new Error("Pet gender is required for a new pet.");
  }
  if (!existingPetId && !petAgeMonths) {
    throw new Error("Pet age is required for a new pet.");
  }
  if (!appointmentTypes.includes(appointmentType as (typeof appointmentTypes)[number])) {
    throw new Error("Invalid appointment type.");
  }
  if (!consentAccepted) {
    throw new Error("You must accept the booking consent before submitting.");
  }
  if (!isSignaturePngDataUrl(signaturePng)) {
    throw new Error("Owner signature is required on the consent form.");
  }
  if (!contactFullName) {
    throw new Error("Full name is required.");
  }
  if (!contactPhone) {
    throw new Error("Contact phone is required.");
  }

  const startsAt = assertAppointmentStartsInFuture(startsAtRaw).toISOString();
  const branchName = await resolvePublicBranchNameForClinic(clinic.id, branchId);
  const patientAgeLabel = formatBookingAgeLabel(petAgeYears, petAgeUnit);
  let petId = existingPetId;

  if (!petId) {
    const { data: createdPet, error: petError } = await supabase
      .from("pets")
      .insert({
        clinic_id: clinic.id,
        owner_id: ownerRow.id,
        primary_branch_id: branchId,
        name: newPetName,
        species: normalizeLegacySpeciesToCanonical(newPetSpecies || DEFAULT_PET_SPECIES_BOOKING_VALUE),
        gender: petGender,
        age_months: petAgeMonths,
        is_active: true,
      })
      .select("id")
      .single();
    if (petError) throw new Error(petError.message);
    petId = createdPet.id;
  } else if (petGender || petAgeMonths) {
    const { error: petUpdateError } = await supabase
      .from("pets")
      .update({
        gender: petGender || undefined,
        age_months: petAgeMonths ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", petId)
      .eq("clinic_id", clinic.id)
      .eq("owner_id", ownerRow.id);
    if (petUpdateError) throw new Error(petUpdateError.message);
  }

  const ownerIntake = {
    chief_complaint: chiefComplaint || null,
    allergies: allergies || null,
    current_medications: currentMedications || null,
    contact_name: contactFullName || null,
    contact_phone: contactPhone || null,
    contact_email: contactEmail || null,
    patient_gender: petGender || null,
    patient_age: patientAgeLabel || null,
    consent_accepted: true,
    consent_text: APPOINTMENT_BOOKING_CONSENT_TEXT,
    consent_version: APPOINTMENT_BOOKING_CONSENT_VERSION,
    consent_at: new Date().toISOString(),
  };

  const nextOwnerName = contactFullName || ownerRow.full_name;
  const nextOwnerPhone = contactPhone || ownerRow.phone;
  const nextOwnerEmail = contactEmail || ownerRow.email;

  const { error: ownerUpdateError } = await supabase
    .from("owners")
    .update({
      full_name: nextOwnerName,
      phone: nextOwnerPhone,
      email: nextOwnerEmail || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ownerRow.id)
    .eq("clinic_id", clinic.id);
  if (ownerUpdateError) throw new Error(ownerUpdateError.message);

  const { data: insertedAppt, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: clinic.id,
      branch_id: branchId,
      doctor_id: doctorId,
      pet_id: petId,
      owner_id: ownerRow.id,
      appointment_type: appointmentType,
      status: "scheduled",
      starts_at: startsAt,
      reason: chiefComplaint || null,
      notes: notes || null,
      owner_intake: ownerIntake,
      booking_source: "owner_portal",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!insertedAppt?.id) throw new Error("Booking failed.");

  let petDisplayName = newPetName;
  if (existingPetId) {
    const { data: petRow } = await supabase.from("pets").select("name").eq("id", petId).maybeSingle();
    petDisplayName = (petRow?.name as string | undefined) ?? "—";
  }

  let consentPdfAttachment: { filename: string; content: Buffer } | null = null;
  try {
    const uploaded = await uploadBookingConsentPdf({
      supabase,
      clinicId: clinic.id,
      appointmentId: insertedAppt.id,
      clinicName: clinic.name,
      ownerName: nextOwnerName,
      petName: petDisplayName,
      chiefComplaint: chiefComplaint || null,
      appointmentAtIso: startsAt,
      signaturePngBase64: signaturePng,
    });
    if (uploaded) {
      consentPdfAttachment = {
        filename: `consent-${petDisplayName.replace(/\s+/g, "-").toLowerCase()}.pdf`,
        content: uploaded.buffer,
      };
      await supabase
        .from("appointments")
        .update({
          owner_intake: {
            ...ownerIntake,
            consent_at: uploaded.signedAtIso,
            consent_pdf_path: uploaded.path,
          },
        })
        .eq("id", insertedAppt.id)
        .eq("clinic_id", clinic.id);
    }
  } catch (consentErr) {
    console.error("[book] consent PDF failed", consentErr);
  }

  try {
    await sendAppointmentBookingNotificationEmail({
      clinicId: clinic.id,
      clinicName: clinic.name,
      branchName,
      appointmentType,
      startsAtIso: startsAt,
      petName: petDisplayName,
      ownerDisplay: nextOwnerName,
      ownerEmail: nextOwnerEmail,
      ownerPhone: nextOwnerPhone,
      chiefComplaint: chiefComplaint || null,
      notes: notes || null,
      bookingSource: "owner_portal",
      consentPdfAttachment,
    });
  } catch (mailErr) {
    console.error("[book] admin notification email failed", mailErr);
  }

  redirect(`/account?booked=1&branch=${encodeURIComponent(branchName)}`);
}
