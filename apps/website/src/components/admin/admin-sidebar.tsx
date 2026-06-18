"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SUPER_GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard" }],
  },
  {
    title: "Website",
    items: [
      { href: "/admin/settings", label: "Site & clinic" },
      { href: "/admin/locations", label: "Locations" },
      { href: "/admin/footer", label: "Footer" },
      { href: "/admin/traffic", label: "Traffic" },
      { href: "/admin/seo", label: "SEO & sitemap" },
    ],
  },
  {
    title: "Content",
    items: [
      { href: "/admin/blog", label: "Blog" },
      { href: "/admin/ai-prompts", label: "Post prompts" },
      { href: "/admin/faqs", label: "FAQs" },
      { href: "/admin/reviews", label: "Reviews" },
      { href: "/admin/team", label: "Our team" },
      { href: "/admin/popups", label: "Popups" },
    ],
  },
];

function linkClass(active: boolean) {
  return active
    ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20"
    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
}

export function AdminSidebar({ isSuper }: { isSuper: boolean }) {
  const pathname = usePathname() || "";

  if (!isSuper) {
    return (
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="flex h-14 items-center border-b border-slate-100 px-4">
          <span className="font-headline text-sm font-bold text-slate-800">Marketing</span>
        </div>
        <nav className="p-3">
          <Link
            href="/admin/settings"
            className={`block rounded-lg px-3 py-2.5 text-sm ${linkClass(pathname === "/admin/settings")}`}
          >
            Site settings
          </Link>
          <Link
            href="/admin/blog"
            className={`block rounded-lg px-3 py-2.5 text-sm ${linkClass(pathname === "/admin/blog" || pathname.startsWith("/admin/blog/"))}`}
          >
            Blog
          </Link>
          <Link
            href="/admin/ai-prompts"
            className={`block rounded-lg px-3 py-2.5 text-sm ${linkClass(pathname === "/admin/ai-prompts" || pathname.startsWith("/admin/ai-prompts/"))}`}
          >
            Post prompts
          </Link>
          <Link
            href="/admin/team"
            className={`block rounded-lg px-3 py-2.5 text-sm ${linkClass(pathname === "/admin/team" || pathname.startsWith("/admin/team/"))}`}
          >
            Our team
          </Link>
          <Link
            href="/admin/reviews"
            className={`block rounded-lg px-3 py-2.5 text-sm ${linkClass(pathname === "/admin/reviews" || pathname.startsWith("/admin/reviews/"))}`}
          >
            Reviews
          </Link>
        </nav>
      </aside>
    );
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-slate-50 md:flex">
      <div className="flex h-14 items-center border-b border-slate-200/80 bg-white px-4">
        <Link href="/admin" className="font-headline text-sm font-bold tracking-tight text-slate-900">
          Marketing admin
        </Link>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        {SUPER_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={`block rounded-lg px-3 py-2 text-sm transition-colors ${linkClass(active)}`}>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function AdminMobileNav({ isSuper }: { isSuper: boolean }) {
  const pathname = usePathname() || "";

  if (!isSuper) {
    return (
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
        <Link
          href="/admin/settings"
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${linkClass(pathname.startsWith("/admin/settings"))}`}
        >
          Settings
        </Link>
        <Link
          href="/admin/blog"
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${linkClass(pathname.startsWith("/admin/blog"))}`}
        >
          Blog
        </Link>
        <Link
          href="/admin/ai-prompts"
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${linkClass(pathname.startsWith("/admin/ai-prompts"))}`}
        >
          Post prompts
        </Link>
        <Link
          href="/admin/team"
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${linkClass(pathname.startsWith("/admin/team"))}`}
        >
          Team
        </Link>
        <Link
          href="/admin/reviews"
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${linkClass(pathname.startsWith("/admin/reviews"))}`}
        >
          Reviews
        </Link>
      </div>
    );
  }

  const flat = SUPER_GROUPS.flatMap((g) => g.items);
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 py-2 md:hidden">
      {flat.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${linkClass(!!active)}`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
