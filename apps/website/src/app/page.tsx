import Link from "next/link";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import {
  buildHeroSlideUrls,
  getMarketingLocationsOrDefaults,
  getMarketingSiteSettings,
  getPageContent,
  mergeHomepageImages,
} from "@/lib/marketing/get-marketing-site";
import { DEFAULT_MARKETING_LOCATIONS, getDirectionsUrl } from "@/lib/marketing/default-locations";
import {
  applyClinicPlaceholders,
  sectionLines,
  sectionParagraphs,
  sectionTitleBodyLines,
} from "@/lib/marketing/page-content";
import { marketingPageMetadata } from "@/lib/marketing/page-metadata";
import { HeroImageSlider } from "@/components/site/hero-image-slider";
import { InstagramHomeEmbeds } from "@/components/site/instagram-home-embeds";
import { HomeGallerySection } from "@/components/site/home-gallery-section";
import { HomeWelcomeVideoSection } from "@/components/site/home-welcome-video-section";
import { createClient } from "@/lib/supabase/server";
import { getMarketingTeamMembers } from "@/lib/marketing/get-team-members";
import { HomeTeamSection } from "@/components/site/home-team-section";
import type { MarketingLocationPublic } from "@/lib/marketing/types";

const WHY_ICONS = ["stethoscope", "biotech", "pets", "medical_services", "volunteer_activism", "favorite"] as const;
const SERVICE_ICONS = [
  "stethoscope",
  "orthopedics",
  "emergency",
  "visibility",
  "dentistry",
  "biotech",
  "pets",
  "agriculture",
] as const;

function findLocation(
  locations: MarketingLocationPublic[],
  patterns: RegExp[],
): MarketingLocationPublic | undefined {
  return locations.find((loc) => {
    const hay = `${loc.id} ${loc.name}`.toLowerCase();
    return patterns.some((p) => p.test(hay));
  });
}

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return marketingPageMetadata({ slug: "home", clinicName: clinic.name, path: "/" });
}

