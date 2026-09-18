import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

export type MarketingPopupTemplate = "offer" | "community" | "reminder" | "announcement" | "generic";

export type MarketingPopupRow = {
  id: string;
  sort_order: number;
  template_type: MarketingPopupTemplate;
  title: string;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
};

export const getActiveMarketingPopups = cache(async (): Promise<MarketingPopupRow[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("marketing_site_popups")
    .select("id, sort_order, template_type, title, body, image_url, cta_label, cta_href")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data?.length) return [];

  return data.map((r) => ({
    id: r.id as string,
    sort_order: Number(r.sort_order ?? 0),
    template_type: (r.template_type as MarketingPopupTemplate) ?? "generic",
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    image_url: (r.image_url as string | null) ?? null,
    cta_label: (r.cta_label as string | null) ?? null,
    cta_href: (r.cta_href as string | null) ?? null,
  }));
});
