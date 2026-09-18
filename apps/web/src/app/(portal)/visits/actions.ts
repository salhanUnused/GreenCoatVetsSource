"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";
import { REFERRED_TEST_OPTIONS, testFieldName } from "@/lib/clinical/referred-tests";
import { formatLabTestsFromEvaluation } from "@/lib/medical-records/lab-tests-from-evaluation";
import { upsertMedicalRecordForVisit } from "@/lib/medical-records/upsert-by-visit";
import { regenerateVisitReportPdfAttachment } from "@/app/(portal)/visits/visit-report-actions";

export { createVisitFromAppointment } from "./create-visit-from-appointment";
export { ensurePrescriptionForVisit } from "./ensure-prescription";

async function syncMedicalRecordFromVisit(
  supabase: ReturnType<typeof createClient>,
  clinic_id: string,
  visitId: string,
  labTestsOverride?: string | null,
) {
  const { data: visit, error: visitErr } = await supabase
    .from("visits")
    .select("branch_id, pet_id, diagnosis, symptoms, treatment_plan")
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .single();
  if (visitErr) throw new Error(visitErr.message);

  let labTests = labTestsOverride;
  if (labTests === undefined) {
    const { data: evaluation } = await supabase
      .from("visit_clinical_evaluations")
      .select("tests_referred, tests_other")
      .eq("visit_id", visitId)
      .maybeSingle();
    labTests = formatLabTestsFromEvaluation(
      (evaluation?.tests_referred as string[] | null) ?? null,
      (evaluation?.tests_other as string | null) ?? null,
    );
  }

  const notesCombined =
    [visit.symptoms, visit.treatment_plan].filter(Boolean).join("\n\n") || null;

  const row = {
    clinic_id,
    branch_id: visit.branch_id as string,
    pet_id: visit.pet_id as string,
    visit_id: visitId,
    diagnosis: (visit.diagnosis as string | null) ?? null,
    notes: notesCombined,
  };

  if (labTests) {
    await upsertMedicalRecordForVisit(supabase, { ...row, lab_tests: labTests });
  } else {
    await upsertMedicalRecordForVisit(supabase, row);
  }
}

async function persistVisitConsultation(
  supabase: ReturnType<typeof createClient>,
  clinic_id: string,
  formData: FormData,
) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  const symptoms = String(formData.get("symptoms") ?? "").trim();
  const diagnosis = String(formData.get("diagnosis") ?? "").trim();
  const treatmentPlan = String(formData.get("treatment_plan") ?? "").trim();
  const followUpAt = String(formData.get("follow_up_at") ?? "").trim();
  const completeRaw = String(formData.get("complete_visit") ?? "")
    .trim()
    .toLowerCase();
  const completeVisit = completeRaw === "on" || completeRaw === "true" || completeRaw === "1";

  if (!visitId) throw new Error("Visit id is required.");

  const nowIso = new Date().toISOString();
  const updates: {
    symptoms?: string | null;
    diagnosis?: string | null;
    treatment_plan?: string | null;
    follow_up_at?: string | null;
    completed_at?: string | null;
  } = {
    symptoms: symptoms || null,
    diagnosis: diagnosis || null,
    treatment_plan: treatmentPlan || null,
    follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : null,
  };

  if (completeVisit) {
    updates.completed_at = nowIso;
  }

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .update(updates)
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .select("appointment_id, branch_id, pet_id")
    .single();

  if (visitError) throw new Error(visitError.message);

  if (completeVisit && visit.appointment_id) {
    const { error: apptUpdateError } = await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("id", visit.appointment_id)
      .eq("clinic_id", clinic_id);
    if (apptUpdateError) throw new Error(apptUpdateError.message);
  }

  await syncMedicalRecordFromVisit(supabase, clinic_id, visitId);
}

async function persistVisitClinicalEvaluation(
  supabase: ReturnType<typeof createClient>,
  clinic_id: string,
  formData: FormData,
) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  if (!visitId) throw new Error("Visit id is required.");

  const { data: visit, error: vErr } = await supabase
    .from("visits")
    .select("id, clinic_id, appointment_id")
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .single();

  if (vErr) throw new Error(vErr.message);

  const referred: string[] = [];
  for (const code of REFERRED_TEST_OPTIONS) {
    if (String(formData.get(testFieldName(code)) ?? "") === "on") {
      referred.push(code);
    }
  }

  const row = {
    clinic_id: visit.clinic_id,
    visit_id: visit.id,
    appointment_id: visit.appointment_id,
    species_class: String(formData.get("species_class") ?? "").trim() || null,
    patient_gender: String(formData.get("patient_gender") ?? "").trim() || null,
    patient_age: String(formData.get("patient_age") ?? "").trim() || null,
    patient_name: String(formData.get("patient_name") ?? "").trim() || null,
    owner_name: String(formData.get("owner_name") ?? "").trim() || null,
    patient_complaint: String(formData.get("patient_complaint") ?? "").trim() || null,
    cc_hp: String(formData.get("cc_hp") ?? "").trim() || null,
    section_deworming: String(formData.get("section_deworming") ?? "").trim() || null,
    section_vaccination: String(formData.get("section_vaccination") ?? "").trim() || null,
    param_rt: String(formData.get("param_rt") ?? "").trim() || null,
    param_rr: String(formData.get("param_rr") ?? "").trim() || null,
    param_hr: String(formData.get("param_hr") ?? "").trim() || null,
    param_crt: String(formData.get("param_crt") ?? "").trim() || null,
    param_allergic: String(formData.get("param_allergic") ?? "").trim() || null,
    param_bw: String(formData.get("param_bw") ?? "").trim() || null,
    tests_referred: referred,
    tests_other: String(formData.get("tests_other") ?? "").trim() || null,
    physical_examination: String(formData.get("physical_examination") ?? "").trim() || null,
  };

  const { error: upErr } = await supabase.from("visit_clinical_evaluations").upsert(row, {
    onConflict: "visit_id",
  });

  if (upErr) throw new Error(upErr.message);

  const labTests = formatLabTestsFromEvaluation(referred, row.tests_other);
  await syncMedicalRecordFromVisit(supabase, clinic_id, visitId, labTests);
}

