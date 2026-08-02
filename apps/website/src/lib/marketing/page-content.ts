export const MARKETING_PAGE_SLUGS = [
  "home",
  "about",
  "services",
  "community",
  "faq",
  "team",
  "doctors",
  "contact",
  "locations",
] as const;

export type MarketingPageSlug = (typeof MARKETING_PAGE_SLUGS)[number];

export type MarketingPageFieldType = "text" | "textarea" | "image";

export type MarketingPageFieldDef = {
  key: string;
  label: string;
  type: MarketingPageFieldType;
  rows?: number;
};

export type MarketingPageDef = {
  slug: MarketingPageSlug;
  label: string;
  path: string;
  fields: MarketingPageFieldDef[];
};

export type MarketingPageContent = {
  seo_title?: string;
  seo_description?: string;
  og_image_url?: string;
  sections?: Record<string, string>;
};

export type MarketingPageContentMap = Partial<Record<MarketingPageSlug, MarketingPageContent>>;

export const MARKETING_PAGE_DEFS: MarketingPageDef[] = [
  {
    slug: "home",
    label: "Home",
    path: "/",
    fields: [
      { key: "seo_title", label: "SEO title", type: "text" },
      { key: "seo_description", label: "SEO description", type: "textarea", rows: 3 },
      { key: "og_image_url", label: "OG / social image URL", type: "image" },
      { key: "facilities_heading", label: "Facilities heading", type: "text" },
      { key: "facilities_body", label: "Facilities intro", type: "textarea", rows: 3 },
      { key: "facilities_list", label: "Facilities list (one per line)", type: "textarea", rows: 8 },
      { key: "why_heading", label: "Why us heading", type: "text" },
      { key: "why_1_title", label: "Why card 1 title", type: "text" },
      { key: "why_1_body", label: "Why card 1 body", type: "textarea", rows: 2 },
      { key: "why_2_title", label: "Why card 2 title", type: "text" },
      { key: "why_2_body", label: "Why card 2 body", type: "textarea", rows: 2 },
      { key: "why_3_title", label: "Why card 3 title", type: "text" },
      { key: "why_3_body", label: "Why card 3 body", type: "textarea", rows: 2 },
      { key: "why_4_title", label: "Why card 4 title", type: "text" },
      { key: "why_4_body", label: "Why card 4 body", type: "textarea", rows: 2 },
      { key: "why_5_title", label: "Why card 5 title", type: "text" },
      { key: "why_5_body", label: "Why card 5 body", type: "textarea", rows: 2 },
      { key: "why_6_title", label: "Why card 6 title", type: "text" },
      { key: "why_6_body", label: "Why card 6 body", type: "textarea", rows: 2 },
      { key: "faq_heading", label: "FAQ teaser heading", type: "text" },
      { key: "faq_body", label: "FAQ teaser intro", type: "textarea", rows: 2 },
      { key: "faq_preview_list", label: "FAQ teaser questions (one per line)", type: "textarea", rows: 6 },
    ],
  },
  {
    slug: "about",
    label: "About",
    path: "/about",
    fields: [
      { key: "seo_title", label: "SEO title", type: "text" },
      { key: "seo_description", label: "SEO description", type: "textarea", rows: 3 },
      { key: "og_image_url", label: "OG / social image URL", type: "image" },
      { key: "eyebrow", label: "Page eyebrow", type: "text" },
      { key: "title", label: "Page title", type: "text" },
      { key: "who_heading", label: "Who we are heading", type: "text" },
      { key: "who_p1", label: "Who we are paragraph 1 (use {{clinicName}})", type: "textarea", rows: 4 },
      { key: "who_p2", label: "Who we are paragraph 2", type: "textarea", rows: 4 },
      { key: "why_heading", label: "Why choose us heading (use {{clinicName}})", type: "text" },
      { key: "why_intro", label: "Why choose us intro (use {{clinicName}})", type: "textarea", rows: 3 },
      { key: "why_bullets", label: "Why choose us bullets (one per line, Title — body)", type: "textarea", rows: 8 },
      { key: "stats_intro", label: "Stats intro", type: "textarea", rows: 2 },
      { key: "stats_list", label: "Stats list (one per line)", type: "textarea", rows: 4 },
      { key: "stats_outro", label: "Stats outro", type: "textarea", rows: 3 },
      { key: "pride_line", label: "Pride / mission line", type: "textarea", rows: 2 },
      { key: "impact_heading", label: "Impact heading", type: "text" },
      { key: "impact_body", label: "Impact body paragraphs (blank line between)", type: "textarea", rows: 8 },
      { key: "mission_heading", label: "Mission heading", type: "text" },
      { key: "mission_body", label: "Mission body paragraphs (blank line between)", type: "textarea", rows: 6 },
      { key: "promise_intro", label: "Promise intro label", type: "text" },
      { key: "promise_list", label: "Promise bullets (one per line)", type: "textarea", rows: 6 },
      { key: "promise_outro", label: "Promise outro (use {{clinicName}})", type: "textarea", rows: 2 },
    ],
  },
  {
    slug: "services",
    label: "Services",
    path: "/services",
    fields: [
      { key: "seo_title", label: "SEO title", type: "text" },
      { key: "seo_description", label: "SEO description", type: "textarea", rows: 3 },
      { key: "og_image_url", label: "OG / social image URL", type: "image" },
      { key: "hero_image_url", label: "Hero image URL", type: "image" },
      { key: "eyebrow", label: "Hero eyebrow", type: "text" },
      { key: "title", label: "Hero title", type: "text" },
      { key: "subtitle", label: "Hero subtitle (use {{clinicName}})", type: "textarea", rows: 3 },
      { key: "badge_1", label: "Hero badge 1", type: "text" },
      { key: "badge_2", label: "Hero badge 2", type: "text" },
      { key: "empty_eyebrow", label: "Empty catalogue eyebrow", type: "text" },
      { key: "empty_heading", label: "Empty catalogue heading", type: "text" },
      { key: "empty_body", label: "Empty catalogue body (use {{clinicName}})", type: "textarea", rows: 3 },
    ],
  },
  {
    slug: "community",
    label: "Community",
    path: "/community",
    fields: [
      { key: "seo_title", label: "SEO title", type: "text" },
      { key: "seo_description", label: "SEO description", type: "textarea", rows: 3 },
      { key: "og_image_url", label: "OG / social image URL", type: "image" },
      { key: "eyebrow", label: "Page eyebrow", type: "text" },
      { key: "title", label: "Page title", type: "text" },
      { key: "tagline", label: "Tagline", type: "text" },
      { key: "intro", label: "Intro (use {{clinicName}})", type: "textarea", rows: 4 },
      { key: "partnerships_heading", label: "Partnerships heading", type: "text" },
      { key: "partnerships_intro", label: "Partnerships intro", type: "textarea", rows: 2 },
      { key: "card_1_title", label: "Card 1 title", type: "text" },
      { key: "card_1_body", label: "Card 1 body", type: "textarea", rows: 3 },
      { key: "card_2_title", label: "Card 2 title", type: "text" },
      { key: "card_2_body", label: "Card 2 body", type: "textarea", rows: 3 },
      { key: "card_3_title", label: "Card 3 title", type: "text" },
      { key: "card_3_body", label: "Card 3 body", type: "textarea", rows: 3 },
      { key: "why_heading", label: "Why we do it heading", type: "text" },
      { key: "why_body", label: "Why we do it body (use {{clinicName}})", type: "textarea", rows: 3 },
      { key: "collaborate_heading", label: "Collaborate heading", type: "text" },
      { key: "collaborate_body", label: "Collaborate body", type: "textarea", rows: 3 },
    ],
  },
  {
    slug: "faq",
    label: "FAQ",
    path: "/faq",
    fields: [
      { key: "seo_title", label: "SEO title", type: "text" },
      { key: "seo_description", label: "SEO description", type: "textarea", rows: 3 },
      { key: "og_image_url", label: "OG / social image URL", type: "image" },
      { key: "eyebrow", label: "Page eyebrow", type: "text" },
      { key: "title", label: "Page title", type: "text" },
      { key: "intro", label: "Intro (use {{clinicName}})", type: "textarea", rows: 3 },
    ],
  },
  {
    slug: "team",
    label: "Team",
    path: "/team",
    fields: [
      { key: "seo_title", label: "SEO title", type: "text" },
      { key: "seo_description", label: "SEO description", type: "textarea", rows: 3 },
      { key: "og_image_url", label: "OG / social image URL", type: "image" },
      { key: "title", label: "Page title", type: "text" },
      { key: "intro", label: "Intro", type: "textarea", rows: 3 },
    ],
  },
  {
    slug: "doctors",
    label: "Doctors",
    path: "/doctors",
    fields: [
      { key: "seo_title", label: "SEO title", type: "text" },
      { key: "seo_description", label: "SEO description", type: "textarea", rows: 3 },
      { key: "og_image_url", label: "OG / social image URL", type: "image" },
      { key: "title", label: "Page title", type: "text" },
      { key: "intro", label: "Intro", type: "textarea", rows: 3 },
    ],
  },
  {
    slug: "contact",
    label: "Contact",
    path: "/contact",
    fields: [
      { key: "seo_title", label: "SEO title", type: "text" },
      { key: "seo_description", label: "SEO description", type: "textarea", rows: 3 },
      { key: "og_image_url", label: "OG / social image URL", type: "image" },
      { key: "title", label: "Page title (before highlight)", type: "text" },
      { key: "title_highlight", label: "Page title highlight word", type: "text" },
      { key: "intro", label: "Intro (use {{clinicName}})", type: "textarea", rows: 3 },
    ],
  },
  {
    slug: "locations",
    label: "Locations",
    path: "/locations",
    fields: [
      { key: "seo_title", label: "SEO title", type: "text" },
      { key: "seo_description", label: "SEO description", type: "textarea", rows: 3 },
      { key: "og_image_url", label: "OG / social image URL", type: "image" },
      { key: "eyebrow", label: "Hero eyebrow", type: "text" },
      { key: "title_line1", label: "Hero title line 1", type: "text" },
      { key: "title_highlight", label: "Hero title highlight word", type: "text" },
      { key: "intro", label: "Hero intro", type: "textarea", rows: 3 },
    ],
  },
];

