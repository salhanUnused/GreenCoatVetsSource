import { cache } from "react";
import { fetchPlatformBranding, type PlatformBranding } from "@saasclinics/lib";
import { createPublicClient } from "@/lib/supabase/public";

export type { PlatformBranding };

export const getPlatformBranding = cache(async (): Promise<PlatformBranding> => {
  const supabase = createPublicClient();
  return fetchPlatformBranding(supabase);
});
