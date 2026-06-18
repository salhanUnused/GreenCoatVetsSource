import { createClient } from "@/lib/supabase/server";

export type MarketingTeamMember = {
  id: string;
  full_name: string;
  role_title: string | null;
  image_url: string;
};

export async function getMarketingTeamMembers(): Promise<MarketingTeamMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketing_team_members")
    .select("id, full_name, role_title, image_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) return [];
  return (data ?? []) as MarketingTeamMember[];
}
