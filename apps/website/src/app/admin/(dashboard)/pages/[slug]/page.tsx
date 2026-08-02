import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMarketingManager } from "@/lib/admin/auth";
import { saveMarketingPageContent } from "@/app/admin/(dashboard)/actions";
import { getMarketingSiteSettings } from "@/lib/marketing/get-marketing-site";
import {
  DEFAULT_PAGE_CONTENT,
  getMarketingPageDef,
  isMarketingPageSlug,
  mergePageContent,
} from "@/lib/marketing/page-content";

export default async function AdminPageEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  await requireMarketingManager();
  const { slug } = await params;
  if (!isMarketingPageSlug(slug)) notFound();

  const def = getMarketingPageDef(slug);
  const settings = await getMarketingSiteSettings();
  const merged = mergePageContent(slug, settings.page_content[slug]);
  const defaults = DEFAULT_PAGE_CONTENT[slug];
  const sp = (await searchParams) ?? {};

  const valueFor = (key: string): string => {
    if (key === "seo_title") return merged.seo_title;
    if (key === "seo_description") return merged.seo_description;
    if (key === "og_image_url") return merged.og_image_url;
    return merged.sections[key] ?? "";
  };

  const placeholderFor = (key: string): string => {
    if (key === "seo_title") return defaults.seo_title ?? "";
    if (key === "seo_description") return defaults.seo_description ?? "";
    if (key === "og_image_url") return defaults.og_image_url ?? "";
    return defaults.sections?.[key] ?? "";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link href="/admin/pages" className="text-sm font-semibold text-primary hover:underline">
          ← All pages
        </Link>
        <h1 className="mt-3 font-headline text-2xl font-bold text-slate-900">Edit {def.label}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Public path:{" "}
          <a href={def.path} target="_blank" rel="noreferrer" className="font-mono text-primary hover:underline">
            {def.path}
          </a>
          . Use <code className="rounded bg-slate-100 px-1">{"{{clinicName}}"}</code> where the clinic name should appear.
        </p>
      </div>

      {sp.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Saved.</p>
      ) : null}
      {sp.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{sp.error}</p>
      ) : null}

      <form action={saveMarketingPageContent} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <input type="hidden" name="slug" value={slug} />

        {def.fields.map((field) => {
          const name = `field_${field.key}`;
          const value = valueFor(field.key);
          const placeholder = placeholderFor(field.key);

          if (field.type === "image") {
            return (
              <div key={field.key} className="space-y-2">
                <label htmlFor={name} className="block text-xs font-bold uppercase tracking-wide text-slate-600">
                  {field.label}
                </label>
                <input
                  id={name}
                  name={name}
                  type="url"
                  defaultValue={value}
                  placeholder={placeholder || "https://…"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-inner outline-none ring-primary/30 focus:ring-2"
                />
                {(value || placeholder) && /^https?:\/\//i.test(value || placeholder) ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={value || placeholder}
                      alt=""
                      className="aspect-[16/9] w-full object-cover"
                    />
                  </div>
                ) : null}
              </div>
            );
          }

          if (field.type === "textarea") {
            return (
              <div key={field.key}>
                <label htmlFor={name} className="block text-xs font-bold uppercase tracking-wide text-slate-600">
                  {field.label}
                </label>
                <textarea
                  id={name}
                  name={name}
                  rows={field.rows ?? 4}
                  defaultValue={value}
                  placeholder={placeholder}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-inner outline-none ring-primary/30 focus:ring-2"
                />
              </div>
            );
          }

          return (
            <div key={field.key}>
              <label htmlFor={name} className="block text-xs font-bold uppercase tracking-wide text-slate-600">
                {field.label}
              </label>
              <input
                id={name}
                name={name}
                type="text"
                defaultValue={value}
                placeholder={placeholder}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-inner outline-none ring-primary/30 focus:ring-2"
              />
            </div>
          );
        })}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold uppercase tracking-wide text-on-primary"
          >
            Save page
          </button>
          <Link
            href="/admin/pages"
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 px-6 text-sm font-bold uppercase tracking-wide text-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
