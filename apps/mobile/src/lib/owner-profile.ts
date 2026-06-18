import { normalizeLegacySpeciesToCanonical, PET_SPECIES_BOOKING_OPTIONS } from "@saasclinics/lib";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensurePrimaryClinicMembership } from "./ensure-clinic-membership";
import { sendOwnerWelcomeEmail } from "./website-api";

const WEBSITE_PROFILE_SPECIES = new Set(PET_SPECIES_BOOKING_OPTIONS.map((o) => o.value));

export function isOwnerPhoneComplete(phone: string | null | undefined): boolean {
  const p = (phone ?? "").trim();
  if (!p || p.toUpperCase() === "NA" || p === "0000000000") return false;
  return p.length >= 8;
}

export type OwnerProfileStatus = {
  needsCompletion: boolean;
  clinicId: string | null;
  ownerId: string | null;
};

async function getPrimaryClinicId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_primary_marketing_clinic_id");
  if (!error && data) return data as string;

  const [{ data: branding }, { data: marketing }] = await Promise.all([
    supabase.from("platform_branding").select("primary_clinic_id").eq("id", "default").maybeSingle(),
    supabase
      .from("marketing_site_settings")
      .select("website_branded_for_clinic_id, default_clinic_id")
      .eq("id", "default")
      .maybeSingle(),
  ]);

  const branded = (marketing as { website_branded_for_clinic_id?: string | null } | null)?.website_branded_for_clinic_id;
  const defaultId = (marketing as { default_clinic_id?: string | null } | null)?.default_clinic_id;
  const platformId = (branding as { primary_clinic_id?: string | null } | null)?.primary_clinic_id;

  return platformId ?? branded ?? defaultId ?? null;
}

/** Pet owners must have contact phone + at least one active pet before using the app. */
export async function getPetOwnerProfileStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<OwnerProfileStatus> {
  const { data: memberships } = await supabase
    .from("user_clinic_memberships")
    .select("role, clinic_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  const rows = memberships ?? [];
  const petOwnerMembership = rows.find((m) => m.role === "pet_owner");
  const staffMembership = rows.find((m) => m.role !== "pet_owner");

  if (staffMembership && !petOwnerMembership) {
    return { needsCompletion: false, clinicId: null, ownerId: null };
  }

  const clinicId = petOwnerMembership?.clinic_id ?? (await getPrimaryClinicId(supabase));
  if (!clinicId) {
    return { needsCompletion: true, clinicId: null, ownerId: null };
  }

  const { data: owner } = await supabase
    .from("owners")
    .select("id, phone")
    .eq("user_id", userId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!owner?.id || !isOwnerPhoneComplete(owner.phone as string | null)) {
    return { needsCompletion: true, clinicId, ownerId: owner?.id ?? null };
  }

  const { count } = await supabase
    .from("pets")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", owner.id)
    .eq("is_active", true);

  if (!count) {
    return { needsCompletion: true, clinicId, ownerId: owner.id };
  }

  return { needsCompletion: false, clinicId, ownerId: owner.id };
}

export async function completeOwnerProfileWithPet(
  supabase: SupabaseClient,
  user: User,
  input: {
    fullName: string;
    phone: string;
    petName: string;
    species: string;
    breed?: string;
    gender?: string | null;
    dateOfBirth?: string | null;
    weightKg?: number | null;
    color?: string | null;
    microchipId?: string | null;
  },
): Promise<void> {
  const clinicId = await getPrimaryClinicId(supabase);
  if (!clinicId) throw new Error("Clinic is not configured for this app.");

  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const petName = input.petName.trim();
  const species = normalizeLegacySpeciesToCanonical(input.species.trim());
  if (!fullName || !phone || !petName) {
    throw new Error("Full name, phone, and pet name are required.");
  }
  if (!species || !WEBSITE_PROFILE_SPECIES.has(species)) {
    throw new Error("A valid pet species is required.");
  }

  const emailNorm = user.email?.trim().toLowerCase() ?? "";
  let ownerId: string | null = null;

  const { data: existingOwner, error: existingOwnerError } = await supabase
    .from("owners")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingOwnerError) throw new Error(existingOwnerError.message);

  if (existingOwner?.id) {
    ownerId = existingOwner.id;
    const { error: updateOwnerError } = await supabase
      .from("owners")
      .update({
        full_name: fullName,
        phone,
        email: emailNorm || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ownerId);
    if (updateOwnerError) throw new Error(updateOwnerError.message);
  } else if (emailNorm) {
    const { data: guestOwner, error: guestOwnerError } = await supabase
      .from("owners")
      .select("id")
      .eq("clinic_id", clinicId)
      .is("user_id", null)
      .eq("email", emailNorm)
      .maybeSingle();
    if (guestOwnerError) throw new Error(guestOwnerError.message);

    if (guestOwner?.id) {
      ownerId = guestOwner.id;
      const { error: mergeOwnerError } = await supabase
        .from("owners")
        .update({
          user_id: user.id,
          full_name: fullName,
          phone,
          email: emailNorm,
          updated_at: new Date().toISOString(),
        })
        .eq("id", guestOwner.id);
      if (mergeOwnerError) throw new Error(mergeOwnerError.message);
    }
  }

  if (!ownerId) {
    const { data: insertedOwner, error: insertOwnerError } = await supabase
      .from("owners")
      .insert({
        clinic_id: clinicId,
        user_id: user.id,
        full_name: fullName,
        phone,
        email: emailNorm || null,
      })
      .select("id")
      .single();
    if (insertOwnerError) throw new Error(insertOwnerError.message);
    ownerId = insertedOwner.id;
  }

  const { count: petCount } = await supabase
    .from("pets")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("is_active", true);

  if (!petCount) {
    const { error: insertPetError } = await supabase.from("pets").insert({
      clinic_id: clinicId,
      owner_id: ownerId,
      name: petName,
      species,
      breed: input.breed?.trim() || null,
      gender: input.gender?.trim() || null,
      date_of_birth: input.dateOfBirth?.trim() || null,
      weight_kg: input.weightKg != null && Number.isFinite(input.weightKg) ? input.weightKg : null,
      color: input.color?.trim() || null,
      microchip_id: input.microchipId?.trim() || null,
      is_active: true,
    });
    if (insertPetError) throw new Error(insertPetError.message);
  }

  await ensurePrimaryClinicMembership(fullName, phone);
  try {
    await sendOwnerWelcomeEmail(fullName);
  } catch (mailErr) {
    console.warn("[completeOwnerProfileWithPet] welcome email failed", mailErr);
  }
}
