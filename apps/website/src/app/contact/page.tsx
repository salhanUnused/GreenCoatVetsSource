import Link from "next/link";
import { ContactForm } from "@/components/contact/contact-form";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getMarketingLocationsOrDefaults, getMergedPageContent } from "@/lib/marketing/get-marketing-site";
import { applyClinicPlaceholders } from "@/lib/marketing/page-content";
import { marketingPageMetadata } from "@/lib/marketing/page-metadata";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return marketingPageMetadata({ slug: "contact", clinicName: clinic.name, path: "/contact" });
}

export default async function ContactPage() {
  const clinic = await resolveClinic();
  const supabase = createClient();
  const [locationsAll, branchesRes, page] = await Promise.all([
    getMarketingLocationsOrDefaults(),
    supabase
      .from("branches")
      .select("id, name, phone, emergency_phone, email, address_line1, city, state, postal_code, country")
      .eq("clinic_id", clinic.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    getMergedPageContent("contact"),
  ]);
  const branches = branchesRes.data;
  const s = page.sections;
  const t = (value: string | undefined) => applyClinicPlaceholders(value ?? "", clinic.name);

  /** Public site: show Phase 9 (Mohali) contact only for phone blocks. */
  const isPhase9Location = (loc: { id: string; name: string }) =>
    loc.id === "default-phase-9" || /phase\s*9/i.test(loc.name);

  const locations = locationsAll.filter(isPhase9Location);

  type EmergencyLine = { label: string; display: string; href: string };
  const emergencyLines: EmergencyLine[] = [];
  const seenDigits = new Set<string>();

  function pushLine(label: string, display: string | null | undefined, href: string | null | undefined) {
    const d = (display ?? "").trim();
    const h = (href ?? "").trim();
    if (!d && !h) return;
    const digits = (d || h.replace(/^tel:/i, "")).replace(/\D/g, "");
    if (digits && seenDigits.has(digits)) return;
    if (digits) seenDigits.add(digits);
    const telHref = h.startsWith("tel:") ? h : digits ? `tel:${digits}` : "";
    if (!telHref) return;
    emergencyLines.push({
      label,
      display: d || h.replace(/^tel:/i, ""),
      href: telHref,
    });
  }

  for (const loc of locations) {
    pushLine(loc.name, loc.phoneDisplay, loc.telHref);
  }

  const branchesPhase9 = branches?.filter((b) => /phase\s*9/i.test(b.name)) ?? [];

  return (
    <main className="bg-surface pb-20">
      <div className="mx-auto max-w-7xl px-6 pb-12 pt-8 sm:pt-12">
        <header className="mb-12 text-center md:mb-16 md:text-left">
          <h1 className="mb-6 font-headline text-4xl font-extrabold tracking-tight text-on-background md:text-5xl lg:text-6xl">
            {t(s.title)}{" "}
            {s.title_highlight ? <span className="text-primary">{t(s.title_highlight)}</span> : null}
            {s.title_highlight ? "." : null}
          </h1>
          <p className="max-w-2xl text-xl leading-relaxed text-on-surface-variant">{t(s.intro)}</p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="clinical-shadow rounded-xl bg-surface-container-lowest p-6 shadow-[0_12px_32px_rgba(23,28,31,0.06)] md:p-10 lg:col-span-7 lg:p-12">
            <ContactForm />
          </div>
          <div className="space-y-8 lg:col-span-5">
            <div className="relative overflow-hidden rounded-xl bg-error-container p-8 text-on-error-container">
              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-3xl">medical_services</span>
                  <h3 className="text-xl font-bold uppercase tracking-wider">Emergency &amp; urgent</h3>
                </div>
                <p className="mb-4 text-lg font-medium">Need immediate help? Call our Phase 9 Mohali line.</p>
                {emergencyLines.length ? (
                  <ul className="space-y-3">
                    {emergencyLines.map((line) => (
                      <li key={`${line.label}-${line.href}`}>
                        <p className="text-xs font-bold uppercase tracking-wide opacity-90">{line.label}</p>
                        <a
                          className="mt-1 inline-flex items-center gap-2 rounded-full bg-on-error-container px-5 py-2.5 font-headline text-lg font-bold text-white transition-opacity hover:opacity-90"
                          href={line.href}
                        >
                          <span className="material-symbols-outlined text-xl">call</span>
                          {line.display}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm opacity-90">Phase 9 contact numbers will appear here when configured in Locations (admin).</p>
                )}
              </div>
              <div className="absolute -bottom-10 -right-10 h-40 w-40 animate-pulse rounded-full bg-error/10" />
            </div>

            <div className="rounded-xl bg-surface-container-low p-8">
              <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-on-surface">
                <span className="material-symbols-outlined">schedule</span>
                Branch hours
              </h3>
              <div className="space-y-3 text-sm">
                {locations.map((loc) => (
                  <div key={loc.id} className="border-b border-outline-variant/10 py-2 last:border-0">
                    <p className="font-semibold text-on-surface">{loc.name}</p>
                    <p className="text-on-surface-variant">{loc.hoursLabel?.trim() || "Hours on request"}</p>
                  </div>
                ))}
                {!locations.length ? <p className="text-on-surface-variant">Configure hours per location in admin.</p> : null}
              </div>
            </div>

            <div className="rounded-xl bg-surface-container-highest p-8">
              <h3 className="mb-4 text-lg font-bold text-on-surface">Locations</h3>
              <ul className="space-y-4 text-sm text-on-surface-variant">
                {branchesPhase9.length > 0
                  ? branchesPhase9.map((branch) => (
                      <li key={branch.id}>
                        <p className="font-semibold text-on-surface">{branch.name}</p>
                        <p>
                          {[branch.address_line1, branch.city, branch.state, branch.postal_code, branch.country].filter(Boolean).join(", ")}
                        </p>
                        {branch.phone?.trim() ? <p className="mt-1">Tel: {branch.phone}</p> : null}
                      </li>
                    ))
                  : locations.length > 0
                    ? locations.map((loc) => (
                        <li key={loc.id}>
                          <p className="font-semibold text-on-surface">{loc.name}</p>
                          <p>{loc.addressLines.join(", ")}</p>
                          {loc.phoneDisplay?.trim() ? <p className="mt-1">Tel: {loc.phoneDisplay}</p> : null}
                        </li>
                      ))
                    : (
                        <li className="text-on-surface-variant">Phase 9 address and phone will appear here when configured.</li>
                      )}
              </ul>
              <Link href="/locations" className="mt-4 inline-block text-sm font-bold text-primary hover:underline">
                View all locations →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
