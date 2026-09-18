import { fetchPlatformBranding, type PlatformBranding } from "@saasclinics/lib";
import { createClient } from "@/lib/supabase/server";

export type { PlatformBranding };

export async function getPlatformBranding(): Promise<PlatformBranding> {
  const supabase = createClient();
  return fetchPlatformBranding(supabase);
}
