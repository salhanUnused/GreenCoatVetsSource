import { FaqAccordion, type FaqItem } from "@/components/faq/faq-accordion";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getMergedPageContent } from "@/lib/marketing/get-marketing-site";
import { applyClinicPlaceholders } from "@/lib/marketing/page-content";
import { marketingPageMetadata } from "@/lib/marketing/page-metadata";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return marketingPageMetadata({ slug: "faq", clinicName: clinic.name, path: "/faq" });
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "animals",
    question: "What types of animals do you treat?",
    answer: (
      <>
        <p className="mb-3">
          We provide expert care for <strong>canines, felines, exotics, avian, and equine</strong> patients. Whether it&apos;s a puppy,
          parrot, or pony — we&apos;ve got them covered.
        </p>
      </>
    ),
  },
  {
    id: "services",
    question: "What services do you offer at your clinics?",
    answer: (
      <ul className="list-inside list-disc space-y-2">
        <li>Specialized OPDs</li>
        <li>Major &amp; minor surgeries</li>
        <li>In-house diagnostics and pathology</li>
        <li>Dentistry</li>
        <li>Pet grooming</li>
        <li>Boarding</li>
        <li>Pharmacy</li>
        <li>Community outreach (low-cost spaying, vaccinations, etc.)</li>
      </ul>
    ),
  },
  {
    id: "vaccination",
    question: "Do you offer vaccination?",
    answer: (
      <p>
        Yes. We offer essential pet vaccinations, including <strong>free rabies vaccines</strong> as part of our{" "}
        <strong>Tricity Rabies-Free</strong> campaign, subject to campaign availability.
      </p>
    ),
  },
  {
    id: "idexx",
    question: "What technology do you use for diagnostics?",
    answer: (
      <p>
        We use <strong>IDEXX</strong> — one of the world&apos;s most advanced diagnostic systems — for accurate, reliable results that
        help us treat with confidence.
      </p>
    ),
  },
  {
    id: "booking",
    question: "How can I book an appointment?",
    answer: (
      <p>
        Use our <strong>online booking</strong> on this website, call your nearest branch, or reach out via the contact form. We
        recommend booking ahead for non-urgent visits.
      </p>
    ),
  },
  {
    id: "emergency",
    question: "Do you provide emergency services?",
    answer: (
      <p>
        Yes — we handle <strong>urgent cases during operational hours</strong>. For after-hours emergencies, please call our helpline
        and we will guide you on next steps.
      </p>
    ),
  },
  {
    id: "different",
    question: "What makes GreenCoatVets different?",
    answer: (
      <p>
        Our approach is <strong>community-first, pet-focused, and technology-driven</strong>. We combine expert care with compassion,
        aiming for a stress-free experience for both pets and owners.
      </p>
    ),
  },
];

export default async function FaqPage() {
  const clinic = await resolveClinic();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketing_faqs")
    .select("id, question, answer")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const dbItems: FaqItem[] =
    !error && (data?.length ?? 0) > 0
      ? (data ?? []).map((row) => ({
          id: row.id as string,
          question: row.question as string,
          answer: <p>{row.answer as string}</p>,
        }))
      : [];
  const items = dbItems.length > 0 ? dbItems : FAQ_ITEMS;
  const page = await getMergedPageContent("faq");
  const s = page.sections;
  const t = (value: string | undefined) => applyClinicPlaceholders(value ?? "", clinic.name);

  return (
    <main className="bg-surface pb-20">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">{t(s.eyebrow)}</p>
        <h1 className="mt-2 font-headline text-4xl font-extrabold text-on-surface sm:text-5xl">{t(s.title)}</h1>
        <p className="mt-4 text-lg text-on-surface-variant">{t(s.intro)}</p>
        <div className="mt-10">
          <FaqAccordion items={items} />
        </div>
      </div>
    </main>
  );
}
