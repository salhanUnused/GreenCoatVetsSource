"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { provisionUserAccountForAdmin, rollbackProvisionedUser } from "@/lib/auth/provision-user-account";
import { sendPortalPasswordResetLink } from "@/lib/auth/send-portal-password-reset";
import { sendAdminCreatedPortalCredentialsEmail } from "@/lib/email/send-welcome-email";
import { validateSquarePngUpload } from "@saasclinics/lib";
import { createClient } from "@/lib/supabase/server";

async function assertSuperAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Login required.");
  }

  const { data, error } = await supabase
    .from("platform_super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Only super admin can perform this action.");
  }
}

function formatRoleLabel(role: string) {
  return role.replace(/_/g, " ");
}

function getAccessKind(role: string): "website" | "web" {
  return role === "marketing_editor" || role === "pet_owner" ? "website" : "web";
}

export async function createClinicAsSuperAdmin(formData: FormData) {
  await assertSuperAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const subdomain = String(formData.get("subdomain") ?? "").trim();
  const customDomain = String(formData.get("custom_domain") ?? "").trim();
  const supportEmail = String(formData.get("support_email") ?? "").trim();
  const supportPhone = String(formData.get("support_phone") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const imageFile = formData.get("clinic_image");

  const supabase = createClient();
  const { data: clinicId, error } = await supabase.rpc("super_admin_create_clinic", {
    p_name: name,
    p_slug: slug,
    p_subdomain: subdomain || null,
    p_custom_domain: customDomain || null,
    p_support_email: supportEmail || null,
    p_support_phone: supportPhone || null,
    p_timezone: timezone || "UTC",
  });
  if (error) throw new Error(error.message);

  const file = imageFile instanceof File ? imageFile : null;
  if (file && file.size > 0 && clinicId) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${clinicId}/${Date.now()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("clinic-assets")
      .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: true });
    if (uploadError) throw new Error(uploadError.message);
    const { data: publicUrl } = supabase.storage.from("clinic-assets").getPublicUrl(path);
    const { error: updateError } = await supabase
      .from("clinics")
      .update({ image_url: publicUrl.publicUrl })
      .eq("id", clinicId);
    if (updateError) throw new Error(updateError.message);
  }
  revalidatePath("/super-admin");
  revalidatePath("/invite-qrs");
}

