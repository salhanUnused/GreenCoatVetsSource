import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

export type MarketingReviewPublic = {
  quote: string;
  label: string;
  img: string;
  stars: number;
};

export const getActiveMarketingReviews = cache(async (limit = 8): Promise<MarketingReviewPublic[]> => {
  try {
    const supabase = createPublicClient();
    const { data: reviews } = await supabase
      .from("marketing_reviews")
      .select("id, reviewer_name, pet_name, message, stars, owner_image_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(limit);

    return (
      reviews?.map((row) => ({
        quote: row.message as string,
        label: `${row.pet_name} - ${row.reviewer_name}`,
        img: (row.owner_image_url as string | null) ?? "",
        stars: Number(row.stars ?? 5),
      })) ?? []
    );
  } catch {
    return [];
  }
});
