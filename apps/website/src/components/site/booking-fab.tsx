import Link from "next/link";

export function BookingFab() {
  return (
    <Link
      href="/book"
      className="group fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-on-primary shadow-2xl shadow-primary/30 ring-2 ring-white/25 transition-all hover:scale-[1.03] active:scale-95 md:bottom-8 md:right-8 gradient-primary"
      aria-label="Book appointment"
    >
      <span className="material-symbols-outlined text-[26px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
        calendar_month
      </span>
      <span className="pointer-events-none absolute bottom-full right-0 z-[70] mb-2 whitespace-nowrap rounded-lg bg-on-background px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 md:right-0 md:mb-3">
        Book appointment
      </span>
    </Link>
  );
}
