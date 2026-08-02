import {
  addFooterGroup,
  addFooterLink,
  reorderFooterGroup,
  reorderFooterLink,
  updateFooterGroup,
  updateFooterLink,
} from "@/app/admin/(dashboard)/footer/actions";
import { DeleteFooterGroupForm } from "@/app/admin/(dashboard)/footer/delete-footer-group-form";
import { DeleteFooterLinkForm } from "@/app/admin/(dashboard)/footer/delete-footer-link-form";
import { AdminFlashMessages } from "@/components/admin/admin-flash-messages";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { requireMarketingManager } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

type GroupRow = {
  id: string;
  slug: string;
  title: string;
  sort_order: number;
};

type LinkRow = {
  id: string;
  group_id: string;
  label: string;
  href: string;
  sort_order: number;
  open_in_new_tab: boolean;
  is_active: boolean;
};

export default async function AdminFooterPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireMarketingManager();
  const saved = searchParams.saved === "1" || searchParams.saved === "true";
  const deleted = searchParams.deleted === "1" || searchParams.deleted === "true";
  const errorMessage = typeof searchParams.error === "string" ? searchParams.error : null;

  const supabase = createClient();
  const { data: groupRows } = await supabase
    .from("marketing_footer_groups")
    .select("id, slug, title, sort_order")
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  const { data: linkRows } = await supabase
    .from("marketing_footer_links")
    .select("id, group_id, label, href, sort_order, open_in_new_tab, is_active")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  const groups = (groupRows ?? []) as GroupRow[];
  const links = (linkRows ?? []) as LinkRow[];

  const linksByGroup = new Map<string, LinkRow[]>();
  for (const l of links) {
    const list = linksByGroup.get(l.group_id) ?? [];
    list.push(l);
    linksByGroup.set(l.group_id, list);
  }

  const maxSort = groups.length ? Math.max(...groups.map((g) => g.sort_order), 0) : 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-headline text-3xl font-bold">Footer</h1>
        <p className="mt-2 text-slate-600">
          Super admins configure footer columns and links for the public marketing site. Relative paths (e.g.{" "}
          <code className="rounded bg-slate-100 px-1">/about</code>) use in-app navigation; full URLs open in the browser (optionally in a new
          tab).
        </p>
      </div>

      <AdminFlashMessages saved={saved} deleted={deleted} error={errorMessage} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-primary">Add column</h2>
        <p className="mt-1 text-sm text-slate-500">Each column appears as a titled block of links in the footer (between brand and Visit).</p>
        <form action={addFooterGroup} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-slate-600">Title</label>
            <input name="title" required placeholder="e.g. Legal" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">Slug (optional, unique)</label>
            <input name="slug" placeholder="auto from title if empty" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">Sort order</label>
            <input
              name="sort_order"
              type="number"
              defaultValue={maxSort + 1}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <AdminSubmitButton
              pendingLabel="Adding…"
              className="w-fit min-w-[160px] rounded-xl bg-primary px-6 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-80"
            >
              Add column
            </AdminSubmitButton>
          </div>
        </form>
      </section>

      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">
          No footer columns in the database yet. Run the latest migration, or add a column above.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => {
            const groupLinks = linksByGroup.get(g.id) ?? [];
            return (
              <section key={g.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">Column · {g.slug}</p>
                    <form action={updateFooterGroup} className="mt-2 flex flex-wrap items-end gap-3">
                      <input type="hidden" name="id" value={g.id} />
                      <div>
                        <label className="text-xs font-bold text-slate-600">Title</label>
                        <input
                          name="title"
                          defaultValue={g.title}
                          required
                          className="mt-1 w-full min-w-[200px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600">Sort</label>
                        <input
                          name="sort_order"
                          type="number"
                          defaultValue={g.sort_order}
                          className="mt-1 w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <AdminSubmitButton
                        pendingLabel="Saving…"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-800 disabled:opacity-70"
                      >
                        Save column
                      </AdminSubmitButton>
                    </form>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={reorderFooterGroup}>
                      <input type="hidden" name="id" value={g.id} />
                      <input type="hidden" name="direction" value="up" />
                      <AdminSubmitButton
                        pendingLabel="…"
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                        aria-label="Move column up"
                      >
                        ↑
                      </AdminSubmitButton>
                    </form>
                    <form action={reorderFooterGroup}>
                      <input type="hidden" name="id" value={g.id} />
                      <input type="hidden" name="direction" value="down" />
                      <AdminSubmitButton
                        pendingLabel="…"
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
                        aria-label="Move column down"
                      >
                        ↓
                      </AdminSubmitButton>
                    </form>
                    <DeleteFooterGroupForm id={g.id} />
                  </div>
                </div>

                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-bold text-slate-700">Links</h3>
                  {groupLinks.length === 0 ? (
                    <p className="text-sm text-slate-500">No links yet — add one below.</p>
                  ) : (
                    groupLinks.map((link) => (
                      <div
                        key={link.id}
                        className={`rounded-xl border p-4 ${link.is_active ? "border-slate-200 bg-slate-50" : "border-amber-200 bg-amber-50"}`}
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase text-slate-500">{link.is_active ? "Visible" : "Hidden"}</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <form action={reorderFooterLink}>
                              <input type="hidden" name="id" value={link.id} />
                              <input type="hidden" name="direction" value="up" />
                              <AdminSubmitButton
                                pendingLabel="…"
                                className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs disabled:opacity-50"
                              >
                                ↑
                              </AdminSubmitButton>
                            </form>
                            <form action={reorderFooterLink}>
                              <input type="hidden" name="id" value={link.id} />
                              <input type="hidden" name="direction" value="down" />
                              <AdminSubmitButton
                                pendingLabel="…"
                                className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs disabled:opacity-50"
                              >
                                ↓
                              </AdminSubmitButton>
                            </form>
                            <DeleteFooterLinkForm id={link.id} />
                          </div>
                        </div>
                        <form action={updateFooterLink} className="grid gap-3 sm:grid-cols-2">
                          <input type="hidden" name="id" value={link.id} />
                          <div>
                            <label className="text-xs font-bold text-slate-600">Label</label>
                            <input
                              name="label"
                              defaultValue={link.label}
                              required
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600">URL</label>
                            <input
                              name="href"
                              defaultValue={link.href}
                              required
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600">Sort order</label>
                            <input
                              name="sort_order"
                              type="number"
                              defaultValue={link.sort_order}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:pt-6">
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" name="open_in_new_tab" defaultChecked={link.open_in_new_tab} className="rounded border-slate-300" />
                              Open in new tab
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" name="is_active" defaultChecked={link.is_active} className="rounded border-slate-300" />
                              Active
                            </label>
                          </div>
                          <div className="sm:col-span-2">
                            <AdminSubmitButton
                              pendingLabel="Saving…"
                              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-80"
                            >
                              Save link
                            </AdminSubmitButton>
                          </div>
                        </form>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-6 border-t border-dashed border-slate-200 pt-4">
                  <h4 className="text-sm font-bold text-slate-700">Add link to this column</h4>
                  <form action={addFooterLink} className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="group_id" value={g.id} />
                    <div>
                      <label className="text-xs font-bold text-slate-600">Label</label>
                      <input name="label" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">URL</label>
                      <input name="href" required placeholder="/page or https://…" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">Sort order</label>
                      <input name="sort_order" type="number" defaultValue={(groupLinks.length ? Math.max(...groupLinks.map((x) => x.sort_order)) : -1) + 1} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:pt-6">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="open_in_new_tab" className="rounded border-slate-300" />
                        New tab
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="is_active" defaultChecked className="rounded border-slate-300" />
                        Active
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <AdminSubmitButton
                        pendingLabel="Adding…"
                        className="rounded-xl border border-primary bg-white px-4 py-2 text-sm font-bold text-primary disabled:opacity-80"
                      >
                        Add link
                      </AdminSubmitButton>
                    </div>
                  </form>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