export default async function Home() {
  const clinic = await resolveClinic();
  const [marketing, publicLocations, teamMembers] = await Promise.all([
    getMarketingSiteSettings(),
    getMarketingLocationsOrDefaults(),
    getMarketingTeamMembers(),
  ]);
  const images = mergeHomepageImages(marketing.homepage_images);
  const heroSlides = buildHeroSlideUrls(images, marketing.homepage_images ?? {});
  const page = getPageContent("home", marketing.page_content ?? {});
  const s = page.sections ?? {};
  const t = (value: string | undefined) => applyClinicPlaceholders(value ?? "", clinic.name ?? "");
  const serviceCards = sectionTitleBodyLines(s, "services_list");
  const faqPreview = sectionLines(s, "faq_preview_list");
  const whyUs = [1, 2, 3, 4, 5, 6]
    .map((n, i) => ({
      title: s[`why_${n}_title`] ?? "",
      body: s[`why_${n}_body`] ?? "",
      icon: WHY_ICONS[i] ?? "pets",
    }))
    .filter((w) => w.title);
  const promiseParas = sectionParagraphs(s, "promise_body").map(t);
  const surgeryParas = sectionParagraphs(s, "surgery_body").map(t);
  const ctaParas = sectionParagraphs(s, "cta_body").map(t);
  const social = marketing.social_links ?? {};
  const instagramUrl =
    (typeof social.instagram_url === "string" && social.instagram_url.trim()) || "https://www.instagram.com";
  const facebookUrl =
    (typeof social.facebook_url === "string" && social.facebook_url.trim()) || "https://www.facebook.com";

  const homepageLocationCards = [
    {
      title: t(s.loc_1_title),
      body: t(s.loc_1_body),
      loc:
        findLocation(publicLocations, [/phase\s*9/, /phase-9/]) ??
        findLocation(DEFAULT_MARKETING_LOCATIONS, [/phase\s*9/, /phase-9/]),
    },
    {
      title: t(s.loc_2_title),
      body: t(s.loc_2_body),
      loc: findLocation(publicLocations, [/kharar/]) ?? findLocation(DEFAULT_MARKETING_LOCATIONS, [/kharar/]),
    },
    {
      title: t(s.loc_3_title),
      body: t(s.loc_3_body),
      loc: findLocation(publicLocations, [/ropar|rupnagar/]) ?? findLocation(DEFAULT_MARKETING_LOCATIONS, [/ropar|rupnagar/]),
    },
  ].filter((card) => card.loc);

  const supabase = createClient();
  let testimonialRows: { quote: string; label: string; img: string; stars: number }[] = [];
  try {
    const { data: reviews } = await supabase
      .from("marketing_reviews")
      .select("id, reviewer_name, pet_name, message, stars, owner_image_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(8);
    testimonialRows =
      reviews?.map((row) => ({
        quote: row.message as string,
        label: `${row.pet_name} - ${row.reviewer_name}`,
        img: (row.owner_image_url as string | null) ?? "",
        stars: Number(row.stars ?? 5),
      })) ?? [];
  } catch {
    testimonialRows = [];
  }

  const localBusinessLd = {
    "@context": "https://schema.org",
    "@type": "VeterinaryCare",
    name: clinic.name,
    url: "/",
    areaServed: ["Mohali", "Kharar", "Ropar", "Chandigarh Tricity"],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLd) }} />
      <main className="bg-surface">
        {/* Hero */}
        <section className="relative flex min-h-[min(92vh,880px)] items-center overflow-hidden bg-surface">
          <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-6 py-12 lg:grid-cols-2 lg:gap-12 lg:py-16">
            <div className="space-y-6 lg:space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-fixed/20 px-4 py-2 font-label text-sm font-semibold text-on-primary-fixed-variant">
                <span className="material-symbols-outlined text-base">pets</span>
                {t(s.hero_eyebrow)}
              </div>
              <h1 className="font-headline text-[clamp(1.75rem,4.2vw,2.75rem)] font-extrabold leading-[1.12] tracking-tight text-on-background sm:text-4xl md:text-[clamp(2rem,3.5vw,2.75rem)] lg:text-5xl">
                {t(s.hero_title)}
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-on-surface-variant">{t(s.hero_body)}</p>
              <div className="grid grid-cols-2 items-stretch gap-3 pt-2 sm:flex sm:flex-wrap sm:gap-4">
                <Link
                  href="/book"
                  className="gradient-primary flex min-h-[3.25rem] min-w-0 items-center justify-center rounded-xl px-3 py-2.5 text-center font-headline text-sm font-bold leading-snug text-on-primary shadow-xl shadow-primary/25 transition-transform hover:scale-[0.98] sm:min-h-0 sm:px-8 sm:py-4 sm:text-lg"
                >
                  Book an Appointment
                </Link>
                <Link
                  href="/services"
                  className="flex min-h-[3.25rem] min-w-0 items-center justify-center rounded-xl bg-surface-container-low px-3 py-2.5 text-center font-headline text-sm font-bold leading-snug text-on-surface transition-colors hover:bg-surface-container-high sm:min-h-0 sm:px-8 sm:py-4 sm:text-lg"
                >
                  Explore Our Services
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -right-10 -top-10 -z-10 h-72 w-72 rounded-full bg-primary-fixed/30 blur-3xl sm:h-96 sm:w-96" />
              <HeroImageSlider urls={heroSlides} alt="Veterinarian caring for a pet" />
              <div className="glass-panel absolute -bottom-4 -left-2 hidden rounded-2xl border border-white/20 p-5 shadow-xl md:block md:-bottom-6 md:-left-6 md:p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-tertiary-fixed">
                    <span className="material-symbols-outlined text-on-tertiary-fixed" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified
                    </span>
                  </div>
                  <div>
                    <div className="font-headline text-lg font-bold text-on-surface">Our promise to you</div>
                    <div className="text-sm text-on-surface-variant">Trusted pet care across the Tricity</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Promise */}
        <section className="bg-surface-container-low py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">{t(s.promise_eyebrow)}</p>
            <h2 className="mt-3 font-headline text-3xl font-extrabold text-on-surface sm:text-4xl lg:text-5xl">
              {t(s.promise_heading)}
            </h2>
            {promiseParas.map((p) => (
              <p key={p.slice(0, 40)} className="mt-6 max-w-3xl text-lg leading-relaxed text-on-surface-variant">
                {p}
              </p>
            ))}
          </div>
        </section>

        {/* Services */}
        <section className="bg-surface py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">{t(s.services_eyebrow)}</p>
            <h2 className="mt-3 font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">{t(s.services_heading)}</h2>
            <p className="mt-3 max-w-3xl text-on-surface-variant">{t(s.services_body)}</p>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {serviceCards.map((card, i) => (
                <li
                  key={card.title}
                  className="flex flex-col rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm"
                >
                  <span className="material-symbols-outlined text-3xl text-primary">{SERVICE_ICONS[i] ?? "pets"}</span>
                  <h3 className="mt-4 font-headline text-lg font-bold text-on-surface">{card.title}</h3>
                  {card.body ? <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{card.body}</p> : null}
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <Link
                href="/services"
                className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-bold uppercase tracking-wide text-on-primary"
              >
                View All Services
              </Link>
            </div>
          </div>
        </section>

        {/* Specialized surgery */}
        <section className="bg-surface-container-low py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">{t(s.surgery_eyebrow)}</p>
            <h2 className="mt-3 font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">{t(s.surgery_heading)}</h2>
            {surgeryParas.map((p) => (
              <p key={p.slice(0, 40)} className="mt-6 max-w-3xl text-lg leading-relaxed text-on-surface-variant">
                {p}
              </p>
            ))}
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="rounded-[1.5rem] border border-outline-variant/25 bg-surface-container-lowest px-6 py-6 text-center shadow-sm"
                >
                  <p className="font-headline text-2xl font-extrabold text-primary sm:text-3xl">{s[`surgery_stat_${n}_value`]}</p>
                  <p className="mt-2 text-sm font-medium text-on-surface-variant">{s[`surgery_stat_${n}_label`]}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why rely on us */}
        <section className="bg-surface py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">{t(s.why_eyebrow)}</p>
            <h2 className="mt-3 font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">{t(s.why_heading)}</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {whyUs.map((w) => (
                <div key={w.title} className="rounded-[2rem] border border-outline-variant/25 bg-surface-container-lowest p-8 shadow-sm">
                  <span className="material-symbols-outlined text-3xl text-primary">{w.icon}</span>
                  <h3 className="mt-4 font-headline text-xl font-bold text-on-surface">{w.title}</h3>
                  <p className="mt-3 leading-relaxed text-on-surface-variant">{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <HomeWelcomeVideoSection clinicName={clinic.name} videoUrl={marketing.welcome_video_url} />

        <HomeGallerySection clinicName={clinic.name} urls={marketing.gallery_image_urls ?? []} />

        <HomeTeamSection
          members={teamMembers}
          eyebrow={t(s.team_eyebrow)}
          heading={t(s.team_heading)}
          body={t(s.team_body)}
        />

        <InstagramHomeEmbeds
          urls={marketing.instagram_embed_urls}
          eyebrow={t(s.instagram_eyebrow)}
          heading={t(s.instagram_heading)}
          body={t(s.instagram_body)}
          profileUrl={instagramUrl}
        />

        {/* Ratings */}
        <section className="bg-surface py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col items-start gap-6 rounded-[2rem] border border-outline-variant/30 bg-gradient-to-br from-primary/10 to-surface-container-low p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
              <div>
                <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">{t(s.ratings_eyebrow)}</p>
                <p className="mt-2 font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">{t(s.ratings_heading)}</p>
                <div className="mt-3 flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      star
                    </span>
                  ))}
                </div>
              </div>
              <p className="max-w-md text-on-surface-variant">{t(s.ratings_body)}</p>
            </div>
          </div>
        </section>

        {/* Testimonials — real reviews only */}
        {testimonialRows.length ? (
          <section className="overflow-hidden bg-surface-container-low py-20 sm:py-24">
            <div className="relative mx-auto max-w-7xl px-6">
              <div className="mb-10 space-y-3 sm:mb-12">
                <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">{t(s.testimonials_eyebrow)}</p>
                <h2 className="font-headline text-3xl font-extrabold sm:text-4xl">{t(s.testimonials_heading)}</h2>
                <p className="max-w-3xl text-lg leading-relaxed text-on-surface-variant">{t(s.testimonials_intro)}</p>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {testimonialRows.map((row) => (
                  <div key={row.label} className="relative rounded-[2rem] bg-surface-container-lowest p-8 shadow-sm">
                    <div className="mb-6 flex gap-0.5">
                      {Array.from({ length: Math.max(1, Math.min(5, row.stars)) }).map((_, i) => (
                        <span key={i} className="material-symbols-outlined text-sm text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
                          star
                        </span>
                      ))}
                    </div>
                    <p className="mb-8 text-lg italic leading-relaxed text-on-surface">&ldquo;{row.quote}&rdquo;</p>
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-200">
                        {row.img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.img} alt="" width={48} height={48} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">N/A</div>
                        )}
                      </div>
                      <div className="font-headline font-bold text-on-surface">{row.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* Locations */}
        <section className="bg-surface py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">{t(s.locations_heading)}</h2>
            <p className="mt-3 max-w-3xl text-on-surface-variant">{t(s.locations_intro)}</p>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {homepageLocationCards.map((card) => {
                const loc = card.loc;
                if (!loc) return null;
                return (
                  <address
                    key={loc.id}
                    className="not-italic rounded-[2rem] border border-outline-variant/30 bg-surface-container-low p-6 shadow-sm"
                  >
                    <h3 className="font-headline text-lg font-bold text-primary">{card.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">{card.body}</p>
                    <a
                      href={getDirectionsUrl(loc)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
                    >
                      Get Directions <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </a>
                  </address>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ teaser */}
        <section className="bg-surface-container-low py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-6 text-center sm:text-left">
            <h2 className="font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">{s.faq_heading}</h2>
            <p className="mt-3 text-on-surface-variant">{s.faq_body}</p>
            <ul className="mt-8 space-y-3 text-left">
              {faqPreview.map((q) => (
                <li
                  key={q}
                  className="flex items-start gap-3 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3 text-on-surface"
                >
                  <span className="material-symbols-outlined mt-0.5 shrink-0 text-lg text-primary">help</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/faq"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-bold uppercase tracking-wide text-on-primary"
            >
              Open interactive FAQ
            </Link>
          </div>
        </section>

        {/* Follow */}
        <section className="border-t border-outline-variant/20 bg-surface py-12">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
            <div className="text-center sm:text-left">
              <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">{t(s.follow_eyebrow)}</p>
              <p className="mt-1 font-headline text-xl font-bold text-on-surface">{t(s.follow_heading)}</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-on-surface-variant">{t(s.follow_body)}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {instagramUrl ? (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-lg">photo_camera</span>
                  Instagram
                </a>
              ) : null}
              {facebookUrl ? (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-lg">thumb_up</span>
                  Facebook
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
          <div className="gradient-primary relative overflow-hidden rounded-[2rem] p-10 text-center text-on-primary shadow-2xl shadow-primary/30 sm:rounded-[3rem] sm:p-16 lg:p-20">
            <div className="pointer-events-none absolute left-0 top-0 h-full w-full opacity-10">
              <span className="material-symbols-outlined absolute -left-10 -top-20 text-[280px] sm:text-[360px]">medical_services</span>
            </div>
            <div className="relative z-10 space-y-6 sm:space-y-8">
              <h2 className="mx-auto max-w-4xl font-headline text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
                {t(s.cta_heading)}
              </h2>
              {ctaParas.map((p) => (
                <p key={p.slice(0, 40)} className="mx-auto max-w-2xl text-lg opacity-90 sm:text-xl">
                  {p}
                </p>
              ))}
              <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row sm:gap-6">
                <Link
                  href="/book"
                  className="w-full rounded-2xl bg-surface-container-lowest px-8 py-4 font-headline text-lg font-bold text-primary shadow-lg transition-colors hover:bg-surface sm:w-auto sm:px-10 sm:py-5 sm:text-xl"
                >
                  Book an Appointment
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Quick links */}
        <section className="border-t border-outline-variant/20 bg-surface-container-low/50 py-10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 px-6 text-sm sm:gap-6">
            <Link href="/about" className="font-semibold text-primary hover:underline">
              About us
            </Link>
            <span className="hidden text-on-surface-variant sm:inline">·</span>
            <Link href="/community" className="font-semibold text-primary hover:underline">
              Community work
            </Link>
            <span className="hidden text-on-surface-variant sm:inline">·</span>
            <Link href="/faq" className="font-semibold text-primary hover:underline">
              FAQ
            </Link>
            <span className="hidden text-on-surface-variant sm:inline">·</span>
            <Link href="/team" className="font-semibold text-primary hover:underline">
              Team
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
