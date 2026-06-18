import Link from "next/link";
import type { MarketingTeamMember } from "@/lib/marketing/get-team-members";

export function HomeTeamSection({ members }: { members: MarketingTeamMember[] }) {
  if (!members.length) return null;

  return (
    <section className="bg-surface-container-low py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">Our team</p>
            <h2 className="font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">People who care for your pets</h2>
            <p className="max-w-2xl text-on-surface-variant">
              Compassionate veterinarians and support staff dedicated to happy, healthy animals.
            </p>
          </div>
          <Link
            href="/team"
            className="inline-flex w-fit items-center gap-1 rounded-full border border-primary/30 bg-surface px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10"
          >
            Meet everyone
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </Link>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {members.map((member) => (
            <article
              key={member.id}
              className="flex w-[9.5rem] shrink-0 flex-col items-center text-center sm:w-auto"
            >
              <div className="relative h-28 w-28 overflow-hidden rounded-full bg-surface-container-high ring-4 ring-white shadow-lg shadow-primary/10 sm:h-32 sm:w-32">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={member.image_url}
                  alt={member.full_name}
                  width={128}
                  height={128}
                  className="h-full w-full object-cover"
                />
              </div>
              <h3 className="mt-4 font-headline text-base font-bold text-on-surface">{member.full_name}</h3>
              {member.role_title?.trim() ? (
                <p className="mt-1 text-sm text-on-surface-variant">{member.role_title}</p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
