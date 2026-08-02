import Link from "next/link";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getMergedPageContent } from "@/lib/marketing/get-marketing-site";
import { applyClinicPlaceholders, sectionLines, sectionParagraphs } from "@/lib/marketing/page-content";
import { marketingPageMetadata } from "@/lib/marketing/page-metadata";

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return marketingPageMetadata({ slug: "about", clinicName: clinic.name, path: "/about" });
}

export default async function AboutPage() {
  const clinic = await resolveClinic();
  const page = await getMergedPageContent("about");
  const s = page.sections;
  const t = (value: string | undefined) => applyClinicPlaceholders(value ?? "", clinic.name);
  const whyBullets = sectionLines(s, "why_bullets");
  const stats = sectionLines(s, "stats_list");
  const impactParas = sectionParagraphs(s, "impact_body").map(t);
  const missionParas = sectionParagraphs(s, "mission_body").map(t);
  const promises = sectionLines(s, "promise_list");

  return (
    <main className="bg-surface pb-20">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">{t(s.eyebrow)}</p>
        <h1 className="mt-2 font-headline text-4xl font-extrabold text-on-surface sm:text-5xl">{t(s.title)}</h1>

        <section className="mt-12">
          <h2 className="font-headline text-2xl font-bold text-on-surface">{t(s.who_heading)}</h2>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">{t(s.who_p1)}</p>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">{t(s.who_p2)}</p>
        </section>

        <section className="mt-14">
          <h2 className="font-headline text-2xl font-bold text-on-surface">{t(s.why_heading)}</h2>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">{t(s.why_intro)}</p>
          <ul className="mt-8 space-y-4 text-on-surface-variant">
            {whyBullets.map((line) => {
              const [title, ...rest] = line.split(" — ");
              const body = rest.join(" — ");
              return (
                <li key={line}>
                  <strong className="text-on-surface">{title}</strong>
                  {body ? <> — {body}</> : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-8 text-lg leading-relaxed text-on-surface-variant">{t(s.stats_intro)}</p>
          <ul className="mt-4 space-y-2 text-on-surface-variant">
            {stats.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-6 text-lg leading-relaxed text-on-surface-variant">{t(s.stats_outro)}</p>
          <p className="mt-6 text-center text-2xl" aria-hidden>
            ▼・ᴥ・▼
          </p>
          <p className="mt-2 text-center text-lg font-medium text-on-surface">{t(s.pride_line)}</p>
        </section>

        <section className="mt-14">
          <h2 className="font-headline text-2xl font-bold text-on-surface">{t(s.impact_heading)}</h2>
          {impactParas.map((p) => (
            <p key={p.slice(0, 48)} className="mt-4 text-lg leading-relaxed text-on-surface-variant">
              {p}
            </p>
          ))}
          <p className="mt-6">
            <Link href="/community" className="font-bold text-primary underline-offset-4 hover:underline">
              Read about our community work →
            </Link>
          </p>
        </section>

        <section className="mt-14">
          <h2 className="font-headline text-2xl font-bold text-on-surface">{t(s.mission_heading)}</h2>
          {missionParas.map((p) => (
            <p key={p.slice(0, 48)} className="mt-4 text-lg leading-relaxed text-on-surface-variant">
              {p}
            </p>
          ))}
          <p className="mt-6 font-bold text-on-surface">{t(s.promise_intro)}</p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-on-surface-variant">
            {promises.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-6 text-lg font-medium text-on-surface">{t(s.promise_outro)}</p>
        </section>

        <div className="mt-14 flex flex-wrap gap-4">
          <Link
            href="/book"
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-bold uppercase tracking-wide text-on-primary"
          >
            Book appointment
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-12 items-center justify-center rounded-full border border-outline-variant px-8 text-sm font-bold uppercase tracking-wide text-on-surface"
          >
            Contact
          </Link>
        </div>
      </div>
    </main>
  );
}
