import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createWalkInGuestPatient } from "../actions";
import { AppShell } from "@/components/web/app-shell";
import { ConsentSignatureField } from "@/components/clinical/consent-signature-field";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { APPOINTMENT_BOOKING_CONSENT_TEXT } from "@/lib/booking/appointment-consent";
import { getPlatformBranding } from "@/lib/platform-branding";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/web/submit-button";

const ALLOWED = new Set([
  "clinic_admin",
  "branch_admin",
  "doctor",
  "receptionist",
  "lab_technician",
  "pharmacist",
]);

function normalizeBaseUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isLocalBaseUrl(raw: string | null): boolean {
  if (!raw) return true;
  try {
    const hostname = new URL(raw).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return true;
  }
}

function inferWebsiteBaseUrl(host: string, protocol: string): string {
  const cleanHost = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (!cleanHost || cleanHost === "localhost" || cleanHost === "127.0.0.1") {
    return "http://localhost:3001";
  }
  if (cleanHost.startsWith("app.")) {
    return `${protocol}://${cleanHost.replace(/^app\./, "")}`;
  }
  if (cleanHost.startsWith("web.")) {
    return `${protocol}://${cleanHost.replace(/^web\./, "")}`;
  }
  return `${protocol}://${cleanHost}`;
}

export default async function WalkInGuestPage() {
  const access = await getUserAccess();
  const role = (access.membership?.role ?? "pet_owner") as Parameters<typeof getRoleNavGroups>[0];
  if (!access.isSuperAdmin && !ALLOWED.has(role)) {
    redirect("/dashboard");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("clinic_id", clinic_id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const branding = await getPlatformBranding();
  const requestHeaders = headers();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const configuredWebsiteBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_WEBSITE_APP_URL);
  const requestHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const requestProtocol =
    requestHeaders.get("x-forwarded-proto") ?? (requestHost.includes("localhost") || requestHost.includes("127.0.0.1") ? "http" : "https");
  const inferredWebsiteBase = inferWebsiteBaseUrl(requestHost, requestProtocol);
  const websiteBase =
    configuredWebsiteBase && !(requestProtocol === "https" && isLocalBaseUrl(configuredWebsiteBase))
      ? configuredWebsiteBase
      : inferredWebsiteBase;
  const walkInBookingUrl = `${websiteBase.replace(/\/$/, "")}/book?walk_in=1`;
  const stylizedQrPreviewUrl = `/api/reception/walk-in-qr?target=${encodeURIComponent(walkInBookingUrl)}&label=${encodeURIComponent(branding.product_name)}`;
  const stylizedQrDownloadUrl = `${stylizedQrPreviewUrl}&download=1&format=png`;

  return (
    <AppShell
      title="Walk-in guest"
      subtitle="Create a guest contact and patient without a portal login. Full profile can be edited later in Owners / Pets."
      activeHref="/reception/walk-in"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap gap-1">
          <Link className="btn-secondary btn-compact" href="/owners">
            Owners
          </Link>
          <Link className="btn-secondary btn-compact" href="/pets">
            Pets
          </Link>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form action={createWalkInGuestPatient} className="card-soft max-w-xl space-y-3 text-[12px]">
          <p className="text-[11px] text-slate-600">
            Use for visitors without an app account. Phone is required; owner name defaults to “Guest Walk-in” if left blank.
          </p>

          <label className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-800">Owner name</span>
            <input
              name="owner_name"
              className="rounded border border-slate-200 bg-white px-2 py-1.5"
              placeholder="First Last (optional)"
              autoComplete="name"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-800">Phone *</span>
            <input
              name="phone"
              required
              className="rounded border border-slate-200 bg-white px-2 py-1.5"
              placeholder="+91 98765 43210"
              inputMode="tel"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-800">Email</span>
            <input
              name="email"
              type="email"
              className="rounded border border-slate-200 bg-white px-2 py-1.5"
              placeholder="owner@email.com (for prescriptions & reports)"
              inputMode="email"
              autoComplete="email"
            />
            <span className="text-[10px] text-slate-500">Used to share prescriptions and visit reports with the owner.</span>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-800">Patient name *</span>
            <input name="pet_name" required className="rounded border border-slate-200 bg-white px-2 py-1.5" placeholder="Pet name" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-800">Species *</span>
            <input
              name="species"
              className="rounded border border-slate-200 bg-white px-2 py-1.5"
              placeholder="canine, feline, avian…"
              defaultValue="canine"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-800">Breed</span>
            <input name="breed" className="rounded border border-slate-200 bg-white px-2 py-1.5" placeholder="Breed (optional)" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-800">Age (months)</span>
            <input
              name="age_months"
              type="number"
              min={0}
              className="rounded border border-slate-200 bg-white px-2 py-1.5"
              placeholder="e.g. 18"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-800">Weight (kg)</span>
            <input
              name="weight_kg"
              type="number"
              step="0.01"
              min={0}
              className="rounded border border-slate-200 bg-white px-2 py-1.5"
              placeholder="e.g. 12.5"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-800">Primary branch</span>
            <select name="branch_id" className="rounded border border-slate-200 bg-white px-2 py-1.5">
              <option value="">—</option>
              {(branches ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[11px]">
            <input type="checkbox" name="create_appointment" defaultChecked className="rounded border-slate-300" />
            <span>Also create a same-day appointment (needs branch)</span>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="font-semibold text-slate-800">Desk notes</span>
            <textarea name="notes" rows={2} className="rounded border border-slate-200 bg-white px-2 py-1.5" placeholder="Optional" />
          </label>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
            <label className="flex items-start gap-2 text-[11px] text-slate-800">
              <input type="checkbox" name="booking_consent" required className="mt-0.5 rounded border-slate-300" />
              <span>{APPOINTMENT_BOOKING_CONSENT_TEXT}</span>
            </label>
            <ConsentSignatureField />
          </div>
          <SubmitButton className="btn-primary btn-compact" pendingLabel="Saving…">
            Save walk-in & go to appointments
          </SubmitButton>
        </form>

        <aside className="card-soft h-fit max-w-[320px] space-y-3 text-[12px]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Reception QR</p>
            <h2 className="mt-1 font-headline text-lg font-bold text-slate-900">Self check-in booking</h2>
            <p className="mt-2 text-slate-600">
              Patients can scan this QR at reception, fill the website booking form, and the appointment will appear in the doctor schedule like a
              normal website booking.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stylizedQrPreviewUrl}
              alt="Reception walk-in booking QR"
              className="mx-auto h-auto w-full rounded-xl object-contain"
            />
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={stylizedQrDownloadUrl}
              download="greencoatvets-walk-in-qr.png"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm hover:opacity-95"
            >
              Download branded QR
            </a>
            <a
              href={walkInBookingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary"
            >
              Open booking page
            </a>
          </div>
          <a className="block break-all text-[11px] font-medium text-primary underline" href={walkInBookingUrl} target="_blank" rel="noreferrer">
            {walkInBookingUrl}
          </a>
        </aside>
      </div>
    </AppShell>
  );
}
