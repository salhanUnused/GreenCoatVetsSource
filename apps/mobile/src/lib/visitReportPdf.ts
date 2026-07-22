import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import { formatClinicDateTime } from "@saasclinics/lib";
import { supabase } from "./supabase";

function bytesFromBase64(base64: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function escHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type RxItem = {
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
};

export type VisitPdfResult =
  | { status: "no_visit" }
  | { status: "no_data" }
  | { status: "error"; message: string }
  | { status: "ok"; url: string | null };

/**
 * Generates a branded visit-summary PDF for an appointment, but only when the
 * appointment already has clinical data saved from the app (symptoms / diagnosis /
 * treatment plan / a prescription). Uploads it to storage and records the file so
 * it can be shared with the owner. Returns a short-lived signed URL.
 */
export async function generateAppointmentVisitPdf(
  clinicId: string,
  appointmentId: string,
): Promise<VisitPdfResult> {
  try {
    const { data: visit } = await supabase
      .from("visits")
      .select("id, symptoms, diagnosis, treatment_plan, follow_up_at, branch_id, pet_id, started_at, created_at")
      .eq("appointment_id", appointmentId)
      .eq("clinic_id", clinicId)
      .limit(1)
      .maybeSingle();

    if (!visit?.id) return { status: "no_visit" };

    const visitId = visit.id as string;

    const { data: appt } = await supabase
      .from("appointments")
      .select(
        "branch_id, pet_id, doctor_id, owners(full_name, phone), pets(name, breed)",
      )
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    const branchId = (visit.branch_id as string | null) ?? (appt?.branch_id as string | null) ?? null;
    const petId = (visit.pet_id as string | null) ?? (appt?.pet_id as string | null) ?? null;

    const { data: rxRows } = await supabase
      .from("prescriptions")
      .select("id, notes")
      .eq("clinic_id", clinicId)
      .eq("visit_id", visitId)
      .order("issued_at", { ascending: false });

    const prescriptionIds = ((rxRows as Array<{ id: string }> | null) ?? []).map((p) => p.id);
    let rxItems: RxItem[] = [];
    if (prescriptionIds.length) {
      const { data: itemRows } = await supabase
        .from("prescription_items")
        .select("medicine_name, dosage, frequency, duration, instructions")
        .in("prescription_id", prescriptionIds);
      rxItems = (itemRows as RxItem[] | null) ?? [];
    }

    const symptoms = (visit.symptoms as string | null)?.trim() ?? "";
    const diagnosis = (visit.diagnosis as string | null)?.trim() ?? "";
    const treatmentPlan = (visit.treatment_plan as string | null)?.trim() ?? "";

    const hasData = Boolean(symptoms || diagnosis || treatmentPlan || rxItems.length);
    if (!hasData) return { status: "no_data" };

    const [{ data: clinicRow }, { data: doctorRow }] = await Promise.all([
      supabase.from("clinics").select("name, image_url, timezone").eq("id", clinicId).maybeSingle(),
      appt?.doctor_id
        ? supabase.from("staff_profiles").select("full_name").eq("id", appt.doctor_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const clinicName = (clinicRow as { name?: string } | null)?.name ?? "Clinic";
    const clinicLogoUrl = (clinicRow as { image_url?: string | null } | null)?.image_url ?? null;
    const clinicTimezone = (clinicRow as { timezone?: string | null } | null)?.timezone ?? null;
    const doctorName = (doctorRow as { full_name?: string } | null)?.full_name ?? "Doctor";
    const visitWhen = formatClinicDateTime(
      (visit.started_at as string | null) ?? (visit.created_at as string | null),
      clinicTimezone,
    );

    const petRaw = appt?.pets as { name?: string; breed?: string | null } | Array<{ name?: string; breed?: string | null }> | null | undefined;
    const pet = Array.isArray(petRaw) ? petRaw[0] : petRaw;
    const ownerRaw = appt?.owners as { full_name?: string | null; phone?: string | null } | Array<{ full_name?: string | null; phone?: string | null }> | null | undefined;
    const owner = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw;

    const petName = pet?.name ?? "Pet";
    const petBreed = pet?.breed ?? "-";
    const ownerName = owner?.full_name ?? "Owner";
    const ownerPhone = owner?.phone ?? "";

    const rxHtml = rxItems.length
      ? `<h3 style="margin:18px 0 8px;color:#0e6e61">Prescription</h3>
         <table width="100%" cellspacing="0" cellpadding="6" style="border-collapse:collapse;background:#fff;border:1px solid #d2dcda">
           <thead><tr style="background:#e7f1ee"><th>#</th><th>Medicine</th><th>Dosage</th><th>Freq</th><th>Duration</th><th>Instructions</th></tr></thead>
           <tbody>${rxItems
             .map(
               (it, i) =>
                 `<tr><td>${i + 1}</td><td>${escHtml(it.medicine_name)}</td><td>${escHtml(it.dosage ?? "-")}</td><td>${escHtml(
                   it.frequency ?? "-",
                 )}</td><td>${escHtml(it.duration ?? "-")}</td><td>${escHtml(it.instructions ?? "-")}</td></tr>`,
             )
             .join("")}</tbody>
         </table>`
      : "";

    const logoHtml = clinicLogoUrl
      ? `<img src="${escHtml(clinicLogoUrl)}" style="width:56px;height:56px;object-fit:contain;border-radius:8px;border:1px solid #c5d7d1;background:#fff" />`
      : "";

    const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;padding:0;margin:0;color:#172023;background:#f5f7f8">
      <div style="background:#0e6e61;color:#fff;padding:18px 22px;display:flex;align-items:center;gap:12px">
        ${logoHtml}
        <div>
          <div style="font-size:20px;font-weight:800;line-height:1.2">${escHtml(clinicName)}</div>
          <div style="font-size:12px;opacity:0.92;letter-spacing:0.3px">VISIT REPORT</div>
        </div>
      </div>
      <div style="padding:20px 22px">
        <p style="margin:0 0 8px"><b>Visit date:</b> ${escHtml(visitWhen)}</p>
        <p style="margin:0 0 8px"><b>Doctor:</b> ${escHtml(doctorName)}</p>
        <p style="margin:0 0 8px"><b>Patient:</b> ${escHtml(petName)} (${escHtml(petBreed)})</p>
        <p style="margin:0 0 14px"><b>Owner:</b> ${escHtml(ownerName)} ${ownerPhone ? `(${escHtml(ownerPhone)})` : ""}</p>
        <div style="border:1px solid #d2dcda;background:#fff;border-radius:8px;padding:12px 14px;margin-bottom:10px">
          <div style="font-size:12px;color:#3b4a4d;margin-bottom:4px">Symptoms / Complaint</div>
          <div style="font-size:14px">${escHtml(symptoms || "-")}</div>
        </div>
        <div style="border:1px solid #d2dcda;background:#fff;border-radius:8px;padding:12px 14px;margin-bottom:10px">
          <div style="font-size:12px;color:#3b4a4d;margin-bottom:4px">Diagnosis</div>
          <div style="font-size:14px">${escHtml(diagnosis || "-")}</div>
        </div>
        <div style="border:1px solid #d2dcda;background:#fff;border-radius:8px;padding:12px 14px;margin-bottom:10px">
          <div style="font-size:12px;color:#3b4a4d;margin-bottom:4px">Treatment Plan</div>
          <div style="font-size:14px">${escHtml(treatmentPlan || "-")}</div>
        </div>
        ${rxHtml}
      </div>
    </body></html>`;

    const pdf = await Print.printToFileAsync({ html });
    const base64 = await FileSystem.readAsStringAsync(pdf.uri, { encoding: FileSystem.EncodingType.Base64 });
    const bytes = bytesFromBase64(base64);
    const path = `${clinicId}/visit-summaries/${visitId}.pdf`;
    const { error: upErr } = await supabase.storage.from("medical-files").upload(path, bytes.buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) return { status: "error", message: upErr.message };

    if (branchId && petId) {
      await supabase.from("file_attachments").insert({
        clinic_id: clinicId,
        branch_id: branchId,
        pet_id: petId,
        visit_id: visitId,
        storage_bucket: "medical-files",
        storage_path: path,
        file_name: `visit-report-${visitId}.pdf`,
        mime_type: "application/pdf",
      });
    }

    await supabase
      .from("visits")
      .update({
        visit_report_pdf_path: path,
        visit_report_pdf_generated_at: new Date().toISOString(),
      })
      .eq("id", visitId)
      .eq("clinic_id", clinicId);

    const { data: signed } = await supabase.storage.from("medical-files").createSignedUrl(path, 60 * 30);
    return { status: "ok", url: signed?.signedUrl ?? null };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Could not generate PDF." };
  }
}
