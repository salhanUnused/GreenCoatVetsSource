import Link from "next/link";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import {
  buildHeroSlideUrls,
  getMarketingLocationsOrDefaults,
  getMarketingSiteSettings,
  getPageContent,
  mergeHomepageCopy,
  mergeHomepageImages,
} from "@/lib/marketing/get-marketing-site";
import { sectionLines } from "@/lib/marketing/page-content";
import { marketingPageMetadata } from "@/lib/marketing/page-metadata";
import { HeroImageSlider } from "@/components/site/hero-image-slider";
import { InstagramHomeEmbeds } from "@/components/site/instagram-home-embeds";
import { HomeGallerySection } from "@/components/site/home-gallery-section";
import { HomeWelcomeVideoSection } from "@/components/site/home-welcome-video-section";
import { createClient } from "@/lib/supabase/server";
import { getMarketingTeamMembers } from "@/lib/marketing/get-team-members";
import { HomeTeamSection } from "@/components/site/home-team-section";
import { getPlatformBranding } from "@/lib/platform-branding";

const WHY_ICONS = ["favorite", "event_available", "pets", "shield_with_heart", "visibility", "groups"] as const;

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return marketingPageMetadata({ slug: "home", clinicName: clinic.name, path: "/" });
}

export default async function Home() {
  const clinic = await resolveClinic();
  const [branding, marketing, publicLocations, teamMembers] = await Promise.all([
    getPlatformBranding(),
    getMarketingSiteSettings(),
    getMarketingLocationsOrDefaults(),
    getMarketingTeamMembers(),
  ]);
  const images = mergeHomepageImages(marketing.homepage_images);
  const heroCopy = mergeHomepageCopy(marketing.homepage_copy);
  const heroSlides = buildHeroSlideUrls(images, marketing.homepage_images);
  const page = getPageContent("home", marketing.page_content);
  const s = page.sections;
  const facilities = sectionLines(s, "facilities_list");
  const faqPreview = sectionLines(s, "faq_preview_list");
  const whyUs = [1, 2, 3, 4, 5, 6].map((n, i) => ({
    title: s[`why_${n}_title`] ?? "",
    body: s[`why_${n}_body`] ?? "",
    icon: WHY_ICONS[i] ?? "pets",
  })).filter((w) => w.title);
  const homepageLocations = publicLocations.slice(0, 3);
  const supabase = createClient();
  const [{ data: services }, { data: reviews }] = await Promise.all([
    supabase
      .from("services")
      .select("id, title, short_description, slug")
      .eq("clinic_id", clinic.id)
      .eq("is_active", true)
      .order("title", { ascending: true })
      .limit(6),
    supabase
      .from("marketing_reviews")
      .select("id, reviewer_name, pet_name, message, stars, owner_image_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(8),
  ]);
  const testimonialRows =
    reviews?.length
      ? reviews.map((row) => ({
          quote: row.message as string,
          label: `${row.pet_name} - ${row.reviewer_name}`,
          img: (row.owner_image_url as string | null) ?? "",
          stars: Number(row.stars ?? 5),
        }))
      : [
          {
            quote: "Thank you for doing such a great job caring for our Hurley! Such good care, really put my mind at ease. Thanks!",
            label: "Hurley - Vikki",
            img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAXLIVwem-WWiNRC8HpPXFVnRo0P-yZIdo12_IMKZ64tgeUso48c0sEo1ybz4wN8ILmlgpVZ4UiRZHe4w_l1KqKqtsw8iYwYSEU0Kj_Uduj2egsu0-mlOFFiFKjsh5gSJ_nGh6ooZgvp3rt4vGj0Xo7QWz_a61N9hTA12kkNbVPP_zwLzi8cRm-GfZTjhJp338UxEdp18qvL44N6NutC6e194mEhOxqbXd6Th_LC0ciA5PP2hPrY_wmjdlOhNIsTFHFaWirWOLBcI4",
            stars: 5,
          },
          {
            quote: "Kind, friendly and professional - and best of all Jacky absolutely loved them. I would recommend them to anyone looking for dog care.",
            label: "Jacky - Uday",
            img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAASNiqAa5i7M3JKCYXi4Byn3BaWf3Khqa9l0z9VWt7DIX7uAlPs7qlnFdw5519H7h5SjAxX5wlNjv-Uc6NqgtaL-jOGnRQsuo-y6K6TFSUqLeapYyg1JmNC8YiP_Hk73xYzZlGVajKZH7kQ7T6LHmE64-gre12TkuUZs8HgFogr0atwPnRKY49aN_bjC8hblSMZ3aVLHuEcJYLbW2TWVkM3w88y0Q1u9R9_7woJ9CBAjJ0QAHvIpEANHEuWUrvvXa_dmSWmNSIjCQ",
            stars: 5,
          },
        ];

  const localBusinessLd = {
    "@context": "https://schema.org",
    "@type": "VeterinaryCare",
    name: clinic.name,
    url: "/",
    areaServed: "Chandigarh Tricity",
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
                {branding.product_name}
              </div>
              <h1 className="font-headline text-[clamp(1.75rem,4.2vw,2.75rem)] font-extrabold leading-[1.12] tracking-tight text-on-background sm:text-4xl md:text-[clamp(2rem,3.5vw,2.75rem)] lg:text-5xl">
                {heroCopy.line1}
                <br />
                <span className="text-gradient">{heroCopy.gradient}</span>
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-on-surface-variant">{heroCopy.tagline}</p>
              <div className="grid grid-cols-2 items-stretch gap-3 pt-2 sm:flex sm:flex-wrap sm:gap-4">
                <Link
                  href="/about"
                  className="flex min-h-[3.25rem] min-w-0 items-center justify-center rounded-xl bg-surface-container-low px-3 py-2.5 text-center font-headline text-sm font-bold leading-snug text-on-surface transition-colors hover:bg-surface-container-high sm:min-h-0 sm:px-8 sm:py-4 sm:text-lg"
                >
                  Learn more
                </Link>
                <Link
                  href="/book"
                  className="gradient-primary flex min-h-[3.25rem] min-w-0 items-center justify-center rounded-xl px-3 py-2.5 text-center font-headline text-sm font-bold leading-snug text-on-primary shadow-xl shadow-primary/25 transition-transform hover:scale-[0.98] sm:min-h-0 sm:px-8 sm:py-4 sm:text-lg"
                >
                  <span className="sm:hidden">Book now</span>
                  <span className="hidden sm:inline">Book an appointment</span>
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
                    <div className="text-sm text-on-surface-variant">Expertise, empathy &amp; innovation</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Promise */}
        <section className="bg-surface-container-low py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">Our promise to you…</p>
            <h2 className="mt-3 font-headline text-3xl font-extrabold text-on-surface sm:text-4xl lg:text-5xl">
              Happy pets, <span className="text-gradient">happy humans</span>
            </h2>
            <p className="mt-4 max-w-3xl text-xl font-semibold text-on-surface">Your Pet&apos;s Health, Our Passion</p>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-on-surface-variant">
              {clinic.name} was born from a deep love for animals and a vision to provide Tricity with veterinary care that blends{" "}
              <strong className="text-on-surface">expertise, empathy, and innovation</strong>. Experienced vets, modern equipment, and a
              stress-free environment make us a trusted clinic for hundreds of pet parents.
            </p>
          </div>
        </section>

        {/* Facilities */}
        <section className="bg-surface py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">{s.facilities_heading}</h2>
            <p className="mt-3 max-w-2xl text-on-surface-variant">{s.facilities_body}</p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {facilities.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 font-semibold text-on-surface shadow-sm"
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            {services?.length ? (
              <div className="mt-12 rounded-2xl border border-outline-variant/30 bg-surface-container-low/80 p-6 backdrop-blur-sm sm:p-8">
                <h3 className="font-headline text-lg font-bold text-on-surface">Also explore at {clinic.name}</h3>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/services/${s.slug}`}
                        className="block rounded-xl bg-surface-container-low px-4 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        {s.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {/* Why rely on us */}
        <section className="bg-surface-container-low py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">{s.why_heading}</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {whyUs.map((w) => (
                <div key={w.title} className="rounded-[2rem] border border-outline-variant/25 bg-surface-container-lowest p-8 shadow-sm">
                  <span className="material-symbols-outlined text-3xl text-primary">{w.icon}</span>
                  <h3 className="mt-4 font-headline text-xl font-bold text-on-surface">{w.title}</h3>
                  <p className="mt-3 text-on-surface-variant leading-relaxed">{w.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <HomeWelcomeVideoSection clinicName={clinic.name} videoUrl={marketing.welcome_video_url} />

        <HomeGallerySection clinicName={clinic.name} urls={marketing.gallery_image_urls} />

        <HomeTeamSection members={teamMembers} />

        {marketing.instagram_embed_urls.length ? (
          <InstagramHomeEmbeds urls={marketing.instagram_embed_urls} />
        ) : null}

        {/* Ratings */}
        <section className="bg-surface py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col items-start gap-6 rounded-[2rem] border border-outline-variant/30 bg-gradient-to-br from-primary/10 to-surface-container-low p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
              <div>
                <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">Our ratings</p>
                <p className="mt-2 font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">4.8 on Google reviews</p>
                <div className="mt-3 flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      star
                    </span>
                  ))}
                </div>
              </div>
              <p className="max-w-md text-on-surface-variant">
                Thank you to every family who shares feedback — it helps us keep improving care for pets and people.
              </p>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="overflow-hidden bg-surface-container-low py-20 sm:py-24">
          <div className="relative mx-auto max-w-7xl px-6">
            <div className="mb-10 space-y-3 sm:mb-12">
              <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">Clients say</p>
              <h2 className="font-headline text-3xl font-extrabold sm:text-4xl">WOOF — real stories</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {testimonialRows.map((t) => (
                <div key={t.label} className="relative rounded-[2rem] bg-surface-container-lowest p-8 shadow-sm">
                  <div className="mb-6 flex gap-0.5">
                    {Array.from({ length: Math.max(1, Math.min(5, t.stars)) }).map((_, i) => (
                      <span key={i} className="material-symbols-outlined text-sm text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
                        star
                      </span>
                    ))}
                  </div>
                  <p className="mb-8 text-lg italic leading-relaxed text-on-surface">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-200">
                      {t.img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.img} alt="" width={48} height={48} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">N/A</div>
                      )}
                    </div>
                    <div className="font-headline font-bold text-on-surface">{t.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Locations */}
        <section className="bg-surface py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">Locations</h2>
            <p className="mt-3 text-on-surface-variant">Visit us at a branch that&apos;s convenient for you.</p>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {homepageLocations.map((loc) => (
                <address
                  key={loc.id}
                  className="not-italic rounded-[2rem] border border-outline-variant/30 bg-surface-container-low p-6 shadow-sm"
                >
                  <h3 className="font-headline text-lg font-bold text-primary">{loc.name}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
                    {loc.addressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </p>
                  <Link href="/locations" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
                    Directions &amp; hours <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </Link>
                </address>
              ))}
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
                  <span className="material-symbols-outlined mt-0.5 shrink-0 text-primary text-lg">help</span>
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
              <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">Stay connected</p>
              <p className="mt-1 font-headline text-xl font-bold text-on-surface">Follow {clinic.name}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="https://www.instagram.com"
            target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:border-primary hover:text-primary"
              >
                <span className="material-symbols-outlined text-lg">photo_camera</span>
                Instagram
          </a>
          <a
                href="https://www.facebook.com"
            target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:border-primary hover:text-primary"
          >
                <span className="material-symbols-outlined text-lg">thumb_up</span>
                Facebook
          </a>
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
                Book your visit today
              </h2>
              <p className="mx-auto max-w-2xl text-lg opacity-90 sm:text-xl">
                Online booking, clear communication, and a team that treats your pet like family.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row sm:gap-6">
                <Link
                  href="/book"
                  className="w-full rounded-2xl bg-surface-container-lowest px-8 py-4 font-headline text-lg font-bold text-primary shadow-lg transition-colors hover:bg-surface sm:w-auto sm:px-10 sm:py-5 sm:text-xl"
                >
                  Book an appointment
                </Link>
                <Link
                  href="/contact"
                  className="w-full rounded-2xl border border-white/30 bg-white/10 px-8 py-4 font-headline text-lg font-bold text-white backdrop-blur-md transition-colors hover:bg-white/20 sm:w-auto sm:px-10 sm:py-5 sm:text-xl"
                >
                  Contact us
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
