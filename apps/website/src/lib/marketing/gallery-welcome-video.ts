/** Parse admin textarea (one URL per line) into a clean list of HTTPS image URLs. */
export function parseGalleryImageUrlsBlock(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const url = line.trim();
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
    if (out.length >= 24) break;
  }
  return out;
}

/**
 * Turn a YouTube / Vimeo / direct video URL into an embeddable iframe src when possible.
 * Returns null for empty/invalid input. Direct .mp4/.webm links are returned as-is for <video>.
 */
export function resolveWelcomeVideoEmbed(raw: string | null | undefined): {
  kind: "iframe" | "video";
  src: string;
} | null {
  const url = raw?.trim() ?? "";
  if (!url || !/^https?:\/\//i.test(url)) return null;

  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    // YouTube
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return { kind: "iframe", src: `https://www.youtube.com/embed/${encodeURIComponent(id)}` };
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v) return { kind: "iframe", src: `https://www.youtube.com/embed/${encodeURIComponent(v)}` };
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" && parts[1]) {
        return { kind: "iframe", src: `https://www.youtube.com/embed/${encodeURIComponent(parts[1])}` };
      }
      if (parts[0] === "shorts" && parts[1]) {
        return { kind: "iframe", src: `https://www.youtube.com/embed/${encodeURIComponent(parts[1])}` };
      }
    }

    // Vimeo
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).find((p) => /^\d+$/.test(p));
      if (id) return { kind: "iframe", src: `https://player.vimeo.com/video/${id}` };
    }

    // Direct media
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(u.pathname)) {
      return { kind: "video", src: url };
    }

    // Fallback: treat as iframe-capable (e.g. already an embed URL)
    if (u.pathname.includes("/embed") || host.includes("player.")) {
      return { kind: "iframe", src: url };
    }

    return { kind: "iframe", src: url };
  } catch {
    return null;
  }
}