export const DEFAULT_PAGE_CONTENT: Record<MarketingPageSlug, MarketingPageContent> = {
  home: {
    seo_title: "{{clinicName}} | Your pet, Our priority",
    seo_description:
      "Happy pets, happy humans. Expert veterinary care for Tricity — OPD, surgery, diagnostics, dentistry, grooming & boarding at {{clinicName}}.",
    sections: {
      facilities_heading: "Facilities",
      facilities_body: "Complete care under one roof — tailored to what your pet needs.",
      facilities_list: [
        "Specialized OPD",
        "Surgeries (major & minor)",
        "Diagnostics",
        "In-house path lab",
        "Dentistry",
        "Dermatology",
        "Pet boarding",
        "Grooming",
      ].join("\n"),
      why_heading: "Why rely on us?",
      why_1_title: "We love animals",
      why_1_body: "Your furry friend is family. They deserve the best care and attention — every single visit.",
      why_2_title: "Convenience",
      why_2_body: "Flexible appointment times plus online booking so scheduling fits your life.",
      why_3_title: "Personalized care",
      why_3_body: "Trained professionals tailor care to every pet that comes through our doors.",
      why_4_title: "Peace of mind",
      why_4_body: "We know leaving your pet can be stressful — we earn your trust with consistent, kind care.",
      why_5_title: "Transparency",
      why_5_body: "Clear communication so you feel confident we always have your pet’s best interests at heart.",
      why_6_title: "Teamwork",
      why_6_body: "Vets, technicians, and support staff work together for the best possible outcome.",
      faq_heading: "FAQ's",
      faq_body: "Quick questions — tap through for full answers on our FAQ page.",
      faq_preview_list: [
        "What are your clinic's operating hours?",
        "Do I need an appointment before visiting?",
        "What types of animals do you treat?",
        "Do you have a pet pharmacy?",
        "What is IDEXX and why do you use it?",
      ].join("\n"),
    },
  },
  about: {
    seo_title: "About us | {{clinicName}}",
    seo_description:
      "Who we are, why families choose {{clinicName}}, and our mission for compassionate veterinary care in Tricity.",
    sections: {
      eyebrow: "About",
      title: "About us",
      who_heading: "Who we are",
      who_p1:
        "The inspiration behind {{clinicName}} was born from a deep-seated passion for animals and a heartfelt commitment to providing quality care. From the very beginning, our journey has been one of growth, learning, and adaptation. While much has evolved since we opened our doors, one thing has always remained constant — our unwavering dedication to the well-being of our patients.",
      who_p2:
        "Over the years, we've not only focused on addressing the health needs of pets but also on creating an environment where they feel safe and cared for. We understand that a visit to the vet can be stressful, which is why we go the extra mile to make every pet feel right at home — from the moment they walk in, to the moment they leave.",
      why_heading: "Why choose {{clinicName}}",
      why_intro:
        "Choosing the right veterinary care for your beloved pet is a big decision — and we're here to make it an easy one. At {{clinicName}}, we go beyond treatment — we create trust, comfort, and lifelong wellness.",
      why_bullets: [
        "Unmatched expertise — skilled vets and support staff trained in the latest techniques, from checkups to complex surgeries.",
        "Advanced technology — IDEXX diagnostics for accurate, fast results.",
        "Compassion-first care — gentle hands and a kind heart for every pet.",
        "Comfort-focused environment — soothing interiors and pet-calming practices.",
        "Community-driven mission — partnering with NGOs and serving underprivileged areas through free and low-cost services.",
        "Comprehensive services — OPD, surgery, dentistry, grooming, diagnostics, boarding, and more under one roof.",
        "Always within reach — responsive, friendly support when you need us.",
      ].join("\n"),
      stats_intro: "Since our opening, we have performed an average of 3–4 surgeries daily, resulting in:",
      stats_list: ["Over 5,000 successful surgeries", "Nearly 5 years of continuous care and learning", "Hundreds of breeds, conditions, and unique cases"].join(
        "\n",
      ),
      stats_outro:
        "This isn't just a number — it's a reflection of the trust pet parents place in us, and the expertise our team has earned over time.",
      pride_line: "We're very proud to be a community-driven clinic, and we will always put our patients' well-being before profit.",
      impact_heading: "Our impact",
      impact_body: [
        "At {{clinicName}}, we're proud to be recognized as one of the fastest-growing veterinary clinic chains in Punjab. Since our founding in 2020, we've committed ourselves not just to medical excellence, but to making a meaningful difference in our community every single day.",
        "On average, we perform 3–4 community surgeries daily, many as part of low-cost wellness and sterilization initiatives. We actively collaborate with organizations like Rab De Jeev and Tabassum, extending care to underserved animals with integrity and sincerity.",
        "Beyond our clinics, we've driven change through campaigns like the Tricity Rabies-Free Mission, offering free rabies vaccinations as part of our mission for safer streets for both pets and people.",
        "Every step we take is rooted in our core belief: quality veterinary care should be accessible, empathetic, and community-driven.",
      ].join("\n\n"),
      mission_heading: "Mission & promise",
      mission_body: [
        "At {{clinicName}}, our mission is to deliver exceptional veterinary care with compassion, innovation, and integrity. We strive to enhance the lives of animals and their families by combining modern medical practices with heartfelt service, ensuring every pet receives the respect, attention, and advanced treatment they deserve.",
        "We aim to build a healthier community through accessible, ethical, and community-driven care, while nurturing a bond of trust with every pet parent who walks through our doors.",
      ].join("\n\n"),
      promise_intro: "We promise to:",
      promise_list: [
        "Treat your pet like our own — with unwavering care and respect.",
        "Provide transparent, honest communication throughout your pet's healthcare journey.",
        "Offer cutting-edge diagnostics and treatments, backed by trusted technology like IDEXX Laboratories.",
        "Maintain a stress-free and supportive environment for both pets and pet parents.",
        "Stay committed to community service, ensuring quality care is available to all — not just a few.",
      ].join("\n"),
      promise_outro: "At {{clinicName}}, your trust is our greatest responsibility — and we promise to earn it every day.",
    },
  },
  services: {
    seo_title: "{{clinicName}} Services",
    seo_description: "Explore veterinary services at {{clinicName}}.",
    sections: {
      hero_image_url:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAHUiXkY-fn0in9W3DlhWSv8ENOuzy4zY3KnYqrx1JMX6L3C1iYNuSlKS80AUAkN47y4Mz9swZ-u00KGs5fFSfZiHRh1Me7Km0FSOBVwDRfyP9G3D10TVE8NbwkfUM7_OMMUmY1aiZ1NoyznRC9IcxwnbCUC361vju4_QlaFcfK6Py9nneWD8NSQHwWvsgakq3ZK8tpOcEkQ6h8IAmSfTxydDDgnxFQEi2i4GwztU9USTquiWkltMFDEDqez14KGs3F5qM6Tc_0sVM",
      eyebrow: "Medical excellence",
      title: "Expert care for every life stage",
      subtitle: "Advanced medicine with a calm experience — services available at {{clinicName}}.",
      badge_1: "Evidence-based protocols",
      badge_2: "Coordinated urgent access",
      empty_eyebrow: "Facilities",
      empty_heading: "Complete care under one roof — tailored to what your pet needs.",
      empty_body: "While your clinic catalogue is being set up, here is what families can expect at {{clinicName}}.",
    },
  },
  community: {
    seo_title: "Community work | {{clinicName}}",
    seo_description: "Outreach, NGO partnerships, and community veterinary initiatives by {{clinicName}}.",
    sections: {
      eyebrow: "Community",
      title: "Community work",
      tagline: "Healing pets. Helping communities.",
      intro:
        "At {{clinicName}}, our mission goes beyond the walls of our clinics. We believe true veterinary care is rooted in compassion, accessibility, and community upliftment. Our community initiatives are driven by a deep commitment to making quality care available to every pet, regardless of background or circumstance.",
      partnerships_heading: "Local partnerships & outreach",
      partnerships_intro: "We've actively collaborated with local communities and NGOs to extend our services where they're needed most:",
      card_1_title: "Omaxe City outreach",
      card_1_body: "Regular pet health camps and checkups are conducted in and around Omaxe City, helping more pets access essential care.",
      card_2_title: "In association with Rab De Jeev NGO",
      card_2_body:
        "We partner with Rab De Jeev to provide free consultations, diagnostics, and treatments for rescued or community animals — giving hundreds of voiceless beings a second chance.",
      card_3_title: "Tabassum welfare initiative",
      card_3_body:
        "Through Tabassum, we participate in community consultation drives, delivering medical aid and awareness in underserved neighborhoods.",
      why_heading: "Why we do it",
      why_body:
        "At {{clinicName}}, we see pets not as property — but as family. Our community work stems from a belief that every pet deserves a chance at a happy, healthy life, and every community deserves access to quality veterinary care.",
      collaborate_heading: "Want to support or collaborate?",
      collaborate_body:
        "We are always open to partnerships with animal welfare organizations, societies, and volunteers. Reach out to discuss camps, outreach, or collaboration.",
    },
  },
  faq: {
    seo_title: "FAQ | {{clinicName}}",
    seo_description: "Common questions about appointments, services, diagnostics, and emergency care at {{clinicName}}.",
    sections: {
      eyebrow: "FAQ",
      title: "Questions & answers",
      intro: "Straight answers about care at {{clinicName}}. Tap a question to expand.",
    },
  },
  team: {
    seo_title: "{{clinicName}} Team",
    seo_description: "Meet the veterinary team at {{clinicName}}.",
    sections: {
      title: "Our team",
      intro: "Medicine meets empathy here — a team united by one simple belief: every animal deserves to be seen, heard, and loved like family.",
    },
  },
  doctors: {
    seo_title: "{{clinicName}} Doctors",
    seo_description: "Meet the veterinary doctors at {{clinicName}}.",
    sections: {
      title: "Doctors",
      intro: "Profiles are managed by each clinician in the mobile app.",
    },
  },
  contact: {
    seo_title: "Contact {{clinicName}}",
    seo_description: "Contact {{clinicName}} for appointments, emergency care, and support.",
    sections: {
      title: "Connect with",
      title_highlight: "care",
      intro: "Routine questions or urgent concerns — reach {{clinicName}} using the form or branch details below.",
    },
  },
  locations: {
    seo_title: "Locations | {{clinicName}}",
    seo_description: "Clinics across Tricity, Punjab & beyond — addresses, phone numbers, and hours.",
    sections: {
      eyebrow: "Our presence",
      title_line1: "Clinical sanctuary",
      title_highlight: "doorstep",
      intro: "Visit {{clinicName}} across the region — call ahead or book online. Directions open in Google Maps.",
    },
  },
};

