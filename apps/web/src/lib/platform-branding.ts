import { cache } from "react";
import { unstable_cache } from "next/cache";
import { fetchPlatformBranding, type PlatformBranding } from "@saasclinics/lib";
import { createPublicClient } from "@/lib/supabase/public";

export type { PlatformBranding };

const getCachedPlatformBranding = unstable_cache(
  async (): Promise<PlatformBranding> => {
    const supabase = createPublicClient();
    return fetchPlatformBranding(supabase);
  },
  ["platform-branding-default-v1"],
  { revalidate: 300 },
);

/** Deduped per request + cached across requests for ~5 minutes. */
export const getPlatformBranding = cache(async (): Promise<PlatformBranding> => {
  return getCachedPlatformBranding();
});
