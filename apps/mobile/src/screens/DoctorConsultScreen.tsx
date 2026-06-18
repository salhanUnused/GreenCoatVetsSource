import { useCallback, useEffect, useMemo, useState } from "react";
import { RouteProp, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";
import { AppointmentStatusPicker } from "../components/AppointmentStatusPicker";
import { fetchVisitAttachments, openVisitAttachment, type VisitAttachmentRow } from "../lib/visitAttachments";
import { handleDateTimePickerChange } from "../lib/dateTimePickerBridge";
import { supabase } from "../lib/supabase";
import { DoctorStackParamList } from "../navigation/types";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";
import { PetAvatar } from "../components/PetAvatar";

type RxLine = { medicine_name: string; dosage: string; frequency: string; duration: string; instructions: string };
type PreviousVisit = { id: string; started_at: string | null; diagnosis: string | null; treatment_plan: string | null; follow_up_at: string | null };
type PreviousRx = {
  id: string;
  issued_at: string;
  notes: string | null;
  items: Array<{ medicine_name: string; dosage: string; frequency: string | null; duration: string | null; instructions: string | null }>;
};

type PetQuick = {
  id: string;
  name: string;
  breed: string | null;
  age_months: number | null;
  date_of_birth: string | null;
  allergies: string | null;
  chronic_diseases: string | null;
  photo_url: string | null;
};

const SUGGESTED_MEDS = ["Amoxicillin", "Carprofen", "Metronidazole", "Prednisolone", "Maropitant"];

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

function calcAgeLabel(p: PetQuick | null) {
  if (!p) return "—";
  if (p.age_months && p.age_months > 0) {
    const y = Math.floor(p.age_months / 12);
    const m = p.age_months % 12;
    if (!y) return `${m}m`;
    if (!m) return `${y}y`;
    return `${y}y ${m}m`;
  }
  if (p.date_of_birth) {
    const birth = new Date(p.date_of_birth).getTime();
    if (Number.isFinite(birth)) {
      const months = Math.max(0, Math.floor((Date.now() - birth) / (1000 * 60 * 60 * 24 * 30)));
      const y = Math.floor(months / 12);
      const m = months % 12;
      if (!y) return `${m}m`;
      if (!m) return `${y}y`;
      return `${y}y ${m}m`;
    }
  }
  return "—";
}

export function DoctorConsultScreen({
  clinicId,
  doctorStaffId,
  ensureVisitForAppointment,
  onUploadVisitImage,
  onUploadDocument,
  onStatusChange,
  medicineNames,
  onRefresh,
}: {
  clinicId: string;
  doctorStaffId: string | null;
  ensureVisitForAppointment: (appointmentId: string, complete?: boolean, checkIn?: boolean) => Promise<string | null>;
  onUploadVisitImage: (appointmentId: string, uri: string, mimeType?: string, base64?: string | null) => Promise<void>;
  onUploadDocument: (appointmentId: string) => Promise<void>;
  onStatusChange: (appointmentId: string, status: string) => Promise<void>;
  medicineNames: string[];
  onRefresh: () => void;
}) {
  const route = useRoute<RouteProp<DoctorStackParamList, "Consult">>();
  const appointmentId = route.params?.appointmentId;

  const [loading, setLoading] = useState(true);
  /** Staff profile id used on prescriptions; may fall back to appointment’s assigned doctor for admins. */
  const [prescriberStaffId, setPrescriberStaffId] = useState<string | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [followUp, setFollowUp] = useState<Date | null>(null);
  const [showFollowPicker, setShowFollowPicker] = useState(false);
  const [petQuick, setPetQuick] = useState<PetQuick | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [clinicName, setClinicName] = useState("Clinic");
  const [clinicLogoUrl, setClinicLogoUrl] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState("Doctor");
  const [previousVisits, setPreviousVisits] = useState<PreviousVisit[]>([]);
  const [previousDiagnosis, setPreviousDiagnosis] = useState<string[]>([]);

  const [rxLines, setRxLines] = useState<RxLine[]>([
    { medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "" },
  ]);
  const [rxNotes, setRxNotes] = useState("");
  const [previousRx, setPreviousRx] = useState<PreviousRx[]>([]);
  const [medQuery, setMedQuery] = useState("");
  const [lastDownloadUrl, setLastDownloadUrl] = useState<string | null>(null);
  const [lastVisitSummaryUrl, setLastVisitSummaryUrl] = useState<string | null>(null);
  const [appointmentType, setAppointmentType] = useState<string | null>(null);
  const [vaccineName, setVaccineName] = useState("");
  const [vaccineNextDue, setVaccineNextDue] = useState<Date | null>(null);
  const [showVaccineDuePicker, setShowVaccineDuePicker] = useState(false);
  const [appointmentStatus, setAppointmentStatus] = useState("scheduled");
  const [attachments, setAttachments] = useState<VisitAttachmentRow[]>([]);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const medsFiltered = useMemo(() => {
    const q = medQuery.trim().toLowerCase();
    const all = Array.from(new Set([...SUGGESTED_MEDS, ...medicineNames]));
    if (!q) return all.slice(0, 18);
    return all.filter((m) => m.toLowerCase().includes(q)).slice(0, 18);
  }, [medQuery, medicineNames]);

  const load = useCallback(async () => {
    if (!appointmentId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const vid = await ensureVisitForAppointment(appointmentId, false, true);
    setVisitId(vid);

    if (vid) {
      try {
        const rows = await fetchVisitAttachments(vid);
        setAttachments(rows);
      } catch {
        setAttachments([]);
      }
      const { data: visit } = await supabase
        .from("visits")
        .select("symptoms, diagnosis, treatment_plan, follow_up_at")
        .eq("id", vid)
        .maybeSingle();
      if (visit) {
        setSymptoms(visit.symptoms ?? "");
        setDiagnosis(visit.diagnosis ?? "");
        setTreatmentPlan(visit.treatment_plan ?? "");
        setFollowUp(visit.follow_up_at ? new Date(visit.follow_up_at) : null);
      }
    }

    const { data: appt } = await supabase
      .from("appointments")
      .select(
        "pet_id, doctor_id, appointment_type, status, owners(full_name, phone), pets(id, name, breed, age_months, date_of_birth, allergies, chronic_diseases, photo_url)"
      )
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    const apptDoctorId = (appt as { doctor_id?: string | null } | null)?.doctor_id ?? null;
    const effectivePrescriber = doctorStaffId ?? apptDoctorId;
    setPrescriberStaffId(effectivePrescriber);

    const [{ data: clinicRow }, { data: doctorRow }] = await Promise.all([
      supabase.from("clinics").select("name, image_url").eq("id", clinicId).maybeSingle(),
      effectivePrescriber
        ? supabase.from("staff_profiles").select("full_name").eq("id", effectivePrescriber).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const petRaw = appt?.pets as PetQuick | PetQuick[] | null | undefined;
    const pet = Array.isArray(petRaw) ? petRaw[0] : petRaw;
    const ownerRaw = appt?.owners as { full_name?: string | null; phone?: string | null } | { full_name?: string | null; phone?: string | null }[] | null | undefined;
    const owner = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw;

    setPetQuick(pet ?? null);
    setAppointmentType((appt as { appointment_type?: string } | null)?.appointment_type ?? null);
    setAppointmentStatus((appt as { status?: string } | null)?.status ?? "scheduled");
    setOwnerName(owner?.full_name ?? "Owner");
    setOwnerPhone(owner?.phone ?? "");
    setClinicName((clinicRow as { name?: string } | null)?.name ?? "Clinic");
    setClinicLogoUrl((clinicRow as { image_url?: string | null } | null)?.image_url ?? null);
    setDoctorName((doctorRow as { full_name?: string } | null)?.full_name ?? "Doctor");

    if (pet?.id) {
      const [{ data: visitsData }, { data: rxData }] = await Promise.all([
        supabase
          .from("visits")
          .select("id, started_at, diagnosis, treatment_plan, follow_up_at")
          .eq("clinic_id", clinicId)
          .eq("pet_id", pet.id)
          .order("started_at", { ascending: false })
          .limit(12),
        supabase
          .from("prescriptions")
          .select("id, issued_at, notes")
          .eq("clinic_id", clinicId)
          .eq("pet_id", pet.id)
          .order("issued_at", { ascending: false })
          .limit(6),
      ]);

      const vRows = (visitsData as PreviousVisit[]) ?? [];
      setPreviousVisits(vRows);
      setPreviousDiagnosis(Array.from(new Set(vRows.map((v) => (v.diagnosis ?? "").trim()).filter(Boolean))).slice(0, 6));

      const pRows = (rxData as Array<{ id: string; issued_at: string; notes: string | null }>) ?? [];
      if (pRows.length) {
        const { data: itemsData } = await supabase
          .from("prescription_items")
          .select("prescription_id, medicine_name, dosage, frequency, duration, instructions")
          .in("prescription_id", pRows.map((p) => p.id));

        const byId: Record<string, PreviousRx["items"]> = {};
        for (const item of ((itemsData as Array<{ prescription_id: string; medicine_name: string; dosage: string; frequency: string | null; duration: string | null; instructions: string | null }>) ?? [])) {
          if (!byId[item.prescription_id]) byId[item.prescription_id] = [];
          byId[item.prescription_id].push({
            medicine_name: item.medicine_name,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            instructions: item.instructions,
          });
        }
        setPreviousRx(pRows.map((p) => ({ ...p, items: byId[p.id] ?? [] })));
      } else {
        setPreviousRx([]);
      }
    }

    setLoading(false);
  }, [appointmentId, clinicId, doctorStaffId, ensureVisitForAppointment]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveVisit(draft = false, silent = false) {
    if (!visitId) {
      Alert.alert("Visit not ready", "Could not create or load visit.");
      return false;
    }
    const { error } = await supabase
      .from("visits")
      .update({
        symptoms: symptoms || null,
        diagnosis: diagnosis || null,
        treatment_plan: treatmentPlan || null,
        follow_up_at: followUp ? followUp.toISOString() : null,
      })
      .eq("id", visitId)
      .eq("clinic_id", clinicId);
    if (error) {
      Alert.alert("Save failed", error.message);
      return false;
    }
    if (!silent) {
      Alert.alert("Saved", draft ? "Draft saved." : "Visit details updated.");
    }
    await onRefresh();
    return true;
  }

  async function completeVisit() {
    const ok = await saveVisit(false, true);
    if (!ok || !appointmentId) return;

    if (vaccineName.trim() && vaccineNextDue) {
      const { data: apptRow } = await supabase
        .from("appointments")
        .select("branch_id, pet_id")
        .eq("id", appointmentId)
        .eq("clinic_id", clinicId)
        .maybeSingle();
      if (apptRow?.pet_id) {
        const administeredDay = new Date().toISOString().slice(0, 10);
        const dueDay = vaccineNextDue.toISOString().slice(0, 10);
        const { error: vErr } = await supabase.from("vaccination_records").insert({
          clinic_id: clinicId,
          branch_id: apptRow.branch_id,
          pet_id: apptRow.pet_id,
          vaccine_name: vaccineName.trim(),
          dose: null,
          administered_on: administeredDay,
          due_on: dueDay,
          status: "due",
        });
        if (vErr) {
          Alert.alert("Vaccination record", vErr.message);
        }
      }
    }

    await onStatusChange(appointmentId, "completed");
    await generateVisitSummaryPdf();
    Alert.alert("Visit completed", "Consultation marked complete and printable summary generated.");
  }

  async function generateVisitSummaryPdf() {
    if (!visitId || !appointmentId) return;
    const { data: apptRow } = await supabase
      .from("appointments")
      .select("branch_id, pet_id")
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (!apptRow?.branch_id || !apptRow.pet_id) return;

    const logoHtml = clinicLogoUrl
      ? `<img src="${escHtml(clinicLogoUrl)}" style="width:56px;height:56px;object-fit:contain;border-radius:8px;border:1px solid #c5d7d1;background:#fff" />`
      : "";
    const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;padding:0;margin:0;color:#172023;background:#f5f7f8">
      <div style="background:#0e6e61;color:#fff;padding:18px 22px;display:flex;align-items:center;gap:12px">
        ${logoHtml}
        <div>
          <div style="font-size:20px;font-weight:800;line-height:1.2">${escHtml(clinicName)}</div>
          <div style="font-size:12px;opacity:0.92;letter-spacing:0.3px">VISIT SUMMARY</div>
        </div>
      </div>
      <div style="padding:20px 22px">
        <p style="margin:0 0 8px"><b>Issued:</b> ${escHtml(new Date().toLocaleString())}</p>
        <p style="margin:0 0 8px"><b>Doctor:</b> ${escHtml(doctorName)}</p>
        <p style="margin:0 0 8px"><b>Patient:</b> ${escHtml(petQuick?.name ?? "Pet")} (${escHtml(petQuick?.breed ?? "-")})</p>
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
    if (upErr) return;
    await supabase.from("file_attachments").insert({
      clinic_id: clinicId,
      branch_id: apptRow.branch_id,
      pet_id: apptRow.pet_id,
      visit_id: visitId,
      storage_bucket: "medical-files",
      storage_path: path,
      file_name: `visit-summary-${visitId}.pdf`,
      mime_type: "application/pdf",
    });
    await supabase
      .from("visits")
      .update({
        visit_report_pdf_path: path,
        visit_report_pdf_generated_at: new Date().toISOString(),
      })
      .eq("id", visitId)
      .eq("clinic_id", clinicId);
    const { data: signed } = await supabase.storage.from("medical-files").createSignedUrl(path, 60 * 30);
    setLastVisitSummaryUrl(signed?.signedUrl ?? null);
  }

  async function savePrescription() {
    if (!visitId) {
      Alert.alert("Visit not ready", "Save visit first.");
      return;
    }
    const { data: appt } = await supabase
      .from("appointments")
      .select("branch_id, pet_id, doctor_id")
      .eq("id", appointmentId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (!appt?.branch_id || !appt.pet_id) {
      Alert.alert("Missing data", "Branch or pet not found for this appointment.");
      return;
    }
    const filled = rxLines.filter((l) => l.medicine_name.trim() && l.dosage.trim());
    if (!filled.length) {
      Alert.alert("Add medicines", "Enter at least one medicine and dosage.");
      return;
    }

    const rxDoctorId = prescriberStaffId ?? doctorStaffId ?? (appt as { doctor_id?: string | null }).doctor_id ?? null;
    if (!rxDoctorId) {
      Alert.alert(
        "No prescribing doctor",
        "Assign a doctor to this appointment from the front desk, or ensure your account has a staff profile linked."
      );
      return;
    }

    const { data: pres, error: pErr } = await supabase
      .from("prescriptions")
      .insert({
        clinic_id: clinicId,
        branch_id: appt.branch_id,
        visit_id: visitId,
        pet_id: appt.pet_id,
        doctor_id: rxDoctorId,
        notes: rxNotes || null,
      })
      .select("id")
      .single();
    if (pErr || !pres) {
      Alert.alert("Prescription failed", pErr?.message ?? "Unknown error");
      return;
    }

    const { error: iErr } = await supabase.from("prescription_items").insert(
      filled.map((l) => ({
        prescription_id: pres.id,
        medicine_name: l.medicine_name.trim(),
        dosage: l.dosage.trim(),
        frequency: l.frequency.trim() || null,
        duration: l.duration.trim() || null,
        instructions: l.instructions.trim() || null,
      }))
    );
    if (iErr) {
      Alert.alert("Line items failed", iErr.message);
      return;
    }

    const { data: imageRows } = await supabase
      .from("file_attachments")
      .select("storage_bucket, storage_path, mime_type")
      .eq("clinic_id", clinicId)
      .eq("visit_id", visitId)
      .order("created_at", { ascending: false })
      .limit(3);
    const imageUrls: string[] = [];
    for (const row of (imageRows as Array<{ storage_bucket: string; storage_path: string; mime_type?: string | null }> | null) ?? []) {
      if (!row.mime_type?.startsWith("image/")) continue;
      const { data: signed } = await supabase.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60 * 10);
      if (signed?.signedUrl) imageUrls.push(signed.signedUrl);
    }

    const medicineHtml = filled
      .map(
        (l, i) =>
          `<tr>
            <td>${i + 1}</td>
            <td>${escHtml(l.medicine_name)}</td>
            <td>${escHtml(l.dosage)}</td>
            <td>${escHtml(l.frequency || "-")}</td>
            <td>${escHtml(l.duration || "-")}</td>
            <td>${escHtml(l.instructions || "-")}</td>
          </tr>`
      )
      .join("");
    const imagesHtml = imageUrls.length
      ? `<h3>Images</h3><div style="display:flex;gap:10px;flex-wrap:wrap">${imageUrls
          .map((u) => `<img src="${u}" style="width:160px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #ddd" />`)
          .join("")}</div>`
      : "";
    const logoHtml = clinicLogoUrl
      ? `<img src="${escHtml(clinicLogoUrl)}" style="width:56px;height:56px;object-fit:contain;border-radius:8px;border:1px solid #c5d7d1;background:#fff" />`
      : "";
    const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;padding:0;margin:0;color:#172023;background:#f5f7f8">
      <div style="background:#0e6e61;color:#fff;padding:18px 22px;display:flex;align-items:center;gap:12px">
        ${logoHtml}
        <div>
          <div style="font-size:20px;font-weight:800;line-height:1.2">${escHtml(clinicName)}</div>
          <div style="font-size:12px;opacity:0.92;letter-spacing:0.3px">PRESCRIPTION</div>
        </div>
      </div>
      <div style="padding:20px 22px">
        <p style="margin:0 0 8px"><b>Doctor:</b> ${escHtml(doctorName)}</p>
        <p style="margin:0 0 8px"><b>Pet:</b> ${escHtml(petQuick?.name ?? "Pet")} (${escHtml(petQuick?.breed ?? "-")})</p>
        <p style="margin:0 0 12px"><b>Owner:</b> ${escHtml(ownerName)} ${ownerPhone ? `(${escHtml(ownerPhone)})` : ""}</p>
        <p><b>Symptoms:</b> ${escHtml(symptoms || "-")}</p>
        <p><b>Diagnosis:</b> ${escHtml(diagnosis || "-")}</p>
        <p><b>Instructions:</b> ${escHtml(treatmentPlan || "-")}</p>
        <h3 style="margin:18px 0 8px;color:#0e6e61">Medicines</h3>
        <table width="100%" cellspacing="0" cellpadding="6" style="border-collapse:collapse;background:#fff;border:1px solid #d2dcda">
          <thead><tr style="background:#e7f1ee"><th>#</th><th>Name</th><th>Dosage</th><th>Freq</th><th>Duration</th><th>Instructions</th></tr></thead>
          <tbody>${medicineHtml}</tbody>
        </table>
        ${imagesHtml}
        <p style="margin-top:16px"><b>Notes:</b> ${escHtml(rxNotes || "-")}</p>
      </div>
    </body></html>`;
    const pdf = await Print.printToFileAsync({ html });
    const base64 = await FileSystem.readAsStringAsync(pdf.uri, { encoding: FileSystem.EncodingType.Base64 });
    const bytes = bytesFromBase64(base64);
    const path = `${clinicId}/prescriptions/${pres.id}.pdf`;
    const { error: upErr } = await supabase.storage.from("medical-files").upload(path, bytes.buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (!upErr) {
      await supabase.from("prescriptions").update({ pdf_url: path }).eq("id", pres.id);
      const { data: signed } = await supabase.storage.from("medical-files").createSignedUrl(path, 60 * 30);
      setLastDownloadUrl(signed?.signedUrl ?? null);
    }

    Alert.alert("Prescription saved", "PDF generated and stored for access.");
    await onRefresh();
    await load();
  }

  function reusePrescription(rx: PreviousRx) {
    if (!rx.items.length) return;
    setRxLines(
      rx.items.map((it) => ({
        medicine_name: it.medicine_name,
        dosage: it.dosage,
        frequency: it.frequency ?? "",
        duration: it.duration ?? "",
        instructions: it.instructions ?? "",
      }))
    );
    setRxNotes(rx.notes ?? "");
  }

  async function pickImage(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow camera or photo library to attach images.");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, base64: true });
    if (result.canceled || !result.assets?.[0] || !appointmentId) return;
    const asset = result.assets[0];
    await onUploadVisitImage(appointmentId, asset.uri, asset.mimeType ?? "image/jpeg", asset.base64 ?? null);
    await onRefresh();
    if (visitId) {
      try {
        setAttachments(await fetchVisitAttachments(visitId));
      } catch {
        /* ignore */
      }
    }
    await load();
  }

  async function uploadDocument() {
    if (!appointmentId) return;
    await onUploadDocument(appointmentId);
    if (visitId) {
      try {
        setAttachments(await fetchVisitAttachments(visitId));
      } catch {
        /* ignore */
      }
    }
    await load();
  }

  function onFollowChange(e: DateTimePickerEvent, date?: Date) {
    handleDateTimePickerChange(e, date, {
      onSet: (d) => setFollowUp(d),
      setVisible: setShowFollowPicker,
    });
  }

  function onVaccineDueChange(e: DateTimePickerEvent, date?: Date) {
    handleDateTimePickerChange(e, date, {
      onSet: (d) => setVaccineNextDue(d),
      setVisible: setShowVaccineDuePicker,
    });
  }

  if (!appointmentId) {
    return (
      <View style={styles.center}>
        <Text style={commonStyles.muted}>No appointment selected. Open from the queue.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={commonStyles.muted}>Loading consultation…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={[commonStyles.scrollContent, styles.pagePad]}> 
      <View style={[commonStyles.card, styles.glassCard]}>
        <Text style={commonStyles.cardTitle}>Patient quick view</Text>
        <View style={styles.patientRow}>
          <PetAvatar uri={petQuick?.photo_url} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={styles.em}>{petQuick?.name ?? "—"}</Text>
            <Text style={commonStyles.muted}>{ownerName} {ownerPhone ? `· ${ownerPhone}` : ""}</Text>
            <Text style={commonStyles.muted}>Age {calcAgeLabel(petQuick)} · {petQuick?.breed ?? "Breed —"}</Text>
          </View>
        </View>
        {petQuick?.allergies ? <Text style={styles.alertText}>Allergies: {petQuick.allergies}</Text> : <Text style={commonStyles.muted}>No allergy alerts.</Text>}
        {petQuick?.chronic_diseases ? <Text style={styles.alertText}>Chronic: {petQuick.chronic_diseases}</Text> : null}
        <Pressable style={styles.statusBtn} onPress={() => setShowStatusPicker(true)}>
          <Text style={styles.statusBtnLabel}>Appointment status</Text>
          <Text style={styles.statusBtnValue}>{appointmentStatus.replaceAll("_", " ")}</Text>
        </Pressable>
      </View>

      <View style={[commonStyles.card, styles.glassCard]}>
        <Text style={commonStyles.cardTitle}>Symptoms / complaint</Text>
        <TextInput style={[commonStyles.input, styles.tall]} value={symptoms} onChangeText={setSymptoms} placeholder="Chief complaint, observations…" placeholderTextColor={theme.outline} multiline />
        <Text style={[commonStyles.muted, { marginTop: 6 }]}>Voice-to-text can be added with native speech APIs.</Text>

        <Text style={[commonStyles.cardTitle, { marginTop: 14 }]}>Diagnosis</Text>
        <TextInput style={[commonStyles.input, styles.tall]} value={diagnosis} onChangeText={setDiagnosis} placeholder="Diagnosis" placeholderTextColor={theme.outline} multiline />
        {previousDiagnosis.length ? (
          <View style={styles.suggestRow}>
            {previousDiagnosis.map((d) => (
              <Pressable key={d} style={styles.suggestChip} onPress={() => setDiagnosis(d)}>
                <Text style={styles.suggestChipText}>{d}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={[commonStyles.card, styles.glassCard]}>
        <Text style={commonStyles.cardTitle}>Vaccination follow-up (owner app)</Text>
        <Text style={[commonStyles.muted, { marginBottom: 10 }]}>
          Records a due date for the pet owner dashboard & health tab.{" "}
          {appointmentType === "vaccination" ? "(Vaccination visit)" : ""}
        </Text>
        <Text style={commonStyles.sectionLabel}>Vaccine / booster name</Text>
        <TextInput
          style={commonStyles.input}
          value={vaccineName}
          onChangeText={setVaccineName}
          placeholder="e.g. Rabies, DHPP"
          placeholderTextColor={theme.outline}
        />
        <Text style={[commonStyles.sectionLabel, { marginTop: 16 }]}>Next due date</Text>
        <Pressable style={styles.dateBtn} onPress={() => setShowVaccineDuePicker(true)}>
          <Text style={styles.dateBtnText}>{vaccineNextDue ? vaccineNextDue.toLocaleDateString() : "Tap to set next due date"}</Text>
        </Pressable>
        {showVaccineDuePicker ? (
          <DateTimePicker
            value={vaccineNextDue ?? new Date()}
            mode="date"
            display="default"
            onChange={onVaccineDueChange}
          />
        ) : null}
        <Text style={[commonStyles.muted, { marginTop: 8 }]}>
          When you complete the visit, this is saved to vaccination records so the owner sees it under alerts.
        </Text>
      </View>

      <View style={[commonStyles.card, styles.glassCard]}>
        <Text style={commonStyles.cardTitle}>Prescription builder</Text>
        <TextInput style={commonStyles.input} value={medQuery} onChangeText={setMedQuery} placeholder="Search medicine database" placeholderTextColor={theme.outline} />
        <View style={styles.suggestRow}>
          {medsFiltered.map((m) => (
            <Pressable key={m} style={styles.suggestChip} onPress={() => setRxLines((prev) => [...prev, { medicine_name: m, dosage: "", frequency: "", duration: "", instructions: "" }])}>
              <Text style={styles.suggestChipText}>{m}</Text>
            </Pressable>
          ))}
        </View>

        {rxLines.map((line, idx) => (
          <View key={idx} style={styles.rxBlock}>
            <Text style={commonStyles.sectionLabel}>Medicine {idx + 1}</Text>
            <TextInput style={commonStyles.input} value={line.medicine_name} onChangeText={(t) => setRxLines((rows) => rows.map((r, i) => i === idx ? { ...r, medicine_name: t } : r))} placeholder="Name" placeholderTextColor={theme.outline} />
            <TextInput style={[commonStyles.input, { marginTop: 8 }]} value={line.dosage} onChangeText={(t) => setRxLines((rows) => rows.map((r, i) => i === idx ? { ...r, dosage: t } : r))} placeholder="Dosage" placeholderTextColor={theme.outline} />
            <View style={styles.inline2}>
              <TextInput style={[commonStyles.input, styles.half]} value={line.frequency} onChangeText={(t) => setRxLines((rows) => rows.map((r, i) => i === idx ? { ...r, frequency: t } : r))} placeholder="Frequency" placeholderTextColor={theme.outline} />
              <TextInput style={[commonStyles.input, styles.half]} value={line.duration} onChangeText={(t) => setRxLines((rows) => rows.map((r, i) => i === idx ? { ...r, duration: t } : r))} placeholder="Duration" placeholderTextColor={theme.outline} />
            </View>
            <TextInput style={[commonStyles.input, { marginTop: 8 }]} value={line.instructions} onChangeText={(t) => setRxLines((rows) => rows.map((r, i) => i === idx ? { ...r, instructions: t } : r))} placeholder="Instructions" placeholderTextColor={theme.outline} />
          </View>
        ))}
        <Pressable style={commonStyles.btnOutline} onPress={() => setRxLines((p) => [...p, { medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "" }])}>
          <Text style={commonStyles.btnOutlineText}>+ Add medicine line</Text>
        </Pressable>

        {!!previousRx.length && (
          <View style={{ marginTop: 12 }}>
            <Text style={commonStyles.sectionLabel}>Reuse previous prescriptions</Text>
            {previousRx.slice(0, 3).map((rx) => (
              <Pressable key={rx.id} style={styles.reuseRow} onPress={() => reusePrescription(rx)}>
                <Text style={styles.reuseTitle}>{new Date(rx.issued_at).toLocaleDateString()}</Text>
                <Text style={commonStyles.muted}>{rx.items.length} medicines</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={[commonStyles.sectionLabel, { marginTop: 14 }]}>Notes & instructions</Text>
        <TextInput style={[commonStyles.input, { minHeight: 70, textAlignVertical: "top" }]} value={rxNotes} onChangeText={setRxNotes} placeholder="Diet, care and follow-up notes" placeholderTextColor={theme.outline} multiline />
      </View>

      <View style={[commonStyles.card, styles.glassCard]}>
        <Text style={commonStyles.cardTitle}>Visit documents</Text>
        <Text style={[commonStyles.muted, { marginBottom: 10 }]}>
          Lab reports, PDFs, and images are stored on this visit (same as the web portal).
        </Text>
        <View style={commonStyles.actionRow}>
          <Pressable style={commonStyles.btnOutline} onPress={() => void pickImage(true)}>
            <Text style={commonStyles.btnOutlineText}>Camera</Text>
          </Pressable>
          <Pressable style={commonStyles.btnOutline} onPress={() => void pickImage(false)}>
            <Text style={commonStyles.btnOutlineText}>Gallery</Text>
          </Pressable>
          <Pressable style={commonStyles.btnPrimary} onPress={() => void uploadDocument()}>
            <Text style={commonStyles.btnPrimaryText}>Upload file</Text>
          </Pressable>
        </View>
        {attachments.length ? (
          <View style={styles.attachList}>
            {attachments.map((file) => (
              <Pressable
                key={file.id}
                style={styles.attachRow}
                onPress={() => {
                  void openVisitAttachment(file).catch((err) => {
                    Alert.alert("Open failed", err instanceof Error ? err.message : "Could not open file.");
                  });
                }}
              >
                <MaterialIcons
                  name={file.mime_type?.startsWith("image/") ? "image" : "description"}
                  size={20}
                  color={theme.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.attachName}>{file.file_name ?? "Attachment"}</Text>
                  <Text style={commonStyles.muted}>{new Date(file.created_at).toLocaleString()}</Text>
                </View>
                <MaterialIcons name="open-in-new" size={18} color={theme.outline} />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={[commonStyles.emptyState, { marginTop: 10 }]}>No documents yet — upload from here or the queue.</Text>
        )}
      </View>

      <View style={[commonStyles.card, styles.glassCard]}>
        <Text style={commonStyles.cardTitle}>Imaging uploads</Text>
        <Text style={[commonStyles.muted, { marginBottom: 10 }]}>Quick camera shortcuts — files also appear in Visit documents above.</Text>
        <View style={commonStyles.actionRow}>
          <Pressable style={commonStyles.btnOutline} onPress={() => void pickImage(true)}><Text style={commonStyles.btnOutlineText}>Camera</Text></Pressable>
          <Pressable style={commonStyles.btnOutline} onPress={() => void pickImage(false)}><Text style={commonStyles.btnOutlineText}>Gallery</Text></Pressable>
        </View>
      </View>

      <View style={[commonStyles.card, styles.glassCard]}>
        <Text style={commonStyles.cardTitle}>Follow-up</Text>
        <Pressable style={styles.dateBtn} onPress={() => setShowFollowPicker(true)}>
          <Text style={styles.dateBtnText}>{followUp ? followUp.toLocaleString() : "Tap to set follow-up date"}</Text>
        </Pressable>
        {showFollowPicker ? (
          <DateTimePicker
            value={followUp ?? new Date()}
            mode="datetime"
            display="default"
            onChange={onFollowChange}
          />
        ) : null}
        <View style={commonStyles.actionRow}>
          <Pressable style={commonStyles.btnOutline} onPress={() => void saveVisit(true)}>
            <Text style={commonStyles.btnOutlineText}>Save draft</Text>
          </Pressable>
          <Pressable style={commonStyles.btnPrimary} onPress={() => void completeVisit()}>
            <Text style={commonStyles.btnPrimaryText}>Complete visit + summary PDF</Text>
          </Pressable>
          <Pressable style={commonStyles.btnOutline} onPress={() => void saveVisit(false)}>
            <Text style={commonStyles.btnOutlineText}>Add follow-up</Text>
          </Pressable>
          <Pressable
            style={commonStyles.btnOutline}
            onPress={() => {
              if (!lastVisitSummaryUrl) {
                Alert.alert("Not ready", "Complete the visit first to generate summary PDF.");
                return;
              }
              void Linking.openURL(lastVisitSummaryUrl);
            }}
          >
            <Text style={commonStyles.btnOutlineText}>Open summary PDF</Text>
          </Pressable>
        </View>
      </View>

      <View style={[commonStyles.card, styles.glassCard]}>
        <Text style={commonStyles.cardTitle}>Visit history</Text>
        {previousVisits.slice(0, 6).map((v) => (
          <View key={v.id} style={styles.historyRow}>
            <Text style={styles.reuseTitle}>{v.started_at ? new Date(v.started_at).toLocaleDateString() : "—"}</Text>
            <Text style={commonStyles.muted}>{v.diagnosis ?? "No diagnosis"}</Text>
          </View>
        ))}
        {!previousVisits.length ? <Text style={commonStyles.emptyState}>No previous consultations found.</Text> : null}
      </View>

      <View style={[commonStyles.card, styles.glassCard]}>
        <Text style={commonStyles.cardTitle}>Prescription document</Text>
        <Text style={[commonStyles.muted, { marginBottom: 10 }]}>Generate and save a downloadable consultation document for doctor, owner, and reception access.</Text>
        <View style={commonStyles.actionRow}>
          <Pressable style={commonStyles.btnPrimary} onPress={() => void savePrescription()}>
            <Text style={commonStyles.btnPrimaryText}>Generate & save</Text>
          </Pressable>
          <Pressable
            style={commonStyles.btnOutline}
            onPress={() => {
              if (!lastDownloadUrl) {
                Alert.alert("Not ready", "Generate a prescription first.");
                return;
              }
              void Linking.openURL(lastDownloadUrl);
            }}
          >
            <Text style={commonStyles.btnOutlineText}>Download</Text>
          </Pressable>
        </View>
      </View>

      <AppointmentStatusPicker
        visible={showStatusPicker}
        currentStatus={appointmentStatus}
        onClose={() => setShowStatusPicker(false)}
        onSelect={(status) => {
          if (!appointmentId) return;
          void onStatusChange(appointmentId, status).then(() => {
            setAppointmentStatus(status);
            void onRefresh();
          });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  pagePad: { paddingTop: 8, paddingBottom: 54 },
  glassCard: {
    backgroundColor: `${theme.surfaceContainerLow}dd`,
    borderColor: `${theme.outlineVariant}77`,
  },
  em: { fontWeight: "800", fontSize: 18, color: theme.onSurface },
  patientRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  statusBtn: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.surfaceContainer,
  },
  statusBtnLabel: { fontSize: 11, fontWeight: "800", color: theme.onSurfaceVariant, textTransform: "uppercase", letterSpacing: 0.8 },
  statusBtnValue: { marginTop: 4, fontSize: 15, fontWeight: "800", color: theme.primary, textTransform: "capitalize" },
  attachList: { marginTop: 12, gap: 8 },
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.surfaceBright,
  },
  attachName: { fontWeight: "700", color: theme.onSurface },
  alertText: { color: theme.error, fontWeight: "700", fontSize: 13, marginTop: 6 },
  tall: { minHeight: 88, textAlignVertical: "top" },
  dateBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.surfaceContainer,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
  },
  dateBtnText: { fontWeight: "600", color: theme.onSurface },
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  suggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${theme.primary}14`,
    borderWidth: 1,
    borderColor: `${theme.primary}44`,
  },
  suggestChipText: { fontSize: 12, fontWeight: "700", color: theme.primary },
  rxBlock: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
    marginTop: 8,
  },
  inline2: { flexDirection: "row", gap: 8, marginTop: 8 },
  half: { flex: 1 },
  reuseRow: {
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  reuseTitle: { fontWeight: "700", color: theme.onSurface },
  historyRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
    paddingVertical: 8,
  },
});
