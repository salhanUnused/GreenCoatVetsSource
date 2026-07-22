import Link from "next/link";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getMarketingTeamMembers } from "@/lib/marketing/get-team-members";
import { clinicMetadata } from "@/lib/seo/clinic-metadata";

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return clinicMetadata({
    clinicName: clinic.name,
    title: `${clinic.name} Team`,
    description: `Meet the veterinary team at ${clinic.name}.`,
    path: "/team",
  });
}

export default async function TeamPage() {
  const members = await getMarketingTeamMembers();

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 bg-surface px-6 py-12">
      <div>
        <h1 className="font-headline text-4xl font-extrabold text-on-surface">Our team</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-on-surface-variant">
          Medicine meets empathy here — a team united by one simple belief: every animal deserves to be seen, heard, and
          loved like family.
        </p>
      </div>

      {members.length ? (
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {members.map((member) => (
            <article key={member.id} className="flex flex-col items-center text-center">
              <div className="h-32 w-32 overflow-hidden rounded-full bg-surface-container-high ring-4 ring-white shadow-lg shadow-primary/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={member.image_url} alt={member.full_name} className="h-full w-full object-cover" />
              </div>
              <h2 className="mt-4 font-headline text-lg font-bold text-on-surface">{member.full_name}</h2>
              {member.role_title ? <p className="mt-1 text-sm text-on-surface-variant">{member.role_title}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-8 text-center">
          <p className="text-on-surface-variant">Team profiles will appear here once they are added in the website admin.</p>
          <Link href="/" className="mt-4 inline-block text-sm font-bold text-primary underline">
            Back to home
          </Link>
        </div>
      )}
    </main>
  );
}
