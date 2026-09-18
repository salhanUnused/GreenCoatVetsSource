"use server";

import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

/** Thin helper — no PDF/OCR imports. Does not revalidate (avoids remounting open visit forms). */
export async function ensurePrescriptionForVisit(visitId: string): Promise<string> {
  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("visit_id", visitId)
    .eq("clinic_id", clinic_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: visit, error: vErr } = await supabase
    .from("visits")
    .select("id, clinic_id, branch_id, pet_id, doctor_id")
    .eq("id", visitId)
    .eq("clinic_id", clinic_id)
    .single();

  if (vErr) throw new Error(vErr.message);

  const { data: created, error: cErr } = await supabase
    .from("prescriptions")
    .insert({
      clinic_id: visit.clinic_id,
      branch_id: visit.branch_id,
      visit_id: visit.id,
      pet_id: visit.pet_id,
      doctor_id: visit.doctor_id,
      notes: null,
    })
    .select("id")
    .single();

  if (cErr) throw new Error(cErr.message);

  return created.id;
}
