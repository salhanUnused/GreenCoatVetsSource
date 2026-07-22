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

export type PrescriptionPdfResult =
  | { status: "ok"; url: string | null }
  | { status: "no_data"; message: string }
  | { status: "error"; message: string };

/**
 * Builds a prescription PDF from saved prescription lines and/or linked visit clinical notes.
 * Uploads to storage and sets prescriptions.pdf_url.
 */
export async function generatePrescriptionPdf(
  clinicId: string,
  prescriptionId: string,
): Promise<PrescriptionPdfResult> {
  try {
    const { data: rx, error: rxErr } = await supabase
      .from("prescriptions")
      .select("id, notes, visit_id, pet_id, doctor_id, pdf_url, issued_at")
      .eq("id", prescriptionId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (rxErr || !rx) return { status: "error", message: rxErr?.message ?? "Prescription not found." };

    const [{ data: items }, { data: visit }, { data: pet }, { data: doctor }, { data: clinic }] = await Promise.all([
      supabase
        .from("prescription_items")
        .select("medicine_name, dosage, frequency, duration, instructions")
        .eq("prescription_id", prescriptionId),
      rx.visit_id
        ? supabase
            .from("visits")
            .select("symptoms, diagnosis, treatment_plan, appointment_id")
            .eq("id", rx.visit_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      rx.pet_id
        ? supabase.from("pets").select("name, breed, owners(full_name, phone)").eq("id", rx.pet_id).maybeSingle()
        : Promise.resolve({ data: null }),
      rx.doctor_id
        ? supabase.from("staff_profiles").select("full_name").eq("id", rx.doctor_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("clinics").select("name, image_url, timezone").eq("id", clinicId).maybeSingle(),
    ]);

    const lines =
      (items as Array<{
        medicine_name: string;
        dosage: string | null;
        frequency: string | null;
        duration: string | null;
        instructions: string | null;
      }> | null) ?? [];

    const symptoms = (visit as { symptoms?: string | null } | null)?.symptoms?.trim() ?? "";
    const diagnosis = (visit as { diagnosis?: string | null } | null)?.diagnosis?.trim() ?? "";
    const treatment = (visit as { treatment_plan?: string | null } | null)?.treatment_plan?.trim() ?? "";
    const notes = (rx.notes as string | null)?.trim() ?? "";

    if (!lines.length && !symptoms && !diagnosis && !treatment && !notes) {
      return {
        status: "no_data",
        message: "No prescription lines or visit notes saved yet. Complete the consult first.",
      };
    }

    const petRaw = pet as
      | {
          name?: string;
          breed?: string | null;
          owners?: { full_name?: string | null; phone?: string | null } | Array<{ full_name?: string | null; phone?: string | null }> | null;
        }
      | null;
    const ownerRaw = petRaw?.owners;
    const owner = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw;

    const clinicName = (clinic as { name?: string } | null)?.name ?? "Clinic";
    const clinicLogoUrl = (clinic as { image_url?: string | null } | null)?.image_url ?? null;
    const clinicTimezone = (clinic as { timezone?: string | null } | null)?.timezone ?? null;
    const doctorName = (doctor as { full_name?: string } | null)?.full_name ?? "Doctor";
    const issuedLabel = formatClinicDateTime((rx.issued_at as string) ?? new Date().toISOString(), clinicTimezone);
    const petName = petRaw?.name ?? "Pet";
    const petBreed = petRaw?.breed ?? "-";
    const ownerName = owner?.full_name ?? "Owner";
    const ownerPhone = owner?.phone ?? "";

    const medicineHtml = lines.length
      ? lines
          .map(
            (l, i) =>
              `<tr><td>${i + 1}</td><td>${escHtml(l.medicine_name)}</td><td>${escHtml(l.dosage ?? "-")}</td><td>${escHtml(
                l.frequency ?? "-",
              )}</td><td>${escHtml(l.duration ?? "-")}</td><td>${escHtml(l.instructions ?? "-")}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="6">No medicine lines — clinical notes below.</td></tr>`;

    const logoHtml = clinicLogoUrl
      ? `<img src="${escHtml(clinicLogoUrl)}" style="width:56px;height:56px;object-fit:contain;border-radius:8px;border:1px solid #c5d7d1;background:#fff" />`
      : "";

    const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;padding:0;margin:0;color:#172023;background:#f5f7f8">
      <div style="background:#0e6e61;color:#fff;padding:18px 22px;display:flex;align-items:center;gap:12px">
        ${logoHtml}
        <div>
          <div style="font-size:20px;font-weight:800">${escHtml(clinicName)}</div>
          <div style="font-size:12px;opacity:0.92">PRESCRIPTION</div>
        </div>
      </div>
      <div style="padding:20px 22px">
        <p><b>Issued:</b> ${escHtml(issuedLabel)}</p>
        <p><b>Doctor:</b> ${escHtml(doctorName)}</p>
        <p><b>Pet:</b> ${escHtml(petName)} (${escHtml(petBreed)})</p>
        <p><b>Owner:</b> ${escHtml(ownerName)} ${ownerPhone ? `(${escHtml(ownerPhone)})` : ""}</p>
        <p><b>Symptoms:</b> ${escHtml(symptoms || "-")}</p>
        <p><b>Diagnosis:</b> ${escHtml(diagnosis || "-")}</p>
        <p><b>Treatment:</b> ${escHtml(treatment || "-")}</p>
        <h3 style="margin:18px 0 8px;color:#0e6e61">Medicines</h3>
        <table width="100%" cellspacing="0" cellpadding="6" style="border-collapse:collapse;background:#fff;border:1px solid #d2dcda">
          <thead><tr style="background:#e7f1ee"><th>#</th><th>Name</th><th>Dosage</th><th>Freq</th><th>Duration</th><th>Instructions</th></tr></thead>
          <tbody>${medicineHtml}</tbody>
        </table>
        <p style="margin-top:16px"><b>Notes:</b> ${escHtml(notes || "-")}</p>
      </div>
    </body></html>`;

    const pdf = await Print.printToFileAsync({ html });
    const base64 = await FileSystem.readAsStringAsync(pdf.uri, { encoding: FileSystem.EncodingType.Base64 });
    const bytes = bytesFromBase64(base64);
    const path = `${clinicId}/prescriptions/${prescriptionId}.pdf`;
    const { error: upErr } = await supabase.storage.from("medical-files").upload(path, bytes.buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) return { status: "error", message: upErr.message };

    await supabase.from("prescriptions").update({ pdf_url: path }).eq("id", prescriptionId).eq("clinic_id", clinicId);
    const { data: signed } = await supabase.storage.from("medical-files").createSignedUrl(path, 60 * 30);
    return { status: "ok", url: signed?.signedUrl ?? null };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Could not generate PDF." };
  }
}
