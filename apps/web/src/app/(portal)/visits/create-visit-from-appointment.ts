"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

/** Thin action — no PDF/OCR imports (safe for appointments route). */
export async function createVisitFromAppointment(formData: FormData) {
  const appointmentId = String(formData.get("appointment_id") ?? "").trim();
  if (!appointmentId) throw new Error("Appointment id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .select("id, clinic_id, branch_id, pet_id, owner_id, doctor_id")
    .eq("id", appointmentId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (apptError) throw new Error(apptError.message);
  if (!appointment) throw new Error("Appointment not found.");

  const { data: existingVisit } = await supabase
    .from("visits")
    .select("id")
    .eq("appointment_id", appointmentId)
    .limit(1)
    .maybeSingle();

  if (existingVisit?.id) {
    revalidatePath(`/visits/${existingVisit.id}`);
    return existingVisit.id;
  }

  const nowIso = new Date().toISOString();
  const { data: createdVisit, error: visitError } = await supabase
    .from("visits")
    .insert({
      clinic_id: appointment.clinic_id,
      branch_id: appointment.branch_id,
      appointment_id: appointment.id,
      pet_id: appointment.pet_id,
      owner_id: appointment.owner_id,
      doctor_id: appointment.doctor_id,
      check_in_at: nowIso,
      started_at: nowIso,
    })
    .select("id")
    .single();

  if (visitError) throw new Error(visitError.message);

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "checked_in" })
    .eq("id", appointment.id)
    .eq("clinic_id", clinic_id);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/appointments");
  revalidatePath(`/visits/${createdVisit.id}`);
  return createdVisit.id;
}
