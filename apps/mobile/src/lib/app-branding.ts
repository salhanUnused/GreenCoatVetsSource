import { supabase } from "./supabase";

export type AppBranding = {
  product_name: string;
  logo_url: string | null;
};

const APP_NAME = "GreenCoatVets";

/** In-app branding: fixed name + website favicon (marketing admin), then portal logo fallback. */
export async function loadAppBranding(): Promise<AppBranding> {
  const [{ data: marketing }, { data: platform }] = await Promise.all([
    supabase.from("marketing_site_settings").select("website_favicon_url").eq("id", "default").maybeSingle(),
    supabase.from("platform_branding").select("logo_url, favicon_url").eq("id", "default").maybeSingle(),
  ]);

  const websiteFavicon = (marketing?.website_favicon_url as string | null | undefined)?.trim() || null;
  const platformLogo = (platform?.logo_url as string | null | undefined)?.trim() || null;
  const platformFavicon = (platform?.favicon_url as string | null | undefined)?.trim() || null;

  return {
    product_name: APP_NAME,
    logo_url: websiteFavicon || platformLogo || platformFavicon,
  };
}
