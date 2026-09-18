import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

export type FooterNavLink = {
  id: string;
  label: string;
  href: string;
  openInNewTab: boolean;
};

export type FooterNavGroup = {
  id: string;
  slug: string;
  title: string;
  links: FooterNavLink[];
};

/** Fallback when DB has no rows (migration not applied yet). Matches legacy hardcoded footer. */
export const DEFAULT_FOOTER_NAV: FooterNavGroup[] = [
  {
    id: "fallback-quick",
    slug: "quick",
    title: "Quick links",
    links: [
      { id: "", label: "About", href: "/about", openInNewTab: false },
      { id: "", label: "Services", href: "/services", openInNewTab: false },
      { id: "", label: "Locations", href: "/locations", openInNewTab: false },
      { id: "", label: "Blog", href: "/blog", openInNewTab: false },
      { id: "", label: "Our team", href: "/doctors", openInNewTab: false },
      { id: "", label: "Community", href: "/community", openInNewTab: false },
      { id: "", label: "FAQ", href: "/faq", openInNewTab: false },
      { id: "", label: "Book appointment", href: "/book", openInNewTab: false },
      { id: "", label: "Contact", href: "/contact", openInNewTab: false },
    ],
  },
  {
    id: "fallback-account",
    slug: "account",
    title: "Account & staff",
    links: [
      { id: "", label: "Pet owner portal", href: "/account", openInNewTab: false },
      { id: "", label: "Pet owner login", href: "/login", openInNewTab: false },
      { id: "", label: "Create account", href: "/signup", openInNewTab: false },
      { id: "", label: "Online store", href: "/store", openInNewTab: false },
      { id: "", label: "Cart", href: "/cart", openInNewTab: false },
      { id: "", label: "Staff / admin login", href: "/admin/login", openInNewTab: false },
    ],
  },
];

/**
 * Active footer columns for the public marketing site (active links only).
 * Omits groups that have no active links.
 */
export const getMarketingFooterNav = cache(async (): Promise<FooterNavGroup[]> => {
  const supabase = createPublicClient();

  const { data: groups, error: gErr } = await supabase
    .from("marketing_footer_groups")
    .select("id, slug, title, sort_order")
    .order("sort_order", { ascending: true });

  /** Table missing / not migrated — keep legacy footer. */
  if (gErr) {
    return DEFAULT_FOOTER_NAV;
  }

  if (!groups?.length) {
    return [];
  }

  const { data: links, error: lErr } = await supabase
    .from("marketing_footer_links")
    .select("id, group_id, label, href, sort_order, open_in_new_tab")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (lErr) {
    return [];
  }

  const linkRows = links ?? [];
  if (linkRows.length === 0) {
    return [];
  }

  const byGroup = new Map<string, FooterNavLink[]>();
  for (const row of linkRows) {
    const gid = row.group_id as string;
    const list = byGroup.get(gid) ?? [];
    list.push({
      id: row.id as string,
      label: row.label as string,
      href: row.href as string,
      openInNewTab: Boolean(row.open_in_new_tab),
    });
    byGroup.set(gid, list);
  }

  const out: FooterNavGroup[] = [];
  for (const g of groups) {
    const gid = g.id as string;
    const groupLinks = byGroup.get(gid);
    if (!groupLinks?.length) continue;
    out.push({
      id: gid,
      slug: g.slug as string,
      title: g.title as string,
      links: groupLinks,
    });
  }

  return out;
});
