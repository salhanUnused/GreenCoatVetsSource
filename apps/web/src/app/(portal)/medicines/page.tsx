import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/web/app-shell";
import { SubmitButton } from "@/components/web/submit-button";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";
import { archiveMedicineCatalogEntry, saveMedicineCatalogEntry } from "./actions";
import { MedicineDosagePresets } from "@/components/clinical/medicine-dosage-presets";

type MedicineRow = {
  id: string;
  name: string;
  aliases: string[] | null;
  form: string | null;
  strength: string | null;
  manufacturer: string | null;
  default_dosage: string | null;
  dosage_per_kg: string | null;
  default_frequency: string | null;
  default_duration: string | null;
  notes: string | null;
  is_active: boolean;
  updated_at: string;
};

function canManageMedicineCatalog(role: string | null | undefined, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  return role === "clinic_admin" || role === "branch_admin";
}

export default async function MedicinesPage() {
  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/login");
  if (!canManageMedicineCatalog(access.membership?.role, access.isSuperAdmin)) redirect("/dashboard");

  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const [{ data: rows, error }, { data: clinic }] = await Promise.all([
    supabase
      .from("medicine_catalog_entries")
      .select(
        "id, name, aliases, form, strength, manufacturer, default_dosage, dosage_per_kg, default_frequency, default_duration, notes, is_active, updated_at",
      )
      .eq("clinic_id", clinic_id)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),
    supabase.from("clinics").select("*").eq("id", clinic_id).maybeSingle(),
  ]);

  const entries =
    error && /medicine_catalog_entries/i.test(error.message) ? [] : ((rows ?? []) as MedicineRow[]);
  if (error && !/medicine_catalog_entries/i.test(error.message)) throw new Error(error.message);
  const templateUrl =
    (clinic as { handwritten_visit_template_url?: string | null; prescription_template_url?: string | null } | null)
      ?.handwritten_visit_template_url ??
    (clinic as { handwritten_visit_template_url?: string | null; prescription_template_url?: string | null } | null)
      ?.prescription_template_url ??
    null;

  return (
    <AppShell
      title="Medicine Catalog"
      subtitle="Clinic-managed drug dictionary used for prescription search, smart correction, and quick defaults."
      activeHref="/medicines"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary text-sm" href="/clinic-profile">
            Clinic profile
          </Link>
          <Link className="btn-primary text-sm" href="/clinic-profile/prescription-template">
            Full visit template
          </Link>
        </div>
      }
    >
      <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-on-background">Add medicine / drug</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Add the exact medicine names doctors should see in the visit prescription dropdown. Aliases help autocorrect
            spoken or misspelled names.
          </p>
          <form action={saveMedicineCatalogEntry} className="mt-4 grid gap-3">
            <input className="input-soft" name="name" placeholder="Canonical medicine name" required />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input-soft" name="strength" placeholder="Strength (e.g. 250 mg)" />
              <input className="input-soft" name="form" placeholder="Form (tablet, syrup, injection)" />
            </div>
            <input className="input-soft" name="manufacturer" placeholder="Manufacturer / brand" />
            <textarea
              className="input-soft min-h-[72px]"
              name="aliases"
              placeholder="Aliases, spellings, or speech variants. Separate with commas or new lines."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <input className="input-soft" name="default_dosage" placeholder="Default dosage (fixed amount)" />
                <p className="mt-1 text-[11px] text-on-surface-variant">Used when weight is unknown — e.g. 250 mg</p>
              </div>
              <div>
                <input className="input-soft" name="dosage_per_kg" placeholder="Dosage per kg (e.g. 10 mg/kg)" />
                <p className="mt-1 text-[11px] text-on-surface-variant">Auto-calculates in consult when pet weight is set</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <MedicineDosagePresets />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input-soft" name="default_frequency" placeholder="Default frequency (e.g. BID)" />
              <input className="input-soft" name="default_duration" placeholder="Default duration (e.g. 5 days)" />
            </div>
            <textarea className="input-soft min-h-[72px]" name="notes" placeholder="Internal notes for doctors/admins" />
            <SubmitButton className="btn-primary w-fit">Save medicine</SubmitButton>
          </form>
        </div>

        <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-low p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-headline text-lg font-bold text-on-background">How it is used</h2>
              <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
                Doctors get a searchable picker inside the visit prescription section. Strong fuzzy matches are auto-fixed
                to the closest catalog name, but they can still manually edit the field before saving.
              </p>
            </div>
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 text-right">
              <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">Clinic</p>
              <p className="font-headline text-base font-bold text-primary">{clinic?.name ?? "Clinic"}</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Handwritten visit template: {templateUrl ? "uploaded" : "using built-in blank layout"}
              </p>
            </div>
          </div>
        </div>
      </section>
      {error && /medicine_catalog_entries/i.test(error.message) ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The medicine catalog table is not available on this database yet. Run the latest Supabase migrations to enable
          admin-managed medicines here.
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-on-background">Catalog entries</h2>
          <p className="text-sm text-on-surface-variant">{entries.length} total medicines</p>
        </div>
        {!entries.length ? (
          <div className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-low px-5 py-8 text-sm text-on-surface-variant">
            No medicines added yet. Start with your most common prescriptions so search and autocorrect are immediately useful.
          </div>
        ) : null}
        {entries.map((entry) => (
          <article
            key={entry.id}
            className={`rounded-3xl border p-5 shadow-sm ${
              entry.is_active
                ? "border-outline-variant/15 bg-surface-container-lowest"
                : "border-outline-variant/10 bg-surface-container-low opacity-80"
            }`}
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-headline text-lg font-bold text-on-background">{entry.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      entry.is_active
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {entry.is_active ? "Active" : "Archived"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Updated {new Date(entry.updated_at).toLocaleString()}
                </p>
              </div>
              <form action={archiveMedicineCatalogEntry}>
                <input type="hidden" name="id" value={entry.id} />
                <input type="hidden" name="next_active" value={entry.is_active ? "false" : "true"} />
                <button className="btn-secondary text-xs" type="submit">
                  {entry.is_active ? "Archive" : "Reactivate"}
                </button>
              </form>
            </div>

            <form action={saveMedicineCatalogEntry} className="grid gap-3">
              <input type="hidden" name="id" value={entry.id} />
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-on-surface-variant">Canonical name</span>
                <input className="input-soft" name="name" defaultValue={entry.name} required />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-on-surface-variant">Strength</span>
                  <input className="input-soft" name="strength" defaultValue={entry.strength ?? ""} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-on-surface-variant">Form</span>
                  <input className="input-soft" name="form" defaultValue={entry.form ?? ""} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-on-surface-variant">Manufacturer</span>
                  <input className="input-soft" name="manufacturer" defaultValue={entry.manufacturer ?? ""} />
                </label>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-on-surface-variant">Aliases / common misspellings</span>
                <textarea
                  className="input-soft min-h-[72px]"
                  name="aliases"
                  defaultValue={(entry.aliases ?? []).join(", ")}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-on-surface-variant">Default dosage</span>
                  <input className="input-soft" name="default_dosage" defaultValue={entry.default_dosage ?? ""} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-on-surface-variant">Default frequency</span>
                  <input className="input-soft" name="default_frequency" defaultValue={entry.default_frequency ?? ""} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold text-on-surface-variant">Default duration</span>
                  <input className="input-soft" name="default_duration" defaultValue={entry.default_duration ?? ""} />
                </label>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-on-surface-variant">Notes</span>
                <textarea className="input-soft min-h-[72px]" name="notes" defaultValue={entry.notes ?? ""} />
              </label>
              <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                <input type="checkbox" name="is_active" defaultChecked={entry.is_active} />
                Keep this medicine active in doctor search
              </label>
              <SubmitButton className="btn-primary w-fit">Save changes</SubmitButton>
            </form>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
