import type { MetadataRoute } from "next";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { isWebsiteStoreEnabled } from "@/lib/store/store-availability";
import { createClient } from "@/lib/supabase/server";

export async function buildMarketingSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const clinic = await resolveClinic();
  const supabase = createClient();
  const storeEnabled = await isWebsiteStoreEnabled();

  const [{ data: services }, { data: blogRows }, { data: products }] = await Promise.all([
    supabase.from("services").select("slug, updated_at").eq("clinic_id", clinic.id).eq("is_active", true),
    supabase.rpc("get_public_blog_posts", { p_clinic_id: clinic.id, p_limit: 200 }),
    storeEnabled
      ? supabase.from("products").select("slug, updated_at").eq("clinic_id", clinic.id).eq("is_active", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const blogs = Array.isArray(blogRows)
    ? blogRows.map((row: { slug: string; published_at?: string | null }) => ({
        slug: row.slug,
        updated_at: row.published_at ?? null,
      }))
    : [];

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: "/", changeFrequency: "daily", priority: 1 },
    { url: "/about", changeFrequency: "monthly", priority: 0.7 },
    { url: "/community", changeFrequency: "monthly", priority: 0.7 },
    { url: "/contact", changeFrequency: "monthly", priority: 0.7 },
    { url: "/locations", changeFrequency: "monthly", priority: 0.8 },
    { url: "/services", changeFrequency: "weekly", priority: 0.8 },
    { url: "/doctors", changeFrequency: "weekly", priority: 0.8 },
    { url: "/team", changeFrequency: "monthly", priority: 0.7 },
    { url: "/faq", changeFrequency: "monthly", priority: 0.7 },
    { url: "/blog", changeFrequency: "daily", priority: 0.8 },
    { url: "/book", changeFrequency: "daily", priority: 0.9 },
  ];
  if (storeEnabled) {
    staticRoutes.push({ url: "/store", changeFrequency: "daily", priority: 0.8 });
  }

  const serviceRoutes =
    services?.map((service) => ({
      url: `/services/${service.slug}`,
      lastModified: service.updated_at ? new Date(service.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })) ?? [];

  const blogRoutes = blogs.map((blog) => ({
    url: `/blog/${blog.slug}`,
    lastModified: blog.updated_at ? new Date(blog.updated_at) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  const productRoutes =
    products?.map((product) => ({
      url: `/product/${product.slug}`,
      lastModified: product.updated_at ? new Date(product.updated_at) : undefined,
      changeFrequency: "daily" as const,
      priority: 0.75,
    })) ?? [];

  return [...staticRoutes, ...serviceRoutes, ...blogRoutes, ...productRoutes];
}

export function sitemapEntriesToXml(baseUrl: string, entries: MetadataRoute.Sitemap): string {
  const origin = baseUrl.replace(/\/$/, "");
  const urls = entries
    .map((entry) => {
      const loc = entry.url.startsWith("http") ? entry.url : `${origin}${entry.url}`;
      const lastmod = entry.lastModified
        ? `<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>`
        : "";
      const changefreq = entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : "";
      const priority = entry.priority != null ? `<priority>${entry.priority}</priority>` : "";
      return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    ${lastmod}\n    ${changefreq}\n    ${priority}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
