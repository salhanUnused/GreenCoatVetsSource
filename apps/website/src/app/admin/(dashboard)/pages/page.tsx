import Link from "next/link";
import { requireMarketingManager } from "@/lib/admin/auth";
import { MARKETING_PAGE_DEFS } from "@/lib/marketing/page-content";

export default async function AdminPagesListPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  await requireMarketingManager();
  const sp = (await searchParams) ?? {};

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-headline text-2xl font-bold text-slate-900">Pages</h1>
        <p className="mt-2 text-sm text-slate-600">
          Edit headings, body copy, images, and SEO for each marketing page. Leave fields empty to use the site defaults.
        </p>
      </div>

      {sp.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{sp.error}</p>
      ) : null}

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {MARKETING_PAGE_DEFS.map((page) => (
          <li key={page.slug}>
            <Link
              href={`/admin/pages/${page.slug}`}
              className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
            >
              <div>
                <p className="font-semibold text-slate-900">{page.label}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{page.path}</p>
              </div>
              <span className="material-symbols-outlined text-slate-400">chevron_right</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
