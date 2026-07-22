import { supabase } from "./supabase";

const STAFF_ROLES = new Set([
  "clinic_admin",
  "branch_admin",
  "doctor",
  "junior_doctor",
  "senior_doctor",
  "manager",
  "junior",
  "receptionist",
  "lab_technician",
  "pharmacist",
]);

export type MembershipRow = { clinic_id: string; role: string };

const DOCTOR_ROLES = new Set(["doctor", "junior_doctor", "senior_doctor"]);

export function isDoctorRole(role: string | null | undefined): boolean {
  return DOCTOR_ROLES.has((role ?? "").toLowerCase());
}

export function isSeniorDoctorRole(role: string | null | undefined): boolean {
  return (role ?? "").toLowerCase() === "senior_doctor";
}

export function isRegularDoctorRole(role: string | null | undefined): boolean {
  const normalized = (role ?? "").toLowerCase();
  return normalized === "doctor" || normalized === "junior_doctor";
}

export async function resolveSuperAdminClinicId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_primary_marketing_clinic_id");
  if (!error && data) return data as string;

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return clinic?.id ?? null;
}

export function pickActiveMembership(rows: MembershipRow[]): MembershipRow | null {
  if (!rows.length) return null;
  const staff = rows.find((m) => STAFF_ROLES.has(m.role));
  if (staff) return staff;
  const petOwner = rows.find((m) => m.role === "pet_owner");
  if (petOwner) return petOwner;
  return rows[0];
}

export async function loadActiveMembership(userId: string): Promise<MembershipRow | null> {
  const { data, error } = await supabase
    .from("user_clinic_memberships")
    .select("clinic_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return pickActiveMembership((data as MembershipRow[]) ?? []);
}

/** Last resort: assign the only clinic (or primary marketing clinic). */
export async function forceAssignOnlyClinic(role = "pet_owner"): Promise<string | null> {
  const { data, error } = await supabase.rpc("force_assign_only_clinic_membership", { p_role: role });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}