/** If the visit row never got a doctor_id but the appointment has one, copy it for display, Rx, and reporting. */
async function syncVisitDoctorFromAppointment(
  supabase: ReturnType<typeof createClient>,
  clinic_id: string,
  visitId: string,
) {
  const { data: row } = await supabase
    .from("visits")
    .select("doctor_id, appointment_id")
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (!row?.appointment_id || row.doctor_id) return;

  const { data: appt } = await supabase
    .from("appointments")
    .select("doctor_id")
    .eq("id", row.appointment_id)
    .eq("clinic_id", clinic_id)
    .maybeSingle();

  if (!appt?.doctor_id) return;

  const { error } = await supabase
    .from("visits")
    .update({ doctor_id: appt.doctor_id })
    .eq("id", visitId)
    .eq("clinic_id", clinic_id);

  if (error) throw new Error(error.message);

  await supabase
    .from("prescriptions")
    .update({ doctor_id: appt.doctor_id })
    .eq("visit_id", visitId)
    .eq("clinic_id", clinic_id)
    .is("doctor_id", null);
}

function redirectAfterVisitSave(visitId: string, formData: FormData) {
  const embed = String(formData.get("embed") ?? "").trim();
  const q = new URLSearchParams();
  q.set("saved", "1");
  if (embed === "1") q.set("embed", "1");
  redirect(`/visits/${visitId}?${q.toString()}`);
}

export async function saveVisitConsultation(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  if (!visitId) throw new Error("Visit id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  await persistVisitConsultation(supabase, clinic_id, formData);
  await syncVisitDoctorFromAppointment(supabase, clinic_id, visitId);

  revalidatePath("/appointments");
  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/medical-records");
  redirectAfterVisitSave(visitId, formData);
}

export async function saveVisitClinicalEvaluation(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  if (!visitId) throw new Error("Visit id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  await persistVisitClinicalEvaluation(supabase, clinic_id, formData);
  await syncVisitDoctorFromAppointment(supabase, clinic_id, visitId);

  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/medical-records");
  redirectAfterVisitSave(visitId, formData);
}

/** Persists clinical evaluation and SOAP in one submit so users do not lose half-filled sections. */
export async function saveVisitRecord(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  if (!visitId) throw new Error("Visit id is required.");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  await persistVisitClinicalEvaluation(supabase, clinic_id, formData);
  await persistVisitConsultation(supabase, clinic_id, formData);
  await syncVisitDoctorFromAppointment(supabase, clinic_id, visitId);

  try {
    await regenerateVisitReportPdfAttachment(visitId);
  } catch (e) {
    console.error("[saveVisitRecord] visit report PDF", e);
  }

  revalidatePath("/appointments");
  revalidatePath(`/visits/${visitId}`);
  revalidatePath("/medical-records");
  redirectAfterVisitSave(visitId, formData);
}

export async function uploadVisitAttachment(formData: FormData) {
  const visitId = String(formData.get("visit_id") ?? "").trim();
  const file = formData.get("file");
  const petId = String(formData.get("pet_id") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "").trim();

  if (!visitId || !petId || !branchId) {
    throw new Error("Visit, pet, and branch are required for upload.");
  }
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please select a file to upload.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${clinic_id}/${visitId}/${Date.now()}-${safeName}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("medical-files")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  const { error: insertError } = await supabase.from("file_attachments").insert({
    clinic_id,
    branch_id: branchId,
    pet_id: petId,
    visit_id: visitId,
    storage_bucket: "medical-files",
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || null,
    uploaded_by: user?.id ?? null,
  });
  if (insertError) throw new Error(insertError.message);

  // Do not revalidatePath — that remounts the visit page and wipes unsaved structured-record fields.
  return { ok: true as const, visitId };
}

export async function deleteVisitAttachment(formData: FormData) {
  const attachmentId = String(formData.get("attachment_id") ?? "").trim();
  const visitId = String(formData.get("visit_id") ?? "").trim();
  if (!attachmentId || !visitId) {
    throw new Error("Attachment and visit are required.");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: row, error: fetchError } = await supabase
    .from("file_attachments")
    .select("id, storage_bucket, storage_path, visit_id, clinic_id")
    .eq("id", attachmentId)
    .eq("clinic_id", clinic_id)
    .eq("visit_id", visitId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Attachment not found.");

  const bucket = (row.storage_bucket as string | null) || "medical-files";
  const path = row.storage_path as string;
  if (path) {
    const { error: storageError } = await supabase.storage.from(bucket).remove([path]);
    if (storageError) throw new Error(storageError.message);
  }

  const { error: deleteError } = await supabase
    .from("file_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("clinic_id", clinic_id)
    .eq("visit_id", visitId);

  if (deleteError) throw new Error(deleteError.message);

  // Do not revalidatePath — keep in-progress visit form data intact.
  return { ok: true as const, visitId };
}
