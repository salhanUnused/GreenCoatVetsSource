import { cache } from "react";
import { headers } from "next/headers";
import { createPublicClient } from "@/lib/supabase/public";
import { getMarketingSiteSettings } from "@/lib/marketing/get-marketing-site";

type Clinic = {
  id: string;
  name: string;
  slug: string;
  website_store_enabled?: boolean;
};

/** Used when no row exists in `clinics` (empty DB, RLS, or migration not applied). Keeps the marketing site from 500ing. */
function placeholderClinic(): Clinic {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[resolveClinic] No active clinic in database — using placeholder. Seed a clinic or apply migrations (see marketing_site_settings / clinics RLS).",
    );
  }
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: process.env.NEXT_PUBLIC_FALLBACK_CLINIC_NAME ?? "GreenCoatVets",
    slug: process.env.NEXT_PUBLIC_FALLBACK_CLINIC_SLUG ?? "greencoatvets",
  };
}

function normalizeHost(raw: string): string {
  return raw.split(":")[0]?.toLowerCase() ?? "";
}

/** True when host can be matched to custom_domain / subdomain (not bare localhost / LAN without domain). */
function canMatchHostRouting(hostNoPort: string): boolean {
  if (!hostNoPort) return false;
  if (hostNoPort === "localhost" || hostNoPort === "127.0.0.1") return false;
  // e.g. clinic.example.com or vercel.app preview — need a dot to separate subdomain
  return hostNoPort.includes(".");
}

export const resolveClinic = cache(async (): Promise<Clinic> => {
  const supabase = createPublicClient();
  const hostRaw = headers().get("host") ?? "";
  const host = normalizeHost(hostRaw);
  const subdomain = host.split(".")[0];

  /** Only query by domain/subdomain when we are not on a bare dev host; otherwise we'd hit `.limit(1)` and return the wrong clinic. */
  if (canMatchHostRouting(host)) {
    const { data: clinic, error: hostMatchError } = await supabase
      .from("clinics")
      .select("id, name, slug, website_store_enabled")
      .eq("is_active", true)
      .or(`custom_domain.eq.${hostRaw.split(":")[0]},subdomain.eq.${subdomain}`)
      .maybeSingle();

    if (hostMatchError && process.env.NODE_ENV === "development") {
      console.warn("[resolveClinic] Host/subdomain match:", hostMatchError.message);
    }

    if (clinic) return clinic;
  }

  const mkt = await getMarketingSiteSettings();
  const brandedId = mkt.website_branded_for_clinic_id;
  if (brandedId) {
    const { data: byBranded } = await supabase
      .from("clinics")
      .select("id, name, slug, website_store_enabled")
      .eq("id", brandedId)
      .eq("is_active", true)
      .maybeSingle();
    if (byBranded) return byBranded;
  }

  if (mkt.default_clinic_id) {
    const { data: byDefault } = await supabase
      .from("clinics")
      .select("id, name, slug, website_store_enabled")
      .eq("id", mkt.default_clinic_id)
      .eq("is_active", true)
      .maybeSingle();
    if (byDefault) return byDefault;
  }

  const { data: fallback } = await supabase
    .from("clinics")
    .select("id, name, slug, website_store_enabled")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallback) return fallback;

  return placeholderClinic();
});
