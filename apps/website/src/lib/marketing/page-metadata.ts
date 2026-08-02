import { clinicMetadata } from "@/lib/seo/clinic-metadata";
import { applyClinicPlaceholders } from "./page-content";
import { getMergedPageContent } from "./get-marketing-site";
import type { MarketingPageSlug } from "./page-content";

/** build generateMetadata() for a CMS-backed marketing page. */
export async function marketingPageMetadata(input: {
  slug: MarketingPageSlug;
  clinicName: string;
  path: string;
}) {
  const page = await getMergedPageContent(input.slug);
  return clinicMetadata({
    clinicName: input.clinicName,
    title: applyClinicPlaceholders(page.seo_title, input.clinicName),
    description: applyClinicPlaceholders(page.seo_description, input.clinicName),
    path: input.path,
    ogImageUrl: page.og_image_url || null,
  });
}
