"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { provisionUserAccountForAdmin, rollbackProvisionedUser } from "@/lib/auth/provision-user-account";
import { sendPortalPasswordResetLink } from "@/lib/auth/send-portal-password-reset";
import { sendAdminCreatedPortalCredentialsEmail } from "@/lib/email/send-welcome-email";
import { createClient } from "@/lib/supabase/server";

export type TeamMemberRow = {
  user_id: string;
  email: string;
  role: string;
  is_active: boolean;
  updated_at: string | null;
};

function formatRoleLabel(role: string) {
  return role.replace(/_/g, " ");
}

function getAccessKind(role: string): "website" | "web" {
  return role === "marketing_editor" || role === "pet_owner" ? "website" : "web";
}

export async function getClinicTeamMembers(): Promise<TeamMemberRow[]> {
  const access = await getUserAccess();
  if (access.membership?.role !== "clinic_admin") {
    throw new Error("Only clinic administrators can view this page.");
  }
  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_clinic_team_members", { p_clinic_id: clinic_id });
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMemberRow[];
}

export async function assignUserToClinicAction(formData: FormData) {
  let errorMessage: string | null = null;
  let warningMessage: string | null = null;

  try {
    const access = await getUserAccess();
    if (access.membership?.role !== "clinic_admin") {
      throw new Error("Not allowed.");
    }
    const { clinic_id } = await getActiveMembership();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "").trim() as
      | "branch_admin"
      | "doctor"
      | "junior_doctor"
      | "senior_doctor"
      | "manager"
      | "junior"
      | "marketing_editor"
      | "receptionist"
      | "lab_technician"
      | "pharmacist"
      | "pet_owner";
    const fullName = String(formData.get("full_name") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const workingHours = String(formData.get("working_hours") ?? "").trim() || null;
    const confirm = String(formData.get("confirm_assign") ?? "") === "on";
    if (!email || !role) throw new Error("Email and role are required.");
    if (!confirm) throw new Error("Confirm assigning this role.");

    const supabase = createClient();
    const { data: userId, error: lookErr } = await supabase.rpc("lookup_user_id_for_clinic_assignment", {
      p_clinic_id: clinic_id,
      p_email: email,
    });
    if (lookErr) throw new Error(lookErr.message);
    let uid = userId as string | null;
    let createdUserId: string | null = null;

    if (!uid) {
      const created = await provisionUserAccountForAdmin({
        email,
        password,
        fullName,
        phone,
      });
      uid = created.userId;
      createdUserId = created.userId;
    }
    if (!uid) throw new Error("Unable to resolve a user for this email.");

    const { error } = await supabase.rpc("assign_user_to_clinic_by_admin", {
      p_target_user_id: uid,
      p_clinic_id: clinic_id,
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
    redirect(`/team?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/team");
  const params = new URLSearchParams({ saved: "1" });
  if (warningMessage) {
    params.set("warning", warningMessage);
  }
  redirect(`/team?${params.toString()}`);
}

export async function removeUserFromClinicAction(formData: FormData) {
  let errorMessage: string | null = null;

  try {
    const access = await getUserAccess();
    if (access.membership?.role !== "clinic_admin") {
      throw new Error("Not allowed.");
    }
    const { clinic_id } = await getActiveMembership();
    const targetId = String(formData.get("target_user_id") ?? "").trim();
    const confirm = String(formData.get("confirm_remove") ?? "") === "on";
    if (!targetId) throw new Error("User is required.");
    if (!confirm) throw new Error("Confirm removing access.");

    const supabase = createClient();
    const { error } = await supabase.rpc("deactivate_user_clinic_membership_by_admin", {
      p_target_user_id: targetId,
      p_clinic_id: clinic_id,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Could not remove that user from the clinic.";
  }

  if (errorMessage) {
    redirect(`/team?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/team");
  redirect("/team?removed=1");
}

export async function sendTeamMemberPasswordResetAction(formData: FormData) {
  let errorMessage: string | null = null;
  let warningMessage: string | null = null;

  try {
    const access = await getUserAccess();
    if (access.membership?.role !== "clinic_admin") {
      throw new Error("Not allowed.");
    }

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
    redirect(`/team?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/team");
  const params = new URLSearchParams({ reset_sent: "1" });
  if (warningMessage) {
    params.set("warning", warningMessage);
  }
  redirect(`/team?${params.toString()}`);
}
