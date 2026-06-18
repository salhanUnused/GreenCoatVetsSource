import { supabase } from "./supabase";

/** Link new mobile sign-ups to the same default clinic as the marketing website. */
export async function ensurePrimaryClinicMembership(
  fullName?: string | null,
  phone?: string | null,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("ensure_primary_clinic_customer_membership", {
    p_full_name: fullName?.trim() || null,
    p_phone: phone?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}
