import { clearWebsiteFavicon, refreshInstagramEmbedsFromGraph, updateMarketingSettings, updateWebsiteFavicon } from "@/app/admin/(dashboard)/actions";
import { AdminFlashMessages } from "@/components/admin/admin-flash-messages";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { MarketingImageFields } from "@/components/admin/marketing-image-fields";
import { requireMarketingManager } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_HOMEPAGE_COPY, DEFAULT_HOMEPAGE_IMAGES, type HomepageImageKey } from "@/lib/marketing/defaults";
import { getMarketingSiteSettings, mergeHomepageImages } from "@/lib/marketing/get-marketing-site";

const IMG_LABELS: Record<HomepageImageKey, string> = {
  hero: "Hero (homepage)",
  mission_a: "Mission section image A",
  mission_b: "Mission section image B",
  surgery: "Surgery / bento section",
  map_hero: "Locations map strip",
  facility_surgery: "Locations — surgery card",
  facility_calm: "Locations — calm card",
  facility_lab: "Locations — lab card",
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireMarketingManager();
  const saved = searchParams.saved === "1" || searchParams.saved === "true";
  const faviconSaved = searchParams.favicon_saved === "1" || searchParams.favicon_saved === "true";
  const faviconCleared = searchParams.favicon_cleared === "1" || searchParams.favicon_cleared === "true";
  const igSync = searchParams.ig_sync === "1" || searchParams.ig_sync === "true";
  const errorParam = searchParams.error;
  const errorMessage = typeof errorParam === "string" ? errorParam : null;

  const supabase = createClient();
  const { data: clinics } = await supabase.from("clinics").select("id, name, slug").eq("is_active", true).order("name");

  const settings = await getMarketingSiteSettings();
  const { data: igMeta } = await supabase
    .from("marketing_site_settings")
    .select("instagram_embed_synced_at")
    .eq("id", "default")
    .maybeSingle();
  const igSyncedAt = (igMeta as { instagram_embed_synced_at?: string | null } | null)?.instagram_embed_synced_at ?? null;
  const merged = mergeHomepageImages(settings.homepage_images);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-headline text-3xl font-bold">Site &amp; clinic</h1>
        <p className="mt-2 text-slate-600">
          Set which clinic this website is <strong>branded for</strong> and the fallback clinic when no subdomain / custom domain matches. Image URLs
          override the built‑in GreenCoatVets placeholders.
        </p>
      </div>

      <AdminFlashMessages saved={saved || faviconSaved} error={errorMessage} />
      {faviconCleared ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm"
        >
          <span className="material-symbols-outlined shrink-0 text-emerald-600">check_circle</span>
          <p className="font-headline font-bold">Website favicon reset to default paw icon.</p>
        </div>
      ) : null}
      {igSync ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm"
        >
          <span className="material-symbols-outlined shrink-0 text-emerald-600">sync</span>
          <div>
            <p className="font-headline font-bold">Instagram embeds updated</p>
            <p className="mt-0.5 text-emerald-800/90">
              Latest post and reel links were loaded from Instagram. The marketing homepage uses them immediately.
            </p>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-primary">Website favicon (browser tab)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Upload a <strong>square PNG</strong> used only on this marketing website — independent of the clinic web portal favicon.
          Recommended 48×48 or 192×192 pixels. This replaces the default paw icon in browser tabs and Google search over time.
        </p>
        {settings.website_favicon_url ? (
          <div className="mt-4 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={settings.website_favicon_url}
              alt="Current website favicon"
              className="h-16 w-16 rounded-xl border border-slate-200 bg-white object-cover p-1"
            />
            <p className="text-sm text-slate-600">Current favicon is live on the public website.</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Using the built-in GreenCoatVets paw icon.</p>
        )}
        <form action={updateWebsiteFavicon} className="mt-4 flex flex-wrap items-end gap-3" encType="multipart/form-data">
          <div className="min-w-[220px] flex-1">
            <label className="text-xs font-bold uppercase text-slate-500">Upload favicon PNG</label>
            <input
              name="website_favicon"
              type="file"
              accept="image/png"
              required={!settings.website_favicon_url}
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
            />
          </div>
          <AdminSubmitButton pendingLabel="Uploading…" className="rounded-xl bg-primary px-5 py-2.5 font-bold text-white">
            {settings.website_favicon_url ? "Replace favicon" : "Upload favicon"}
          </AdminSubmitButton>
        </form>
        {settings.website_favicon_url ? (
          <form action={clearWebsiteFavicon} className="mt-3">
            <AdminSubmitButton
              pendingLabel="Resetting…"
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700"
            >
              Reset to default paw icon
            </AdminSubmitButton>
          </form>
        ) : null}
      </section>

      <form action={updateMarketingSettings} className="space-y-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Website branding &amp; fallback clinic</h2>
          <p className="mt-1 text-sm text-slate-600">
            When the request <strong>doesn’t</strong> match a clinic <code className="rounded bg-slate-100 px-1">subdomain</code> or{" "}
            <code className="rounded bg-slate-100 px-1">custom_domain</code>, the site resolves the clinic in this order:{" "}
            <strong>Website branded for</strong> → <strong>Default clinic</strong> → first active clinic.
          </p>
          <div className="mt-6 space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="website_branded_for_clinic_id">
                Website branded for
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Primary clinic this deployment represents (name in copy, <code className="rounded bg-slate-50 px-1">resolveClinic()</code>, pet-owner
                signup target when no host match). Optional.
              </p>
              <select
                id="website_branded_for_clinic_id"
                name="website_branded_for_clinic_id"
                defaultValue={settings.website_branded_for_clinic_id ?? ""}
                className="mt-2 w-full max-w-lg rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              >
                <option value="">— Not set (use default clinic below) —</option>
                {(clinics ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="default_clinic_id">
                Default clinic (fallback)
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Used when <strong>Website branded for</strong> is empty and there is no host match.
              </p>
              <select
                id="default_clinic_id"
                name="default_clinic_id"
                defaultValue={settings.default_clinic_id ?? ""}
                className="mt-2 w-full max-w-lg rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              >
                <option value="">— None (use first active clinic) —</option>
                {(clinics ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.slug})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Contact form notifications</h2>
          <p className="mt-1 text-sm text-slate-600">
            Public <code className="rounded bg-slate-100 px-1">/contact</code> and <strong>new appointment requests</strong> (book flow) are emailed
            to the admin inbox when <strong>Hostinger SMTP</strong> is configured. If you set{" "}
            <code className="rounded bg-slate-50 px-1">ADMIN_NOTIFICATION_EMAIL</code> in Vercel, that address is used first. Otherwise this field,
            then the clinic&apos;s <code className="rounded bg-slate-50 px-1">support_email</code>.
          </p>
          <div className="mt-6 max-w-xl">
            <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="contact_form_recipient_email">
              Inbox (super admin)
            </label>
            <input
              id="contact_form_recipient_email"
              name="contact_form_recipient_email"
              type="email"
              autoComplete="email"
              defaultValue={settings.contact_form_recipient_email ?? ""}
              placeholder="you@yourclinic.com"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Homepage headline &amp; header phone</h2>
          <p className="mt-1 text-sm text-slate-600">
            Edits the <strong>hero text</strong> on the public home page and the <strong>Call now</strong> chip in the site header (every page).
            Leave a field empty to use the built‑in default for that line.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="copy_hero_line1">
                Hero — first line
              </label>
              <p className="mt-0.5 text-xs text-slate-500">Default: &ldquo;{DEFAULT_HOMEPAGE_COPY.hero_line1}&rdquo;</p>
              <input
                id="copy_hero_line1"
                name="copy_hero_line1"
                type="text"
                defaultValue={settings.homepage_copy.hero_line1 ?? ""}
                placeholder={DEFAULT_HOMEPAGE_COPY.hero_line1}
                className="mt-2 w-full max-w-xl rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="copy_hero_gradient">
                Hero — accent line (gradient)
              </label>
              <p className="mt-0.5 text-xs text-slate-500">Default: &ldquo;{DEFAULT_HOMEPAGE_COPY.hero_gradient}&rdquo;</p>
              <input
                id="copy_hero_gradient"
                name="copy_hero_gradient"
                type="text"
                defaultValue={settings.homepage_copy.hero_gradient ?? ""}
                placeholder={DEFAULT_HOMEPAGE_COPY.hero_gradient}
                className="mt-2 w-full max-w-xl rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="copy_hero_tagline">
                Hero — supporting tagline
              </label>
              <p className="mt-0.5 text-xs text-slate-500">Short paragraph under the headline.</p>
              <textarea
                id="copy_hero_tagline"
                name="copy_hero_tagline"
                rows={3}
                defaultValue={settings.homepage_copy.hero_tagline ?? ""}
                placeholder={DEFAULT_HOMEPAGE_COPY.hero_tagline}
                className="mt-2 w-full max-w-2xl rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="mt-10 border-t border-slate-200 pt-8">
            <h3 className="font-headline text-base font-bold text-slate-800">Header &ldquo;Call now&rdquo; button</h3>
            <p className="mt-1 text-sm text-slate-600">
              Shown in the top navigation on the marketing site. Both fields are required for the button to appear.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="copy_navbar_call_display">
                  Number as shown (label)
                </label>
                <input
                  id="copy_navbar_call_display"
                  name="copy_navbar_call_display"
                  type="text"
                  defaultValue={settings.homepage_copy.navbar_call_display ?? ""}
                  placeholder="+91 98765 43210"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="copy_navbar_call_tel_href">
                  Tel link (href)
                </label>
                <p className="mt-0.5 text-xs text-slate-500">Use international format, e.g. tel:+919876543210</p>
                <input
                  id="copy_navbar_call_tel_href"
                  name="copy_navbar_call_tel_href"
                  type="text"
                  defaultValue={settings.homepage_copy.navbar_call_tel_href ?? ""}
                  placeholder="tel:+919876543210"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm text-slate-900"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Homepage &amp; locations images</h2>
          <p className="mt-1 text-sm text-slate-600">
            Paste full HTTPS URLs — live preview updates as you type. Leave empty to keep the built‑in default for each slot.
          </p>
          <div className="mt-6">
            <MarketingImageFields
              fields={(Object.keys(DEFAULT_HOMEPAGE_IMAGES) as HomepageImageKey[]).map((key) => ({
                key,
                label: IMG_LABELS[key],
                defaultValue: settings.homepage_images[key] ?? "",
                fallbackUrl: merged[key],
              }))}
            />
            <div className="mt-10 border-t border-slate-200 pt-8">
              <h3 className="font-headline text-base font-bold text-slate-800">Hero image carousel (optional)</h3>
              <p className="mt-1 text-sm text-slate-600">
                The main <strong>Hero</strong> image is always slide 1. Add up to two more HTTPS URLs to rotate in the homepage hero (same aspect ratio
                recommended).
              </p>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="img_hero_slide_2">
                    Hero slide 2 URL
                  </label>
                  <input
                    id="img_hero_slide_2"
                    name="img_hero_slide_2"
                    type="url"
                    defaultValue={settings.homepage_images.hero_slide_2 ?? ""}
                    placeholder="Optional — full HTTPS URL"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="img_hero_slide_3">
                    Hero slide 3 URL
                  </label>
                  <input
                    id="img_hero_slide_3"
                    name="img_hero_slide_3"
                    type="url"
                    defaultValue={settings.homepage_images.hero_slide_3 ?? ""}
                    placeholder="Optional — full HTTPS URL"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Welcome video</h2>
          <p className="mt-1 text-sm text-slate-600">
            Paste a YouTube, Vimeo, or direct MP4 link. It appears on the homepage in a green square video card. Leave empty to hide the
            section.
          </p>
          <div className="mt-4 max-w-2xl">
            <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="welcome_video_url">
              Video URL
            </label>
            <input
              id="welcome_video_url"
              name="welcome_video_url"
              type="url"
              defaultValue={settings.welcome_video_url ?? ""}
              placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Clinic gallery</h2>
          <p className="mt-1 text-sm text-slate-600">
            One HTTPS image URL per line (up to 24). Shown as a photo gallery on the homepage. Leave empty to hide the section.
          </p>
          <div className="mt-4 max-w-3xl">
            <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="gallery_image_urls">
              Gallery image URLs
            </label>
            <textarea
              id="gallery_image_urls"
              name="gallery_image_urls"
              rows={8}
              defaultValue={settings.gallery_image_urls.join("\n")}
              placeholder={"https://…/clinic-lobby.jpg\nhttps://…/surgery-suite.jpg"}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm text-slate-900"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Instagram — homepage reels &amp; posts</h2>
          <p className="mt-1 text-sm text-slate-600">
            The homepage uses Instagram&apos;s official embed player for each link. You can <strong>paste URLs manually</strong> (one per line) or{" "}
            <strong>refresh from Instagram</strong> when the server is configured with Meta&apos;s Instagram Graph API (see below). Visitors never need
            to log in to Instagram.
          </p>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-700">
            <p className="font-headline font-semibold text-slate-900">Automatic feed (recommended)</p>
            <p className="mt-1 leading-relaxed">
              Set <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">INSTAGRAM_USER_ID</code> and{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">INSTAGRAM_ACCESS_TOKEN</code> in the website environment (see{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">.env.example</code>). The Instagram account must be{" "}
              <strong>Professional</strong> (Business or Creator) and linked to a Facebook Page — this is how Meta exposes recent media for{" "}
              <a
                className="font-semibold text-primary underline"
                href="https://developers.facebook.com/docs/instagram-api/getting-started"
                target="_blank"
                rel="noreferrer"
              >
                Instagram Graph API
              </a>
              . Then use <strong>Refresh from Instagram</strong> to pull the latest permalinks; repeat whenever you want new posts on the site.
            </p>
            {igSyncedAt ? (
              <p className="mt-2 text-xs text-slate-600">
                Last sync:{" "}
                <time dateTime={igSyncedAt}>{new Date(igSyncedAt).toLocaleString()}</time>
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-600">Not synced from the API yet (manual URLs still work).</p>
            )}
            <form action={refreshInstagramEmbedsFromGraph} className="mt-3">
              <AdminSubmitButton
                pendingLabel="Fetching from Instagram…"
                className="rounded-xl border border-primary/30 bg-white px-4 py-2.5 font-headline text-sm font-bold text-primary shadow-sm hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-80"
              >
                Refresh from Instagram
              </AdminSubmitButton>
            </form>
          </div>
          <div className="mt-6 max-w-3xl">
            <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="instagram_embed_urls">
              Post / reel URLs (manual override)
            </label>
            <p className="mt-1 text-xs text-slate-500">
              One permalink per line. Saving replaces the list unless you use API refresh above (refresh also overwrites this list).
            </p>
            <textarea
              id="instagram_embed_urls"
              name="instagram_embed_urls"
              rows={8}
              defaultValue={settings.instagram_embed_urls.join("\n")}
              placeholder="https://www.instagram.com/reel/AbCdEfGh123/&#10;https://www.instagram.com/p/XyZaBcDe456/"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm text-slate-900"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Footer social links</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["social_website_url", "website_url", "Website"],
                ["social_instagram_url", "instagram_url", "Instagram"],
                ["social_facebook_url", "facebook_url", "Facebook"],
                ["social_youtube_url", "youtube_url", "YouTube"],
                ["social_linkedin_url", "linkedin_url", "LinkedIn"],
              ] as const
            ).map(([fieldName, key, label]) => (
              <div key={fieldName}>
                <label className="block text-xs font-bold text-slate-600" htmlFor={fieldName}>
                  {label}
                </label>
                <input
                  id={fieldName}
                  name={fieldName}
                  type="url"
                  defaultValue={settings.social_links[key] ?? ""}
                  placeholder="https://"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        </section>

        <AdminSubmitButton
          pendingLabel="Saving settings…"
          className="gradient-primary min-w-[200px] rounded-xl px-8 py-3 font-headline font-bold text-on-primary shadow-lg disabled:cursor-not-allowed disabled:opacity-80"
        >
          Save changes
        </AdminSubmitButton>
      </form>
    </div>
  );
}
