import Link from "next/link";
import { LocationsMap } from "@/components/locations/locations-map";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getDirectionsUrl } from "@/lib/marketing/default-locations";
import {
  getMarketingLocationsOrDefaults,
  getMarketingSiteSettings,
  getPageContent,
  mergeHomepageImages,
} from "@/lib/marketing/get-marketing-site";
import { applyClinicPlaceholders } from "@/lib/marketing/page-content";
import { marketingPageMetadata } from "@/lib/marketing/page-metadata";

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return marketingPageMetadata({ slug: "locations", clinicName: clinic.name, path: "/locations" });
}

export default async function LocationsPage() {
  const clinic = await resolveClinic();
  const marketing = await getMarketingSiteSettings();
  const imgs = mergeHomepageImages(marketing.homepage_images);
  const page = getPageContent("locations", marketing.page_content);
  const s = page.sections;
  const t = (value: string | undefined) => applyClinicPlaceholders(value ?? "", clinic.name);
  const locations = await getMarketingLocationsOrDefaults();
  const pinnedCount = locations.filter(
    (l) => l.latitude != null && l.longitude != null && Number.isFinite(l.latitude) && Number.isFinite(l.longitude),
  ).length;

  return (
    <main className="bg-surface pb-20">
      {/* Hero */}
      <header className="mx-auto mb-12 max-w-7xl px-6 pt-8 sm:mb-16 sm:pt-12">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="mb-4 block font-headline text-xs font-bold uppercase tracking-widest text-primary">{t(s.eyebrow)}</span>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl lg:text-6xl">
              {t(s.title_line1)} <br className="hidden sm:block" />
              at your <span className="text-primary">{t(s.title_highlight)}</span>
            </h1>
          </div>
          <p className="max-w-md text-lg leading-relaxed text-on-surface-variant">{t(s.intro)}</p>
        </div>
      </header>

      {/* Map + list */}
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 lg:grid-cols-12 lg:gap-8">
        <div className="relative h-[280px] overflow-hidden rounded-2xl shadow-sm sm:h-[360px] lg:col-span-7 lg:h-[min(640px,78vh)] lg:min-h-[520px]">
          <LocationsMap locations={locations} />
          <div className="glass-panel pointer-events-none absolute bottom-4 left-4 right-4 z-10 rounded-xl border border-white/20 p-4 shadow-xl md:right-auto">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="flex items-center gap-2 font-bold uppercase tracking-tighter text-on-surface-variant">
                <span className="h-3 w-3 rounded-full bg-primary" /> {locations.length} locations
              </span>
              <span className="hidden text-on-surface-variant sm:inline">·</span>
              <span className="text-on-surface-variant">
                {pinnedCount === locations.length
                  ? "Interactive map"
                  : `${pinnedCount} on map — add lat/lng in admin for the rest`}
              </span>
            </div>
          </div>
        </div>

        <div className="max-h-[min(800px,78vh)] space-y-4 overflow-y-auto pr-1 lg:col-span-5">
          {locations.map((loc) => {
            const is247 = loc.hoursLabel.includes("24/7");
            return (
              <article
                key={loc.id}
                className="group rounded-2xl border border-transparent bg-surface-container-lowest p-6 shadow-sm transition-all hover:border-primary/15 hover:shadow-md sm:p-8"
              >
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-headline text-xl font-extrabold text-on-surface transition-colors group-hover:text-primary sm:text-2xl">
                    {loc.name}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                      is247 ? "bg-primary-fixed text-on-primary-fixed" : "bg-secondary-fixed text-on-secondary-fixed"
                    }`}
                  >
                    {is247 ? "24/7 call" : "Scheduled"}
                  </span>
                </div>

                <div className="space-y-4 text-sm text-on-surface-variant">
                  <p className="flex items-start gap-3">
                    <span className="material-symbols-outlined shrink-0 text-primary">location_on</span>
                    <span className="leading-relaxed">
                      {loc.addressLines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </span>
                  </p>
                  <p className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">call</span>
                    <a href={loc.telHref} className="font-semibold text-on-surface hover:text-primary">
                      {loc.phoneDisplay}
                    </a>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="material-symbols-outlined shrink-0 text-primary">schedule</span>
                    <span>
                      {is247 ? (
                        <span className="font-semibold text-on-surface">{loc.hoursLabel}</span>
                      ) : (
                        <>
                          <span className="font-semibold text-on-surface">Timings</span>
                          <span className="ml-2">{loc.hoursLabel}</span>
                        </>
                      )}
                    </span>
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-3 border-t border-surface-container pt-5">
                  <a
                    href={getDirectionsUrl(loc)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition-opacity hover:opacity-90"
                  >
                    <span className="material-symbols-outlined text-lg">directions</span>
                    Get directions
                  </a>
                  <a
                    href={loc.telHref}
                    className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-bold text-on-surface transition-colors hover:border-primary hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-lg">call</span>
                    Call now
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Facilities highlight */}
      <section className="mx-auto mt-20 max-w-7xl px-6 sm:mt-28">
        <div className="mb-10 sm:mb-12">
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">Facilities highlight</h2>
          <div className="mt-4 h-1 w-20 rounded-full bg-primary" />
        </div>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          <div className="group">
            <div className="mb-6 h-56 overflow-hidden rounded-xl sm:h-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgs.facility_surgery}
                alt="Surgical suite"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface">Surgical excellence</h3>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              Sterile theatres and experienced teams for elective and urgent procedures.
            </p>
          </div>
          <div className="group">
            <div className="mb-6 h-56 overflow-hidden rounded-xl sm:h-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgs.facility_calm}
                alt="Calm clinic environment"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface">Calm environments</h3>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              Spaces designed to reduce stress for pets and families at every visit.
            </p>
          </div>
          <div className="group">
            <div className="mb-6 h-56 overflow-hidden rounded-xl sm:h-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgs.facility_lab}
                alt="Diagnostic laboratory"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface">Rapid diagnostics</h3>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              In-house lab and imaging support faster, more confident treatment decisions.
            </p>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
          <Link
            href="/book"
            className="gradient-primary inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-bold uppercase tracking-wide text-on-primary shadow-lg shadow-primary/25"
          >
            Book appointment
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-12 items-center justify-center rounded-full border border-outline-variant px-8 text-sm font-bold uppercase tracking-wide text-on-surface hover:border-primary hover:text-primary"
          >
            Contact us
          </Link>
        </div>
      </section>
    </main>
  );
}
