import Link from "next/link";

/** Static FAB — no infinite pulse rings (those kept the main thread busy on every page). */
export function SeniorVetFab() {
  return (
    <div className="fixed bottom-6 left-4 z-50 md:bottom-8 md:left-8">
      <span aria-hidden className="senior-vet-fab-pulse pointer-events-none absolute inset-0 rounded-full bg-tertiary/40" />
      <Link
        href="/book/senior-vet"
        className="senior-vet-fab-button group relative flex h-14 w-14 items-center justify-center rounded-full text-on-primary shadow-2xl shadow-tertiary/40 ring-2 ring-white/30 transition-transform hover:scale-[1.04] active:scale-95"
        aria-label="Senior Vet online consultation"
      >
        <span className="material-symbols-outlined text-[26px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
          medical_services
        </span>
        <span className="pointer-events-none absolute left-full top-1/2 z-[70] ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-on-background px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 sm:block">
          Senior Vet online
        </span>
      </Link>
    </div>
  );
}
