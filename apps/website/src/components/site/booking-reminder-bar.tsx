"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "saasclinics_booking_reminder_dismissed_session";

export function BookingReminderBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") setHidden(true);
    } catch {
      /* ignore */
    }
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3 sm:p-4">
      <div className="pointer-events-auto flex max-w-2xl flex-col gap-3 rounded-2xl border border-primary/25 bg-surface-container-lowest/98 px-4 py-3 shadow-2xl shadow-primary/15 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined mt-0.5 shrink-0 text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            event_available
          </span>
          <div>
            <p className="font-headline text-sm font-bold text-on-surface sm:text-base">Book an appointment</p>
            <p className="text-xs text-on-surface-variant sm:text-sm">Schedule a visit online when it suits you — it only takes a minute.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/book"
            className="gradient-primary inline-flex flex-1 justify-center rounded-xl px-5 py-2.5 text-center font-headline text-sm font-bold text-on-primary sm:flex-none"
          >
            Book now
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low"
            aria-label="Dismiss reminder"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
