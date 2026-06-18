import { fetchTabIconResponse } from "@saasclinics/lib";
import { getWebsiteFaviconUrl } from "@/lib/marketing/website-favicon";

export const dynamic = "force-dynamic";

export default async function Icon() {
  return fetchTabIconResponse(await getWebsiteFaviconUrl());
}
