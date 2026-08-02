import Link from "next/link";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getPublicStaffForClinic } from "@/lib/clinic/public-staff";
import { getMergedPageContent } from "@/lib/marketing/get-marketing-site";
import { applyClinicPlaceholders } from "@/lib/marketing/page-content";
import { marketingPageMetadata } from "@/lib/marketing/page-metadata";

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return marketingPageMetadata({ slug: "doctors", clinicName: clinic.name, path: "/doctors" });
}

export default async function DoctorsPage() {
  const clinic = await resolveClinic();
  const [staff, page] = await Promise.all([getPublicStaffForClinic(clinic.id), getMergedPageContent("doctors")]);
  const doctors = staff.filter((s) => s.role === "doctor");
  const s = page.sections;
  const t = (value: string | undefined) => applyClinicPlaceholders(value ?? "", clinic.name);
  const physicianLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${clinic.name} Doctors`,
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 bg-surface px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(physicianLd) }} />
      <h1 className="font-headline text-4xl font-extrabold text-on-surface">{t(s.title)}</h1>
      <p className="text-on-surface-variant">
        {t(s.intro)}{" "}
        <Link className="font-semibold text-primary underline" href="/team">
          See full clinical team
        </Link>
        .
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {doctors.map((doctor) => (
          <article className="clinical-shadow rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6" key={doctor.id}>
            <div className="flex gap-4">
              {doctor.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={doctor.photo_url}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">
                  Photo
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-medium">{doctor.full_name}</h2>
                <p className="text-sm text-muted-foreground">{doctor.specialization ?? "General practice"}</p>
                <p className="text-sm text-muted-foreground">
                  Experience: {doctor.experience_years ?? 0} years | Branch: {doctor.branch_name ?? "—"}
                </p>
                <p className="mt-2 text-sm">{doctor.bio ?? "Bio not added yet."}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!doctors.length ? <p className="text-on-surface-variant">No doctors listed yet.</p> : null}
    </main>
  );
}
