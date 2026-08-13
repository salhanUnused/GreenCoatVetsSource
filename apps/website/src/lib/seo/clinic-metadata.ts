import type { Metadata } from "next";

export function clinicMetadata(input: {
  clinicName: string;
  title: string;
  description: string;
  path?: string;
  /** Optional Open Graph / Twitter image URL from CMS. */
  ogImageUrl?: string | null;
}): Metadata {
  const { clinicName, title, description, path = "/", ogImageUrl } = input;
  const og = typeof ogImageUrl === "string" ? ogImageUrl.trim() : "";
  const images = /^https?:\/\//i.test(og) ? [{ url: og }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      siteName: clinicName,
      type: "website",
      url: path,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(images ? { images: images.map((i) => i.url) } : {}),
    },
    robots: { index: true, follow: true },
  };
}
