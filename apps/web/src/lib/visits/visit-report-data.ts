import type { SupabaseClient } from "@supabase/supabase-js";
import { formatClinicDateTime, formatSpeciesLabel } from "@saasclinics/lib";

function ownerName(o: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
} | null): string {
  if (!o) return "—";
  const f = o.first_name?.trim();
  const l = o.last_name?.trim();
  if (f && l) return `${f} ${l}`;
  return o.full_name?.trim() || "—";
}

export type VisitReportPayload = {
  clinicName: string;
  branchName: string;
  doctorName: string;
  petName: string;
  petSpecies: string;
  ownerName: string;
  visitWhen: string;
  completedWhen: string;
  symptoms: string;
  diagnosis: string;
  treatmentPlan: string;
  followUp: string;
  patientComplaint: string;
  ccHp: string;
  physicalExam: string;
  deworming: string;
  vaccination: string;
  paramsLine: string;
  testsReferred: string;
  testsOther: string;
  rxLines: Array<{
    medicine_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>;
};

export async function loadVisitReportPayload(supabase: SupabaseClient, visitId: string): Promise<VisitReportPayload> {
  const { data: visit, error: vErr } = await supabase
    .from("visits")
    .select(
      "symptoms, diagnosis, treatment_plan, follow_up_at, started_at, completed_at, created_at, clinic_id, doctor_id, appointment_id, pets(name, species, breed), owners(first_name, last_name, full_name), branches(name), staff_profiles(full_name), appointments(doctor_id)"
    )
    .eq("id", visitId)
    .single();

  if (vErr || !visit) throw new Error(vErr?.message ?? "Visit not found.");

  const { data: clinic } = await supabase.from("clinics").select("name, timezone").eq("id", visit.clinic_id as string).maybeSingle();
  const clinicTz = clinic?.timezone;

  const { data: evaluation } = await supabase.from("visit_clinical_evaluations").select("*").eq("visit_id", visitId).maybeSingle();

  /** One canonical Rx per visit (matches ensurePrescriptionForVisit). Multiple legacy rows would duplicate every line in the PDF. */
  const { data: prescRow, error: prescErr } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("visit_id", visitId)
    .eq("clinic_id", visit.clinic_id as string)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prescErr) throw new Error(prescErr.message);

  const petRaw = visit.pets as { name?: string; species?: string; breed?: string } | { name?: string }[] | null;
  const pet = (Array.isArray(petRaw) ? petRaw[0] ?? null : petRaw) as {
    name?: string;
    species?: string;
    breed?: string;
  } | null;
  const brRaw = visit.branches as { name?: string } | { name?: string }[] | null;
  const br = Array.isArray(brRaw) ? brRaw[0] ?? null : brRaw;
  const docRaw = visit.staff_profiles as { full_name?: string } | { full_name?: string }[] | null;
  const doc = Array.isArray(docRaw) ? docRaw[0] ?? null : docRaw;
  const apptForDoctor = visit.appointments as { doctor_id?: string | null } | { doctor_id?: string | null }[] | null;
  const apptD = Array.isArray(apptForDoctor) ? apptForDoctor[0] ?? null : apptForDoctor;
  const visitDoctorId = visit.doctor_id as string | null | undefined;
  const resolvedDoctorId = visitDoctorId ?? apptD?.doctor_id ?? undefined;

  let doctorName = String(doc?.full_name ?? "").trim();
  if (!doctorName && resolvedDoctorId) {
    const { data: sp } = await supabase.from("staff_profiles").select("full_name").eq("id", resolvedDoctorId).maybeSingle();
    doctorName = String(sp?.full_name ?? "").trim();
  }
  const owRaw = visit.owners as { first_name?: string; last_name?: string; full_name?: string } | { first_name?: string }[] | null;
  const ow = Array.isArray(owRaw) ? owRaw[0] ?? null : owRaw;

  const ev = evaluation as Record<string, unknown> | null;
  const params: string[] = [];
  const p = (k: string) => String(ev?.[k] ?? "").trim();
  if (p("param_rt")) params.push(`RT ${p("param_rt")}`);
  if (p("param_rr")) params.push(`RR ${p("param_rr")}`);
  if (p("param_hr")) params.push(`HR ${p("param_hr")}`);
  if (p("param_crt")) params.push(`CRT ${p("param_crt")}`);
  if (p("param_allergic")) params.push(`Allergic ${p("param_allergic")}`);
  if (p("param_bw")) params.push(`B/W ${p("param_bw")}`);

  const testsRef = ev?.tests_referred;
  const referred =
    Array.isArray(testsRef) && testsRef.length
      ? (testsRef as string[]).filter(Boolean).join(", ")
      : "";

  const rxLines: VisitReportPayload["rxLines"] = [];
  if (prescRow?.id) {
    const { data: itemRows, error: itemsErr } = await supabase
      .from("prescription_items")
      .select("medicine_name, dosage, frequency, duration, instructions")
      .eq("prescription_id", prescRow.id as string)
      .order("created_at", { ascending: true });

    if (itemsErr) throw new Error(itemsErr.message);
    const mapped = (itemRows ?? []).map((row) => ({
      medicine_name: String(row.medicine_name ?? ""),
      dosage: String(row.dosage ?? ""),
      frequency: String(row.frequency ?? ""),
      duration: String(row.duration ?? ""),
      instructions: String(row.instructions ?? ""),
    }));
    const seen = new Set<string>();
    for (const row of mapped) {
      const key = [row.medicine_name, row.dosage, row.frequency, row.duration, row.instructions]
        .map((s) => s.trim().toLowerCase())
        .join("\u0001");
      if (seen.has(key)) continue;
      seen.add(key);
      rxLines.push(row);
    }
  }

  const t0 = visit.started_at ?? visit.created_at ?? visit.completed_at;
  const visitWhen = t0 ? formatClinicDateTime(t0 as string, clinicTz) : "—";
  const completedWhen = visit.completed_at ? formatClinicDateTime(visit.completed_at as string, clinicTz) : "—";
  const fu = visit.follow_up_at ? formatClinicDateTime(visit.follow_up_at as string, clinicTz) : "";

  return {
    clinicName: String(clinic?.name ?? "Clinic"),
    branchName: String(br?.name ?? "—"),
    doctorName: doctorName || "—",
    petName: String(pet?.name ?? "—"),
    petSpecies: [pet?.species ? formatSpeciesLabel(pet.species) : "", pet?.breed].filter(Boolean).join(" · ") || "—",
    ownerName: ownerName(ow),
    visitWhen,
    completedWhen,
    symptoms: String(visit.symptoms ?? "").trim(),
    diagnosis: String(visit.diagnosis ?? "").trim(),
    treatmentPlan: String(visit.treatment_plan ?? "").trim(),
    followUp: fu,
    patientComplaint: p("patient_complaint"),
    ccHp: p("cc_hp"),
    physicalExam: p("physical_examination"),
    deworming: p("section_deworming"),
    vaccination: p("section_vaccination"),
    paramsLine: params.join(" · "),
    testsReferred: referred,
    testsOther: p("tests_other"),
    rxLines,
  };
}
