import { addMarketingLocation, updateMarketingLocation } from "@/app/admin/(dashboard)/actions";
import { DeleteLocationForm } from "@/app/admin/(dashboard)/locations/delete-location-form";
import { AdminFlashMessages } from "@/components/admin/admin-flash-messages";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { requireMarketingManager } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

type Row = {
  id: string;
  sort_order: number;
  name: string;
  address_lines: string[];
  phone_display: string | null;
  tel_href: string | null;
  hours_label: string;
  directions_url: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
};

export default async function AdminLocationsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireMarketingManager();
  const saved = searchParams.saved === "1" || searchParams.saved === "true";
  const deleted = searchParams.deleted === "1" || searchParams.deleted === "true";
  const errorMessage = typeof searchParams.error === "string" ? searchParams.error : null;

  const supabase = createClient();
  const { data: rows } = await supabase
    .from("marketing_locations")
    .select("id, sort_order, name, address_lines, phone_display, tel_href, hours_label, directions_url, latitude, longitude, is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const list = (rows ?? []) as Row[];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-headline text-3xl font-bold">Locations</h1>
        <p className="mt-2 text-slate-600">
          These rows power the public <code className="rounded bg-slate-100 px-1">/locations</code> page. If there are no rows, the site falls
          back to built‑in defaults.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Any <strong>active</strong> row with both <strong>latitude</strong> and <strong>longitude</strong> appears as a pin on the public map.
        </p>
      </div>

      <AdminFlashMessages saved={saved} deleted={deleted} error={errorMessage} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-primary">Add location</h2>
        <form action={addMarketingLocation} className="mt-4 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-600">Name</label>
              <input name="name" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Sort order</label>
              <input name="sort_order" type="number" defaultValue={0} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">Address lines (one per line)</label>
            <textarea name="address_lines" rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-600">Phone (display)</label>
              <input name="phone_display" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Tel link (e.g. tel:+9198…)</label>
              <input name="tel_href" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">Hours label</label>
            <input name="hours_label" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Open 24/7 on Call" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">Directions URL (optional)</label>
            <input name="directions_url" type="url" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-600">Latitude (map pin)</label>
              <input
                name="latitude"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 30.7046"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Longitude (map pin)</label>
              <input
                name="longitude"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 76.7179"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Optional WGS84 coordinates for the interactive map on <code className="rounded bg-slate-100 px-1">/locations</code>. Leave blank to hide
            the pin until you add them.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked className="rounded border-slate-300" />
            Active (visible on public site)
          </label>
          <AdminSubmitButton
            pendingLabel="Adding location…"
            className="w-fit min-w-[160px] rounded-xl bg-primary px-6 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-80"
          >
            Add location
          </AdminSubmitButton>
        </form>
      </section>

      <section className="space-y-6">
        <h2 className="font-headline text-lg font-bold">Existing locations</h2>
        {list.length === 0 ? (
          <p className="text-sm text-slate-500">No database rows yet — public site uses code defaults.</p>
        ) : (
          list.map((loc) => {
            const addressText = Array.isArray(loc.address_lines) ? (loc.address_lines as string[]).join("\n") : "";
            return (
              <div
                key={loc.id}
                className={`rounded-2xl border p-6 shadow-sm ${loc.is_active ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50"}`}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase text-slate-500">{loc.is_active ? "Active" : "Hidden"}</span>
                  <DeleteLocationForm id={loc.id} />
                </div>
                <form action={updateMarketingLocation} className="space-y-4">
                  <input type="hidden" name="id" value={loc.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-bold text-slate-600">Name</label>
                      <input name="name" required defaultValue={loc.name} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">Sort order</label>
                      <input
                        name="sort_order"
                        type="number"
                        defaultValue={loc.sort_order}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Address lines</label>
                    <textarea name="address_lines" rows={3} defaultValue={addressText} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-bold text-slate-600">Phone (display)</label>
                      <input name="phone_display" defaultValue={loc.phone_display ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">Tel link</label>
                      <input name="tel_href" defaultValue={loc.tel_href ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Hours</label>
                    <input name="hours_label" defaultValue={loc.hours_label} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600">Directions URL</label>
                    <input name="directions_url" type="url" defaultValue={loc.directions_url ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-bold text-slate-600">Latitude</label>
                      <input
                        name="latitude"
                        type="text"
                        inputMode="decimal"
                        defaultValue={loc.latitude != null ? String(loc.latitude) : ""}
                        placeholder="30.7046"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600">Longitude</label>
                      <input
                        name="longitude"
                        type="text"
                        inputMode="decimal"
                        defaultValue={loc.longitude != null ? String(loc.longitude) : ""}
                        placeholder="76.7179"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="is_active" defaultChecked={loc.is_active} className="rounded border-slate-300" />
                    Active
                  </label>
                  <AdminSubmitButton
                    pendingLabel="Saving…"
                    className="min-w-[120px] rounded-xl bg-slate-900 px-6 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-80"
                  >
                    Save
                  </AdminSubmitButton>
                </form>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
