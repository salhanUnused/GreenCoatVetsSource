import { cache } from "react";
import { redirect } from "next/navigation";
import { getUserAccess } from "./get-user-access";
import { createClient } from "@/lib/supabase/server";

type Membership = {
  clinic_id: string;
  role: string;
};

export const getActiveMembership = cache(async (): Promise<Membership> => {
  const access = await getUserAccess();
  if (access.membership) {
    return access.membership;
  }
  if (access.isSuperAdmin) {
    const supabase = createClient();
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (clinic?.id) {
      return {
        clinic_id: clinic.id,
        role: "super_admin",
      };
    }
    redirect("/super-admin");
  }
  if (!access.membership) {
    redirect("/join-clinic");
  }
  throw new Error("Unexpected access state.");
});