export function isMarketingPageSlug(value: string): value is MarketingPageSlug {
  return (MARKETING_PAGE_SLUGS as readonly string[]).includes(value);
}

export function getMarketingPageDef(slug: MarketingPageSlug): MarketingPageDef {
  const def = MARKETING_PAGE_DEFS.find((d) => d.slug === slug);
  if (!def) throw new Error(`Unknown marketing page: ${slug}`);
  return def;
}

export function applyClinicPlaceholders(value: string, clinicName: string): string {
  return value.replaceAll("{{clinicName}}", clinicName);
}

export function mergePageContent(
  slug: MarketingPageSlug,
  db: MarketingPageContent | null | undefined,
): Required<Pick<MarketingPageContent, "seo_title" | "seo_description" | "og_image_url">> & {
  sections: Record<string, string>;
} {
  const defaults = DEFAULT_PAGE_CONTENT[slug];
  const defaultSections = defaults.sections ?? {};
  const dbSections = db?.sections && typeof db.sections === "object" ? db.sections : {};
  const sections: Record<string, string> = { ...defaultSections };
  for (const [key, value] of Object.entries(dbSections)) {
    if (typeof value === "string" && value.trim()) sections[key] = value;
  }
  return {
    seo_title: db?.seo_title?.trim() || defaults.seo_title || "",
    seo_description: db?.seo_description?.trim() || defaults.seo_description || "",
    og_image_url: db?.og_image_url?.trim() || defaults.og_image_url || "",
    sections,
  };
}

export function sectionLines(sections: Record<string, string>, key: string): string[] {
  return (sections[key] ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function sectionParagraphs(sections: Record<string, string>, key: string): string[] {
  return (sections[key] ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
