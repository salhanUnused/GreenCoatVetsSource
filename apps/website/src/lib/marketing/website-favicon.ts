import { getMarketingSiteSettings } from "@/lib/marketing/get-marketing-site";

/** Square PNG URL for the marketing website tab icon (independent of web portal branding). */
export async function getWebsiteFaviconUrl(): Promise<string | null> {
  const settings = await getMarketingSiteSettings();
  return settings.website_favicon_url;
}
