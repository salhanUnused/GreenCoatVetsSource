import Link from "next/link";
import { requireMarketingManager } from "@/lib/admin/auth";
import { getMarketingSiteSettings } from "@/lib/marketing/get-marketing-site";
import { buildMarketingSitemapEntries, sitemapEntriesToXml } from "@/lib/seo/build-sitemap-entries";
import { DEFAULT_PUBLIC_WEBSITE_ORIGIN, getWebsitePublicBaseUrlFromRequest } from "@/lib/seo/public-site-url";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { recordSitemapPingAction, updateMarketingSeoSettings } from "../actions";

export default async function AdminSeoPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireMarketingManager();
  const sp = searchParams ?? {};
  const marketing = await getMarketingSiteSettings();
  const base = await getWebsitePublicBaseUrlFromRequest(marketing.seo_settings);
  const sitemapUrl = `${base}/sitemap.xml`;
  const robotsUrl = `${base}/robots.txt`;
  const entries = await buildMarketingSitemapEntries();
  const xmlPreview = sitemapEntriesToXml(base, entries);
  const googlePingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
  const searchConsoleUrl = "https://search.google.com/search-console";

  const seo = marketing.seo_settings;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">SEO &amp; sitemap</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Keep Google and other search engines up to date with your public marketing site. The sitemap is generated
          automatically from live pages, services, blog posts, and products.
        </p>
      </div>

      {sp.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          SEO settings saved.
        </p>
      ) : null}
      {sp.pinged ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Sitemap ping recorded. Open the Google ping link below if you have not already.
        </p>
      ) : null}
      {sp.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{sp.error}</p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Sitemap URLs</p>
          <p className="mt-2 font-mono text-sm text-slate-800 break-all">{entries.length} pages indexed</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a className="font-semibold text-primary underline" href={sitemapUrl} target="_blank" rel="noreferrer">
                {sitemapUrl}
              </a>
            </li>
            <li>
              <a className="text-slate-600 underline" href={robotsUrl} target="_blank" rel="noreferrer">
                {robotsUrl}
              </a>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn-primary btn-compact inline-flex" href={sitemapUrl} target="_blank" rel="noreferrer">
              Open sitemap.xml
            </a>
            <a className="btn-secondary btn-compact inline-flex" href={googlePingUrl} target="_blank" rel="noreferrer">
              Ping Google
            </a>
            <form action={recordSitemapPingAction}>
              <AdminSubmitButton className="btn-secondary btn-compact" pendingLabel="Saving…">
                Mark ping sent
              </AdminSubmitButton>
            </form>
          </div>
          {seo.last_sitemap_ping_at ? (
            <p className="mt-3 text-xs text-slate-500">
              Last marked ping: {new Date(seo.last_sitemap_ping_at).toLocaleString()}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Google Search Console</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>
              Add your property at{" "}
              <a className="font-semibold text-primary underline" href={searchConsoleUrl} target="_blank" rel="noreferrer">
                Search Console
              </a>
              .
            </li>
            <li>Choose the HTML tag verification method and paste the content value below.</li>
            <li>Submit the sitemap URL: <span className="font-mono text-xs">{sitemapUrl}</span></li>
            <li>Use &quot;Ping Google&quot; after major content updates (blog, services, new pages).</li>
            <li>
              If Google still shows old WordPress pages, use URL Removal in Search Console for outdated URLs, then
              resubmit the sitemap above.
            </li>
          </ol>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:col-span-2">
          <p className="text-xs font-bold uppercase text-amber-800">Replacing an old WordPress site</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-950">
            <li>
              Point DNS for <strong>www.greencoatvets.com</strong> and <strong>greencoatvets.com</strong> to Vercel only
              — cancel or disable the old WordPress host so it cannot serve the domain.
            </li>
            <li>
              Verify the new site in Search Console (HTML tag below). Old WordPress URLs now redirect to the homepage.
            </li>
            <li>
              Submit <span className="font-mono text-xs">{sitemapUrl}</span> and use &quot;Request indexing&quot; on the
              homepage.
            </li>
            <li>
              In Search Console → Removals, temporarily remove outdated WordPress URLs Google still lists (optional,
              speeds up the switch).
            </li>
          </ol>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-primary">Site verification &amp; canonical URL</h2>
        <form action={updateMarketingSeoSettings} className="mt-4 max-w-xl space-y-4">
          <label className="block text-sm">
            <span className="font-semibold text-slate-800">Public site URL</span>
            <input
              className="input mt-1 w-full"
              name="public_site_url"
              type="url"
              placeholder="https://greencoatvets.com"
              defaultValue={seo.public_site_url ?? ""}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Used for absolute sitemap URLs and canonical links. Leave empty to use the live site host or{" "}
              <code className="rounded bg-slate-100 px-1">{DEFAULT_PUBLIC_WEBSITE_ORIGIN}</code> in production.
            </span>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-800">Google site verification (meta content)</span>
            <input
              className="input mt-1 w-full font-mono text-xs"
              name="google_site_verification"
              placeholder="paste verification token from Search Console"
              defaultValue={seo.google_site_verification ?? ""}
            />
          </label>
          <AdminSubmitButton className="btn-primary" pendingLabel="Saving…">
            Save SEO settings
          </AdminSubmitButton>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-headline text-lg font-bold text-primary">Generated sitemap XML</h2>
          <p className="text-xs text-slate-500">Preview — live file is served at /sitemap.xml</p>
        </div>
        <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-100">
          {xmlPreview}
        </pre>
      </section>

      <p className="text-sm text-slate-500">
        <Link href="/admin" className="text-primary underline">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
