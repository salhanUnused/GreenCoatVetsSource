import { cache } from "react";
import { redirect } from "next/navigation";
import { hasValidPortalOtpCookie } from "@/lib/auth/portal-email-otp";
import { createClient } from "@/lib/supabase/server";

export type UserAccess = {
  userId: string;
  isSuperAdmin: boolean;
  membership: {
    clinic_id: string;
    role: string;
  } | null;
};

export const getUserAccess = cache(async (): Promise<UserAccess> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const otpVerified = await hasValidPortalOtpCookie(user.id);
  if (!otpVerified) {
    redirect("/login/verify-email");
  }

  const [{ data: superAdmin }, { data: membership }] = await Promise.all([
    supabase
      .from("platform_super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("user_clinic_memberships")
      .select("clinic_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Membership role should win over legacy platform flag when a clinic role is active.
  // This prevents stale global-admin access after role changes in Supabase.
  const isSuperAdmin = Boolean(superAdmin) && (!membership || membership.role === "super_admin");

  const normalizedMembership =
    membership?.role === "senior_doctor" ? { ...membership, role: "doctor" } : membership;

  return {
    userId: user.id,
    isSuperAdmin,
    membership: normalizedMembership,
  };
});
