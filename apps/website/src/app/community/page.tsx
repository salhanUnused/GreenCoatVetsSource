import Link from "next/link";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getMergedPageContent } from "@/lib/marketing/get-marketing-site";
import { applyClinicPlaceholders } from "@/lib/marketing/page-content";
import { marketingPageMetadata } from "@/lib/marketing/page-metadata";

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return marketingPageMetadata({ slug: "community", clinicName: clinic.name, path: "/community" });
}

export default async function CommunityPage() {
  const clinic = await resolveClinic();
  const page = await getMergedPageContent("community");
  const s = page.sections;
  const t = (value: string | undefined) => applyClinicPlaceholders(value ?? "", clinic.name);
  const cards = [
    { title: s.card_1_title, body: s.card_1_body },
    { title: s.card_2_title, body: s.card_2_body },
    { title: s.card_3_title, body: s.card_3_body },
  ].filter((c) => c.title);

  return (
    <main className="bg-surface pb-20">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">{t(s.eyebrow)}</p>
        <h1 className="mt-2 font-headline text-4xl font-extrabold text-on-surface sm:text-5xl">{t(s.title)}</h1>
        <p className="mt-4 text-xl font-medium text-primary">&ldquo;{t(s.tagline)}&rdquo;</p>
        <p className="mt-6 text-lg leading-relaxed text-on-surface-variant">{t(s.intro)}</p>

        <h2 className="mt-12 font-headline text-2xl font-bold text-on-surface">{t(s.partnerships_heading)}</h2>
        <p className="mt-4 text-on-surface-variant">{t(s.partnerships_intro)}</p>

        <ul className="mt-6 space-y-6 text-on-surface-variant">
          {cards.map((card) => (
            <li key={card.title} className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5">
              <strong className="text-on-surface">{t(card.title)}</strong>
              <p className="mt-2">{t(card.body)}</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-12 font-headline text-2xl font-bold text-on-surface">{t(s.why_heading)}</h2>
        <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">{t(s.why_body)}</p>

        <h2 className="mt-12 font-headline text-2xl font-bold text-on-surface">{t(s.collaborate_heading)}</h2>
        <p className="mt-4 text-on-surface-variant">{t(s.collaborate_body)}</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/contact"
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-bold uppercase tracking-wide text-on-primary"
          >
            Contact us
          </Link>
          <Link
            href="/locations"
            className="inline-flex h-12 items-center justify-center rounded-full border border-outline-variant px-8 text-sm font-bold uppercase tracking-wide text-on-surface"
          >
            Locations
          </Link>
        </div>
      </div>
    </main>
  );
}
