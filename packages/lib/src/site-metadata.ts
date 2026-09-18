export type PlatformIconMetadata = {
  icon?: Array<{ url: string; type?: string; sizes?: string }>;
  shortcut?: Array<{ url: string }>;
  apple?: Array<{ url: string; type?: string; sizes?: string }>;
};

/** Brand mark PNGs + paw SVG fallback (files live in each app's `public/`). */
const STATIC_PLATFORM_ICONS: PlatformIconMetadata = {
  icon: [
    { url: "/favicon.ico", sizes: "any" },
    { url: "/favicon.svg", type: "image/svg+xml" },
    { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    { url: "/favicon-48x48.png", type: "image/png", sizes: "48x48" },
  ],
  shortcut: [{ url: "/favicon.ico" }],
  apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
};

/** Static favicons by default; pass uploaded favicon URL from platform control when set. */
export function buildPlatformIcons(customFaviconUrl?: string | null): PlatformIconMetadata {
  const custom = customFaviconUrl?.trim();
  if (!custom) return STATIC_PLATFORM_ICONS;
  return {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: custom, type: "image/png", sizes: "48x48" },
    ],
    shortcut: [{ url: custom }],
    apple: [{ url: custom, type: "image/png", sizes: "180x180" }],
  };
}

/** Marketing website favicon — CMS upload when set; otherwise static brand/paw icons. */
export function buildWebsiteIcons(websiteFaviconUrl?: string | null): PlatformIconMetadata {
  const custom = websiteFaviconUrl?.trim();
  if (!custom) return STATIC_PLATFORM_ICONS;
  return {
    icon: [
      { url: custom, type: "image/png", sizes: "48x48" },
      { url: custom, type: "image/png", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: custom }],
    apple: [{ url: custom, type: "image/png", sizes: "180x180" }],
  };
}

export function resolvePublicSiteUrl(envValue: string | undefined, fallback: string): URL {
  const raw = (envValue ?? fallback).trim().replace(/\/$/, "");
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return new URL(fallback);
  }
}
