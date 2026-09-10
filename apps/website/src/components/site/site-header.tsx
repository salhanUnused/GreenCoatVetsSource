"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/locations", label: "Locations" },
  { href: "/blog", label: "Blog" },
  { href: "/community", label: "Community" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader({
  productName,
  logoUrl,
  callDisplay,
  callTelHref,
  websiteStoreEnabled,
}: {
  productName: string;
  logoUrl: string | null;
  /** Label next to Call now (e.g. +91 98765 43210). */
  callDisplay?: string;
  callTelHref?: string;
  websiteStoreEnabled: boolean;
}) {
  const showCall = Boolean(callTelHref?.trim() && callDisplay?.trim());
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/15 bg-surface/90 backdrop-blur-sm dark:border-slate-700/20">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2" onClick={() => setOpen(false)}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg object-contain sm:h-11 sm:w-11" />
          ) : null}
          <span className="font-headline text-xl font-extrabold tracking-tight text-transparent sm:text-2xl bg-gradient-to-br from-teal-500 to-teal-800 bg-clip-text">
            {productName}
          </span>
        </Link>

        <div className="hidden items-center gap-3 lg:gap-5 xl:gap-6 md:flex">
          {NAV.map(({ href, label }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`font-headline text-xs font-semibold tracking-tight transition-colors lg:text-sm ${
                  active
                    ? "border-b-2 border-primary pb-1 text-primary"
                    : "text-slate-600 hover:text-primary dark:text-slate-400 dark:hover:text-teal-400"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/book"
            className="gradient-primary hidden rounded-xl px-4 py-2 font-headline text-xs font-bold text-on-primary shadow-lg shadow-primary/20 transition-transform hover:scale-[0.98] sm:inline-block sm:px-6 sm:py-2.5 sm:text-sm"
          >
            Book Appointment
          </Link>
          {user ? (
            <Link
              href="/account"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/80 bg-surface-container-low/80 text-on-surface shadow-sm transition-colors hover:border-primary hover:bg-surface-container-low hover:text-primary"
              aria-label="Pet owner portal"
            >
              <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                account_circle
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-xl border-2 border-primary bg-white px-3 py-2 font-headline text-xs font-bold text-primary shadow-sm transition-colors hover:bg-primary hover:text-on-primary sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Login
            </Link>
          )}
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-on-surface md:hidden"
            aria-expanded={open}
            aria-label="Toggle menu"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="material-symbols-outlined">{open ? "close" : "menu"}</span>
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 shadow-lg md:hidden dark:border-slate-200 dark:bg-white">
          <div className="flex flex-col gap-3">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="font-headline font-semibold text-on-surface"
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
            {showCall ? (
              <a
                href={callTelHref}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary py-3 font-headline font-bold text-primary"
                onClick={() => setOpen(false)}
              >
                <span className="material-symbols-outlined">call</span>
                Call now · {callDisplay}
              </a>
            ) : null}
            <Link
              href="/book"
              className="gradient-primary mt-2 rounded-xl py-3 text-center font-headline font-bold text-on-primary"
              onClick={() => setOpen(false)}
            >
              Book appointment
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-surface-container pt-4 text-sm">
              {user ? (
                <Link
                  href="/account"
                  className="inline-flex items-center gap-2 font-semibold text-primary"
                  onClick={() => setOpen(false)}
                >
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    account_circle
                  </span>
                  Pet portal
                </Link>
              ) : (
                <>
                  <Link href="/login" className="font-semibold text-primary" onClick={() => setOpen(false)}>
                    Login
                  </Link>
                  <Link href="/signup" className="text-on-surface-variant" onClick={() => setOpen(false)}>
                    Sign up
                  </Link>
                </>
              )}
              {websiteStoreEnabled ? (
                <Link href="/store" className="text-on-surface-variant" onClick={() => setOpen(false)}>
                  Store
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
