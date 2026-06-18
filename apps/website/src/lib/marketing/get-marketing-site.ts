import { createClient } from "@/lib/supabase/server";
import { DEFAULT_MARKETING_LOCATIONS, isSuppressedPublicLocation } from "./default-locations";
import {
  DEFAULT_HOMEPAGE_COPY,
  DEFAULT_HOMEPAGE_IMAGES,
  type HomepageCopy,
  type HomepageImageKey,
  type SocialLinks,
} from "./defaults";
import type { MarketingSeoSettings } from "./seo-types";
import { EMPTY_SEO_SETTINGS } from "./seo-types";
import type { MarketingLocationPublic } from "./types";
import { resolveMarketingImageUrl } from "./resolve-marketing-image-url";

export type MarketingSiteSettingsRow = {
  /** When no host match, used after `website_branded_for_clinic_id` is tried. */
  default_clinic_id: string | null;
  /** When no host match, preferred for branding / resolveClinic() before `default_clinic_id`. */
  website_branded_for_clinic_id: string | null;
  /** Super admin: receives public contact form emails (SMTP). */
  contact_form_recipient_email: string | null;
  homepage_images: Record<string, string>;
  social_links: SocialLinks;
  homepage_copy: HomepageCopy;
  /** Canonical Instagram post/reel permalinks for homepage embeds. */
  instagram_embed_urls: string[];
  seo_settings: MarketingSeoSettings;
  website_favicon_url: string | null;
};

const EMPTY: MarketingSiteSettingsRow = {
  default_clinic_id: null,
  website_branded_for_clinic_id: null,
  contact_form_recipient_email: null,
  homepage_images: {},
  social_links: {},
  homepage_copy: {},
  instagram_embed_urls: [],
  seo_settings: { ...EMPTY_SEO_SETTINGS },
  website_favicon_url: null,
};

export async function getMarketingSiteSettings(): Promise<MarketingSiteSettingsRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketing_site_settings")
    .select(
      "default_clinic_id, website_branded_for_clinic_id, contact_form_recipient_email, homepage_images, social_links, homepage_copy, instagram_embed_urls, seo_settings, website_favicon_url",
    )
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) {
    return { ...EMPTY };
  }

  const rawEmbeds = (data as { instagram_embed_urls?: unknown }).instagram_embed_urls;
  const instagram_embed_urls = Array.isArray(rawEmbeds)
    ? rawEmbeds.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    : [];

  const rawSeo = (data as { seo_settings?: MarketingSeoSettings | null }).seo_settings;
  const seo_settings: MarketingSeoSettings =
    rawSeo && typeof rawSeo === "object" ? { ...EMPTY_SEO_SETTINGS, ...rawSeo } : { ...EMPTY_SEO_SETTINGS };

  return {
    default_clinic_id: data.default_clinic_id as string | null,
    website_branded_for_clinic_id: (data as { website_branded_for_clinic_id?: string | null })
      .website_branded_for_clinic_id ?? null,
    contact_form_recipient_email:
      ((data as { contact_form_recipient_email?: string | null }).contact_form_recipient_email as string | null)?.trim() ||
      null,
    homepage_images: (data.homepage_images as Record<string, string>) ?? {},
    social_links: (data.social_links as SocialLinks) ?? {},
    homepage_copy: ((data as { homepage_copy?: HomepageCopy | null }).homepage_copy as HomepageCopy) ?? {},
    instagram_embed_urls,
    seo_settings,
    website_favicon_url: ((data as { website_favicon_url?: string | null }).website_favicon_url as string | null)?.trim() || null,
  };
}

export function mergeHomepageImages(db: Record<string, string>): Record<HomepageImageKey, string> {
  const out = { ...DEFAULT_HOMEPAGE_IMAGES };
  for (const key of Object.keys(DEFAULT_HOMEPAGE_IMAGES) as HomepageImageKey[]) {
    const v = resolveMarketingImageUrl(db[key]);
    if (v) (out as Record<string, string>)[key] = v;
  }
  return out;
}

/** Resolved headline / tagline / call CTA for the public homepage. */
export function mergeHomepageCopy(db: HomepageCopy) {
  const line1 = db.hero_line1?.trim() || DEFAULT_HOMEPAGE_COPY.hero_line1;
  const gradient = db.hero_gradient?.trim() || DEFAULT_HOMEPAGE_COPY.hero_gradient;
  const tagline = db.hero_tagline?.trim() || DEFAULT_HOMEPAGE_COPY.hero_tagline;
  const callDisplay = db.navbar_call_display?.trim() || "";
  const callTelHref = db.navbar_call_tel_href?.trim() || "";
  return { line1, gradient, tagline, callDisplay, callTelHref };
}

/** Unique hero image URLs for the homepage slider (primary hero + optional extra slides). */
export function buildHeroSlideUrls(merged: Record<HomepageImageKey, string>, db: Record<string, string>): string[] {
  const primary = merged.hero;
  const extra = [resolveMarketingImageUrl(db.hero_slide_2), resolveMarketingImageUrl(db.hero_slide_3)].filter(
    Boolean,
  ) as string[];
  const urls = [primary, ...extra];
  const seen = new Set<string>();
  return urls.filter((u) => {
    if (!u || seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

export async function getMarketingLocations(): Promise<MarketingLocationPublic[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketing_locations")
    .select("id, name, address_lines, phone_display, tel_href, hours_label, directions_url, latitude, longitude")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data?.length) {
    return [];
  }

  return data
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      addressLines: Array.isArray(row.address_lines) ? (row.address_lines as string[]) : [],
      phoneDisplay: (row.phone_display as string) ?? "",
      telHref: (row.tel_href as string) ?? "",
      hoursLabel: (row.hours_label as string) ?? "",
      directionsUrl: (row.directions_url as string | null) ?? null,
      latitude: (() => {
        const n = typeof row.latitude === "number" ? row.latitude : Number(row.latitude);
        return Number.isFinite(n) ? n : null;
      })(),
      longitude: (() => {
        const n = typeof row.longitude === "number" ? row.longitude : Number(row.longitude);
        return Number.isFinite(n) ? n : null;
      })(),
    }))
    .filter((row) => !isSuppressedPublicLocation(row));
}

export async function getMarketingLocationsOrDefaults(): Promise<MarketingLocationPublic[]> {
  const rows = await getMarketingLocations();
  if (rows.length > 0) return rows;
  return DEFAULT_MARKETING_LOCATIONS.filter((row) => !isSuppressedPublicLocation(row));
}

export type { MarketingLocationPublic } from "./types";
