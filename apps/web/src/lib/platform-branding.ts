import { cache } from "react";
import { fetchPlatformBranding, type PlatformBranding } from "@saasclinics/lib";
import { createClient } from "@/lib/supabase/server";

export type { PlatformBranding };

export const getPlatformBranding = cache(async (): Promise<PlatformBranding> => {
  const supabase = createClient();
  return fetchPlatformBranding(supabase);
});
