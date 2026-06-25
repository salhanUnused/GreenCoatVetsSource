"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
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
  const ageMonthsRaw = String(formData.get("age_months") ?? "").trim();
  const weightKgRaw = String(formData.get("weight_kg") ?? "").trim();
  const branchId = String(formData.get("branch_id") ?? "").trim();
  const createAppointment = String(formData.get("create_appointment") ?? "") === "on";
  const notes = String(formData.get("notes") ?? "").trim();

  if (!phone) throw new Error("Phone is required for walk-in.");
  if (!petName) throw new Error("Patient name is required.");
  const ageMonths = ageMonthsRaw ? Number.parseInt(ageMonthsRaw, 10) : null;
  const weightKg = weightKgRaw ? Number.parseFloat(weightKgRaw) : null;
  if (ageMonthsRaw && (!Number.isFinite(ageMonths as number) || (ageMonths as number) < 0)) {
    throw new Error("Age (months) must be a valid non-negative number.");
  }
  if (weightKgRaw && (!Number.isFinite(weightKg as number) || (weightKg as number) < 0)) {
    throw new Error("Weight (kg) must be a valid non-negative number.");
  }

  const { first, last, full } = splitOwnerName(ownerRaw || "");

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

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

  if (createAppointment && branchId) {
    const { error: aErr } = await supabase.from("appointments").insert({
      clinic_id,
      branch_id: branchId,
      pet_id: petRow.id,
      owner_id: ownerRow.id,
      appointment_type: "consultation",
      status: "scheduled",
      starts_at: new Date().toISOString(),
      notes: notes ? `Walk-in from web front desk. ${notes}` : "Walk-in from web front desk",
    });
    if (aErr) throw new Error(aErr.message);
  }

  revalidatePath("/owners");
  revalidatePath("/pets");
  revalidatePath("/appointments");
  redirect("/appointments");
}