export async function setClinicActiveState(formData: FormData) {
  await assertSuperAdmin();
  const clinicId = String(formData.get("clinic_id") ?? "").trim();
  const nextState = String(formData.get("next_state") ?? "").trim() === "active";
  if (!clinicId) throw new Error("Clinic id is required.");

  const supabase = createClient();
  const { error } = await supabase.rpc("super_admin_set_clinic_active", {
    p_clinic_id: clinicId,
    p_is_active: nextState,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/super-admin");
}

export async function setClinicWebsiteStoreState(formData: FormData) {
  await assertSuperAdmin();
  const clinicId = String(formData.get("clinic_id") ?? "").trim();
  const nextEnabledRaw = String(formData.get("next_enabled") ?? "").trim().toLowerCase();
  const nextEnabled = nextEnabledRaw === "true" || nextEnabledRaw === "on" || nextEnabledRaw === "1";
  if (!clinicId) throw new Error("Clinic id is required.");

  const supabase = createClient();
  const { error } = await supabase
    .from("clinics")
    .update({ website_store_enabled: nextEnabled })
    .eq("id", clinicId);
  if (error) throw new Error(error.message);
  revalidatePath("/super-admin");
}

export async function deleteClinicPermanently(formData: FormData) {
  await assertSuperAdmin();
  const clinicId = String(formData.get("clinic_id") ?? "").trim();
  if (!clinicId) throw new Error("Clinic id is required.");

  const supabase = createClient();
  const { error } = await supabase.rpc("super_admin_delete_clinic", {
    p_clinic_id: clinicId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/super-admin");
}

export async function updateClinicImageAsSuperAdmin(formData: FormData) {
  await assertSuperAdmin();
  const clinicId = String(formData.get("clinic_id") ?? "").trim();
  const imageFile = formData.get("clinic_image");
  const file = imageFile instanceof File ? imageFile : null;
  if (!clinicId) throw new Error("Clinic id is required.");
  if (!file || file.size === 0) throw new Error("Clinic image is required.");

  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${clinicId}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("clinic-assets")
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: true });
  if (uploadError) throw new Error(uploadError.message);
  const { data: publicUrl } = supabase.storage.from("clinic-assets").getPublicUrl(path);

  const { error } = await supabase
    .from("clinics")
    .update({ image_url: publicUrl.publicUrl })
    .eq("id", clinicId);
  if (error) throw new Error(error.message);
  revalidatePath("/super-admin");
  revalidatePath("/join-clinic");
}

const PLATFORM_LOGO_PATH = "platform/branding/logo.png";
const PLATFORM_FAVICON_PATH = "platform/branding/favicon.png";

export async function updatePlatformBrandingAsSuperAdmin(formData: FormData) {
  await assertSuperAdmin();
  const logoFile = formData.get("platform_logo");
  const file = logoFile instanceof File ? logoFile : null;
  const faviconFile = formData.get("platform_favicon");
  const faviconUpload = faviconFile instanceof File ? faviconFile : null;
  const clearFavicon = String(formData.get("clear_favicon") ?? "").trim() === "1";
  const nameRaw = String(formData.get("product_name") ?? "").trim();
  const websiteAdminCode = String(formData.get("website_admin_access_code") ?? "").trim();
  const websiteAdminCodeConfirm = String(formData.get("website_admin_access_code_confirm") ?? "").trim();
  const primaryClinicIdRaw = String(formData.get("primary_clinic_id") ?? "").trim();
  const primaryClinicId = primaryClinicIdRaw || null;
  const websiteStoreEnabledRaw = String(formData.get("website_store_enabled") ?? "").trim().toLowerCase();
  const websiteStoreEnabled =
    websiteStoreEnabledRaw === "true" || websiteStoreEnabledRaw === "on" || websiteStoreEnabledRaw === "1";

  const updatingCode = websiteAdminCode.length > 0 || websiteAdminCodeConfirm.length > 0;
  const hasFaviconUpload = Boolean(faviconUpload && faviconUpload.size > 0);
  if (
    (!file || file.size === 0) &&
    !hasFaviconUpload &&
    !clearFavicon &&
    !nameRaw &&
    !updatingCode &&
    !primaryClinicIdRaw &&
    !websiteStoreEnabledRaw
  ) {
    throw new Error(
      "Enter a product name, choose a PNG logo, upload a square favicon, set primary clinic, toggle website store, and/or update website admin access code.",
    );
  }

  if (updatingCode) {
    if (!websiteAdminCode || !websiteAdminCodeConfirm) {
      throw new Error("Enter and confirm website admin access code.");
    }
    if (websiteAdminCode !== websiteAdminCodeConfirm) {
      throw new Error("Website admin access code confirmation does not match.");
    }
    if (!/^\d{4,12}$/.test(websiteAdminCode)) {
      throw new Error("Website admin access code must be 4-12 digits.");
    }
  }

  const supabase = createClient();

  const { data: existing, error: existingError } = await supabase
    .from("platform_branding")
    .select("product_name, logo_url, favicon_url, primary_clinic_id, website_store_enabled")
    .eq("id", "default")
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  let nextLogo = (existing?.logo_url as string | null) ?? null;
  let nextFavicon = clearFavicon ? null : ((existing?.favicon_url as string | null) ?? null);

  if (file && file.size > 0) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".png")) {
      throw new Error("Please upload a PNG file.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("clinic-assets")
      .upload(PLATFORM_LOGO_PATH, bytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrl } = supabase.storage.from("clinic-assets").getPublicUrl(PLATFORM_LOGO_PATH);
    const url = publicUrl.publicUrl;
    nextLogo = url;
  }

  if (faviconUpload && faviconUpload.size > 0) {
    const lower = faviconUpload.name.toLowerCase();
    if (!lower.endsWith(".png")) {
      throw new Error("Favicon must be a PNG file.");
    }

    const bytes = new Uint8Array(await faviconUpload.arrayBuffer());
    const validation = validateSquarePngUpload(bytes);
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    const { error: uploadError } = await supabase.storage
      .from("clinic-assets")
      .upload(PLATFORM_FAVICON_PATH, bytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrl } = supabase.storage.from("clinic-assets").getPublicUrl(PLATFORM_FAVICON_PATH);
    nextFavicon = `${publicUrl.publicUrl}?v=${Date.now()}`;
  }

  const nextName =
    nameRaw ||
    (typeof existing?.product_name === "string" ? existing.product_name : null) ||
    "GreenCoatVets";

  const { error } = await supabase.from("platform_branding").upsert(
    {
      id: "default",
      product_name: nextName,
      logo_url: nextLogo,
      favicon_url: nextFavicon,
      primary_clinic_id:
        primaryClinicId ??
        ((existing as { primary_clinic_id?: string | null } | null)?.primary_clinic_id ?? null),
      website_admin_access_code: updatingCode
        ? websiteAdminCode
        : ((existing as { website_admin_access_code?: string | null } | null)?.website_admin_access_code ?? "15072005"),
      website_store_enabled:
        websiteStoreEnabledRaw
          ? websiteStoreEnabled
          : ((existing as { website_store_enabled?: boolean | null } | null)?.website_store_enabled ?? true),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/super-admin");
  revalidatePath("/login");
  revalidatePath("/signup");
  revalidatePath("/", "layout");
}

export async function refreshUsersFromRegistryAsSuperAdmin() {
  await assertSuperAdmin();
  const supabase = createClient();
  const { error } = await supabase.rpc("super_admin_refresh_user_registry");
  if (error) throw new Error(error.message);
  revalidatePath("/super-admin");
  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  revalidatePath("/owners");
  revalidatePath("/clinic-profile");
}

export type SuperAdminAppUserRow = {
  id: string;
  email: string | null;
  created_at: string;
};

export async function listAppUsersForSuperAdmin(): Promise<SuperAdminAppUserRow[]> {
  await assertSuperAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, email, created_at")
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) throw new Error(error.message);
  return (data ?? []) as SuperAdminAppUserRow[];
}

export async function listClinicsMinimalForSuperAdmin(): Promise<Array<{ id: string; name: string }>> {
  await assertSuperAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clinics")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ id: string; name: string }>;
}

export async function superAdminAssignUserToClinicAction(formData: FormData) {
  let errorMessage: string | null = null;
  let warningMessage: string | null = null;

  try {
    await assertSuperAdmin();
    const clinicId = String(formData.get("clinic_id") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "").trim();
    const fullName = String(formData.get("full_name") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const workingHours = String(formData.get("working_hours") ?? "").trim() || null;
    const confirm = String(formData.get("confirm_assign") ?? "") === "on";
    if (!clinicId || !email || !role) throw new Error("Clinic, email and role are required.");
    if (!confirm) throw new Error("Confirm this assignment.");

    const supabase = createClient();
    const { data: uid, error: lookErr } = await supabase.rpc("lookup_user_id_for_clinic_assignment", {
      p_clinic_id: clinicId,
      p_email: email,
    });
    if (lookErr) throw new Error(lookErr.message);
    let targetUserId = uid as string | null;
    let createdUserId: string | null = null;
    if (!targetUserId) {
      const created = await provisionUserAccountForAdmin({
        email,
        password,
        fullName,
        phone,
      });
      targetUserId = created.userId;
      createdUserId = created.userId;
    }
    if (!targetUserId) throw new Error("Unable to resolve a user for this email.");

    const { error } = await supabase.rpc("assign_user_to_clinic_by_admin", {
      p_target_user_id: targetUserId,
      p_clinic_id: clinicId,
      p_role: role,
      p_staff_full_name: fullName,
      p_staff_phone: phone,
      p_working_hours: role === "doctor" || role === "junior_doctor" || role === "senior_doctor" ? workingHours : null,
    });
    if (error) {
      if (createdUserId) {
        await rollbackProvisionedUser(createdUserId);
      }
      throw new Error(error.message);
    }

    if (createdUserId) {
      try {
        const result = await sendAdminCreatedPortalCredentialsEmail({
          email,
          fullName: fullName || email,
          password,
          accessKind: getAccessKind(role),
          roleLabel: formatRoleLabel(role),
        });
        if (!result.sent) {
          warningMessage =
            "The account was created, but the welcome email with login credentials could not be sent. Share the email/password manually. Website editors sign in at /admin/login and must set a new password on first login.";
        }
      } catch {
        warningMessage =
          "The account was created, but the welcome email with login credentials could not be sent. Share the email/password manually and ask them to change it from My profile after login.";
      }
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Could not assign that user.";
  }

  if (errorMessage) {
    redirect(`/super-admin/users?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/super-admin/users");
  revalidatePath("/team");
  const params = new URLSearchParams({ saved: "1" });
  if (warningMessage) {
    params.set("warning", warningMessage);
  }
  redirect(`/super-admin/users?${params.toString()}`);
}

export async function superAdminDeactivateUserEverywhereAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await assertSuperAdmin();
    const targetId = String(formData.get("target_user_id") ?? "").trim();
    const confirmPhrase = String(formData.get("confirm_deactivate_text") ?? "")
      .trim()
      .toLowerCase();
    if (!targetId) throw new Error("User is required.");
    if (confirmPhrase !== "confirm") throw new Error('Type "confirm" to deactivate this user everywhere.');

    const supabase = createClient();
    const { error } = await supabase.rpc("super_admin_deactivate_user_everywhere", {
      p_user_id: targetId,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Could not deactivate that user.";
  }

  if (errorMessage) {
    redirect(`/super-admin/users?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/super-admin/users");
  revalidatePath("/super-admin");
  redirect("/super-admin/users?deactivated=1");
}

export async function superAdminDeleteUserFromDatabaseAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await assertSuperAdmin();
    const targetId = String(formData.get("target_user_id") ?? "").trim();
    const confirmPhrase = String(formData.get("confirm_delete_text") ?? "")
      .trim()
      .toLowerCase();
    if (!targetId) throw new Error("User is required.");
    if (confirmPhrase !== "confirm") throw new Error('Type "confirm" to delete this user from the database.');

    const supabase = createClient();
    const { error } = await supabase.rpc("super_admin_delete_user_from_database", {
      p_user_id: targetId,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Could not delete that user.";
  }

  if (errorMessage) {
    redirect(`/super-admin/users?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/super-admin/users");
  revalidatePath("/super-admin");
  redirect("/super-admin/users?deleted=1");
}

export async function superAdminSendPasswordResetAction(formData: FormData) {
  let errorMessage: string | null = null;
  let warningMessage: string | null = null;

  try {
    await assertSuperAdmin();
    const email = String(formData.get("email") ?? "").trim();
    if (!email) throw new Error("Email is required.");

    const result = await sendPortalPasswordResetLink(email);
    if (!result.ok) {
      throw new Error(result.error);
    }
    if (!result.sent) {
      if (result.reason === "no_user") {
        throw new Error("No portal account found for that email.");
      }
      warningMessage = "Could not send the reset email. Check SMTP settings or try again.";
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Could not send password reset email.";
  }

  if (errorMessage) {
    redirect(`/super-admin/users?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/super-admin/users");
  const params = new URLSearchParams({ reset_sent: "1" });
  if (warningMessage) {
    params.set("warning", warningMessage);
  }
  redirect(`/super-admin/users?${params.toString()}`);
}

export async function superAdminDeleteOwnersAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    await assertSuperAdmin();
    const clinicId = String(formData.get("clinic_id") ?? "").trim();
    const ownerIds = formData.getAll("owner_ids").map((v) => String(v).trim()).filter(Boolean);
    const confirmPhrase = String(formData.get("confirm_delete_text") ?? "")
      .trim()
      .toLowerCase();

    if (!clinicId) throw new Error("Clinic is required.");
    if (!ownerIds.length) throw new Error("Select at least one client to delete.");
    if (confirmPhrase !== "confirm") throw new Error('Type "confirm" to permanently delete selected clients.');

    const supabase = createClient();
    const { data, error } = await supabase.rpc("super_admin_delete_owners", {
      p_clinic_id: clinicId,
      p_owner_ids: ownerIds,
    });
    if (error) throw new Error(error.message);

    const result = (data ?? {}) as { owner_count?: number };
    if (!result.owner_count) throw new Error("No clients were deleted.");
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Could not delete selected clients.";
  }

  if (errorMessage) {
    redirect(`/owners?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/owners");
  revalidatePath("/pets");
  revalidatePath("/appointments");
  revalidatePath("/medical-records");
  redirect("/owners?deleted=1");
}
