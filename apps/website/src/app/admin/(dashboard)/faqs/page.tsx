import { addMarketingFaq, deleteMarketingFaq, updateMarketingFaq } from "@/app/admin/(dashboard)/actions";
import { AdminFlashMessages } from "@/components/admin/admin-flash-messages";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { requireMarketingManager } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
};

export default async function AdminFaqsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireMarketingManager();
  const saved = searchParams.saved === "1" || searchParams.saved === "true";
  const deleted = searchParams.deleted === "1" || searchParams.deleted === "true";
  const errorMessage = typeof searchParams.error === "string" ? searchParams.error : null;

  const supabase = createClient();
  const { data } = await supabase
    .from("marketing_faqs")
    .select("id, question, answer, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as FaqRow[];
  const nextSort = rows.length ? Math.max(...rows.map((x) => x.sort_order)) + 1 : 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-headline text-3xl font-bold">FAQs</h1>
        <p className="mt-2 text-slate-600">Manage FAQ items shown on the public FAQ page. Only active items are visible to visitors.</p>
      </div>

      <AdminFlashMessages saved={saved} deleted={deleted} error={errorMessage} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-primary">Add FAQ</h2>
        <form action={addMarketingFaq} className="mt-4 grid gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600">Question</label>
            <input name="question" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">Answer</label>
            <textarea name="answer" required rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600">Sort order</label>
              <input
                name="sort_order"
                type="number"
                defaultValue={nextSort}
                className="mt-1 block w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <label className="mt-5 flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked className="rounded border-slate-300" />
              Active
            </label>
          </div>
          <AdminSubmitButton pendingLabel="Adding…" className="w-fit rounded-xl bg-primary px-5 py-2 font-bold text-white">
            Add FAQ
          </AdminSubmitButton>
        </form>
      </section>

      <div className="space-y-4">
        {rows.map((row) => (
          <section key={row.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <form action={updateMarketingFaq} className="grid gap-4">
              <input type="hidden" name="id" value={row.id} />
              <div>
                <label className="text-xs font-bold text-slate-600">Question</label>
                <input
                  name="question"
                  required
                  defaultValue={row.question}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Answer</label>
                <textarea
                  name="answer"
                  required
                  rows={4}
                  defaultValue={row.answer}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">Sort order</label>
                  <input
                    name="sort_order"
                    type="number"
                    defaultValue={row.sort_order}
                    className="mt-1 block w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <label className="mt-5 flex items-center gap-2 text-sm">
                  <input type="checkbox" name="is_active" defaultChecked={row.is_active} className="rounded border-slate-300" />
                  Active
                </label>
              </div>
              <div className="flex items-center gap-3">
                <AdminSubmitButton pendingLabel="Saving…" className="rounded-xl bg-primary px-5 py-2 font-bold text-white">
                  Save FAQ
                </AdminSubmitButton>
              </div>
            </form>
            <form action={deleteMarketingFaq} className="mt-3">
              <input type="hidden" name="id" value={row.id} />
              <AdminSubmitButton
                pendingLabel="Deleting…"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700"
              >
                Delete
              </AdminSubmitButton>
            </form>
          </section>
        ))}
      </div>
    </div>
  );
}
