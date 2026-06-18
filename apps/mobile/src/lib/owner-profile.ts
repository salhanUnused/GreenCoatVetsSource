import { normalizeLegacySpeciesToCanonical, PET_SPECIES_BOOKING_OPTIONS } from "@saasclinics/lib";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensurePrimaryClinicMembership } from "./ensure-clinic-membership";
import { sendOwnerWelcomeEmail } from "./website-api";

const WEBSITE_PROFILE_SPECIES = new Set(PET_SPECIES_BOOKING_OPTIONS.map((o) => o.value));

type OwnerRow = {
  id: string;
  phone: string | null;
  clinic_id: string;
  full_name?: string | null;
  email?: string | null;
  user_id?: string | null;
};

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

/** Same idea as website getOwnerPortalContext — tolerate duplicate owner rows. */
async function resolveOwnerForUser(
  supabase: SupabaseClient,
  userId: string,
  preferredClinicId: string | null,
  email?: string | null,
): Promise<OwnerRow | null> {
  const { data: linkedRows, error: linkedErr } = await supabase
    .from("owners")
    .select("id, phone, clinic_id, full_name, email, user_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (linkedErr) throw new Error(linkedErr.message);

  const linked = (linkedRows as OwnerRow[] | null) ?? [];
  if (linked.length) {
    return linked.find((r) => r.clinic_id === preferredClinicId) ?? linked[0];
  }

  const emailNorm = email?.trim().toLowerCase() ?? "";
  if (!emailNorm || !preferredClinicId) return null;

  const { data: guestRows, error: guestErr } = await supabase
    .from("owners")
    .select("id, phone, clinic_id, full_name, email, user_id")
    .eq("clinic_id", preferredClinicId)
    .is("user_id", null)
    .eq("email", emailNorm)
    .order("created_at", { ascending: true })
    .limit(1);

  if (guestErr) throw new Error(guestErr.message);
  return ((guestRows as OwnerRow[] | null) ?? [])[0] ?? null;
}

/** Link website account to mobile: same auth user, same clinic membership + owner row. */
export async function syncWebsiteAccountForMobile(
  supabase: SupabaseClient,
  user: User,
): Promise<void> {
  const meta = user.user_metadata as Record<string, string | undefined> | undefined;
  const displayName = meta?.full_name?.trim() || meta?.name?.trim() || null;
  const phone = meta?.phone?.trim() || null;
  await ensurePrimaryClinicMembership(displayName, phone);

  const clinicId = await getPrimaryClinicId(supabase);
  if (!clinicId) return;

  const owner = await resolveOwnerForUser(supabase, user.id, clinicId, user.email);
  if (!owner?.id || owner.user_id === user.id) return;

  const { error } = await supabase
    .from("owners")
    .update({
      user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", owner.id)
    .is("user_id", null);

  if (error) throw new Error(error.message);
}

/** Pet owners must have contact phone + at least one active pet before using the app. */
export async function getPetOwnerProfileStatus(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string | null,
): Promise<OwnerProfileStatus> {
  const { data: memberships, error: membershipErr } = await supabase
    .from("user_clinic_memberships")
    .select("role, clinic_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (membershipErr) throw new Error(membershipErr.message);

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

  const owner = await resolveOwnerForUser(supabase, userId, clinicId, userEmail);
  if (!owner?.id || !isOwnerPhoneComplete(owner.phone)) {
    return { needsCompletion: true, clinicId, ownerId: owner?.id ?? null };
  }

  const { count, error: petErr } = await supabase
    .from("pets")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", owner.id)
    .eq("is_active", true);

  if (petErr) throw new Error(petErr.message);

  if (!count) {
    return { needsCompletion: true, clinicId, ownerId: owner.id };
  }

  return { needsCompletion: false, clinicId, ownerId: owner.id };
}

export async function loadOwnerProfilePrefill(
  supabase: SupabaseClient,
  user: User,
): Promise<{ fullName: string; phone: string; hasPets: boolean }> {
  const clinicId = await getPrimaryClinicId(supabase);
  const owner = clinicId ? await resolveOwnerForUser(supabase, user.id, clinicId, user.email) : null;
  const meta = user.user_metadata as Record<string, string | undefined> | undefined;

  let hasPets = false;
  if (owner?.id) {
    const { count } = await supabase
      .from("pets")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", owner.id)
      .eq("is_active", true);
    hasPets = (count ?? 0) > 0;
  }

  return {
    fullName: owner?.full_name?.trim() || meta?.full_name?.trim() || meta?.name?.trim() || "",
    phone: isOwnerPhoneComplete(owner?.phone) ? (owner?.phone ?? "").trim() : meta?.phone?.trim() || "",
    hasPets,
  };
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
  if (!fullName || !phone) {
    throw new Error("Full name and phone are required.");
  }
  if (!species || !WEBSITE_PROFILE_SPECIES.has(species)) {
    throw new Error("A valid pet species is required.");
  }

  const emailNorm = user.email?.trim().toLowerCase() ?? "";
  let owner = await resolveOwnerForUser(supabase, user.id, clinicId, user.email);

  if (owner?.id) {
    const { error: updateOwnerError } = await supabase
      .from("owners")
      .update({
        full_name: fullName,
        phone,
        email: emailNorm || owner.email || null,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", owner.id);
    if (updateOwnerError) throw new Error(updateOwnerError.message);
  } else if (emailNorm) {
    const guest = await resolveOwnerForUser(supabase, user.id, clinicId, user.email);
    if (guest?.id) {
      const { error: mergeOwnerError } = await supabase
        .from("owners")
        .update({
          user_id: user.id,
          full_name: fullName,
          phone,
          email: emailNorm,
          updated_at: new Date().toISOString(),
        })
        .eq("id", guest.id);
      if (mergeOwnerError) throw new Error(mergeOwnerError.message);
      owner = { ...guest, id: guest.id };
    }
  }

  let ownerId = owner?.id ?? null;

  if (!ownerId) {
    const { data: insertedRows, error: insertOwnerError } = await supabase
      .from("owners")
      .insert({
        clinic_id: clinicId,
        user_id: user.id,
        full_name: fullName,
        phone,
        email: emailNorm || null,
      })
      .select("id")
      .limit(1);

    if (insertOwnerError) throw new Error(insertOwnerError.message);
    ownerId = ((insertedRows as Array<{ id: string }> | null) ?? [])[0]?.id ?? null;
    if (!ownerId) throw new Error("Could not create owner profile.");
  }

  const { count: petCount, error: petCountErr } = await supabase
    .from("pets")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("is_active", true);

  if (petCountErr) throw new Error(petCountErr.message);

  if (!petCount) {
    if (!petName) throw new Error("Pet name is required for your first pet.");
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
