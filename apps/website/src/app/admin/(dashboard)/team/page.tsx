import Image from "next/image";
import { addMarketingTeamMember, deleteMarketingTeamMember, updateMarketingTeamMember } from "@/app/admin/(dashboard)/actions";
import { AdminFlashMessages } from "@/components/admin/admin-flash-messages";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { requireMarketingManager } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

type TeamRow = {
  id: string;
  full_name: string;
  role_title: string | null;
  image_url: string;
  sort_order: number;
  is_active: boolean;
};

export default async function AdminTeamPage({
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
    .from("marketing_team_members")
    .select("id, full_name, role_title, image_url, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("full_name", { ascending: true });
  const rows = (data ?? []) as TeamRow[];
  const nextSort = rows.length ? Math.max(...rows.map((x) => x.sort_order)) + 1 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Our team</h1>
        <p className="mt-2 text-slate-600">
          Manage who appears on the public homepage &ldquo;Our team&rdquo; section and the{" "}
          <a href="/team" className="font-semibold text-primary underline" target="_blank" rel="noreferrer">
            /team
          </a>{" "}
          page. These are curated marketing profiles — not pulled from clinic staff accounts. Upload a square photo and
          enter their name and role.
        </p>
      </div>
      <AdminFlashMessages saved={saved} deleted={deleted} error={errorMessage} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-primary">Add team member</h2>
        <form action={addMarketingTeamMember} className="mt-4 grid gap-3" encType="multipart/form-data">
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="full_name" required placeholder="Full name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input name="role_title" placeholder="Role (e.g. Senior Veterinarian)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="sort_order" type="number" defaultValue={nextSort} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked className="rounded border-slate-300" />
              Show on homepage
            </label>
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-slate-500">Photo</label>
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
            />
            <p className="mt-1 text-xs text-slate-500">Square JPG or PNG recommended (at least 256×256).</p>
          </div>
          <AdminSubmitButton pendingLabel="Uploading…" className="w-fit rounded-xl bg-primary px-5 py-2 font-bold text-white">
            Add member
          </AdminSubmitButton>
        </form>
      </section>

      {rows.map((row) => (
        <section key={row.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form action={updateMarketingTeamMember} className="grid gap-3" encType="multipart/form-data">
            <input type="hidden" name="id" value={row.id} />
            <div className="flex items-start gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-2 ring-slate-200">
                <Image src={row.image_url} alt="" fill className="object-cover" sizes="80px" unoptimized />
              </div>
              <div className="grid flex-1 gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    name="full_name"
                    required
                    defaultValue={row.full_name}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    name="role_title"
                    defaultValue={row.role_title ?? ""}
                    placeholder="Role"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    name="sort_order"
                    type="number"
                    defaultValue={row.sort_order}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="is_active" defaultChecked={row.is_active} className="rounded border-slate-300" />
                    Active
                  </label>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-slate-500">Replace photo (optional)</label>
                  <input
                    name="photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AdminSubmitButton pendingLabel="Saving…" className="rounded-xl bg-primary px-5 py-2 font-bold text-white">
                Save
              </AdminSubmitButton>
            </div>
          </form>
          <form action={deleteMarketingTeamMember} className="mt-3">
            <input type="hidden" name="id" value={row.id} />
            <AdminSubmitButton
              pendingLabel="Removing…"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-800"
            >
              Remove
            </AdminSubmitButton>
          </form>
        </section>
      ))}
    </div>
  );
}
