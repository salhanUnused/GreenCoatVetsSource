import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pet owners need a row in `public.owners` with `user_id = auth.uid()` (RLS insert policy).
 * Invites sometimes create membership before an owners row exists — create it on demand.
 */
export async function ensurePetOwnerRow(
  supabase: SupabaseClient,
  clinicId: string,
  user: User
): Promise<{ ownerId: string | null; error: Error | null }> {
  const { data: existingRows, error: selErr } = await supabase
    .from("owners")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (selErr) {
    return { ownerId: null, error: new Error(selErr.message) };
  }
  const existing = ((existingRows as Array<{ id: string }> | null) ?? [])[0];
  if (existing?.id) {
    return { ownerId: existing.id, error: null };
  }

  const meta = user.user_metadata as Record<string, string | undefined> | undefined;
  const displayName =
    (meta?.full_name && String(meta.full_name)) ||
    (meta?.name && String(meta.name)) ||
    user.email?.split("@")[0] ||
    "Pet owner";
  const phone =
    (user.phone && String(user.phone)) ||
    (meta?.phone && String(meta.phone)) ||
    "0000000000";

  const { data: created, error: insErr } = await supabase
    .from("owners")
    .insert({
      clinic_id: clinicId,
      user_id: user.id,
      full_name: displayName,
      phone,
      email: user.email ?? null,
    })
    .select("id")
    .single();

  if (insErr) {
    return { ownerId: null, error: new Error(insErr.message) };
  }
  return { ownerId: created?.id ?? null, error: null };
}
