"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMarketingManager, requireSuperAdmin as assertSuperAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { HomepageCopy, SocialLinks } from "@/lib/marketing/defaults";
import { DEFAULT_HOMEPAGE_IMAGES, type HomepageImageKey } from "@/lib/marketing/defaults";
import { parseInstagramEmbedUrlsBlock } from "@/lib/marketing/instagram-embed-url";
import { parseGalleryImageUrlsBlock } from "@/lib/marketing/gallery-welcome-video";
import { fetchInstagramMediaPermalinks, getInstagramGraphEnv } from "@/lib/marketing/instagram-graph-media";
import { validateSquarePngUpload } from "@saasclinics/lib";

async function requireSuperAdmin() {
  await assertSuperAdmin();
  return createClient();
}

async function requireMarketingManagerClient() {
  await requireMarketingManager();
  return createClient();
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function updateMarketingSettings(formData: FormData) {
  const supabase = await requireMarketingManagerClient();

  const { data: existingRow } = await supabase
    .from("marketing_site_settings")
    .select("homepage_images, social_links, homepage_copy")
    .eq("id", "default")
    .maybeSingle();

  const prevImages = (existingRow?.homepage_images as Record<string, string> | null) ?? {};
  const prevSocial = (existingRow?.social_links as SocialLinks | null) ?? {};
  const prevCopy = (existingRow?.homepage_copy as HomepageCopy | null) ?? {};

  const defaultClinicRaw = formData.get("default_clinic_id") as string | null;
  const default_clinic_id = defaultClinicRaw && defaultClinicRaw !== "" ? defaultClinicRaw : null;

  const brandedRaw = formData.get("website_branded_for_clinic_id") as string | null;
  const website_branded_for_clinic_id = brandedRaw && brandedRaw !== "" ? brandedRaw : null;

  const contactRaw = (formData.get("contact_form_recipient_email") as string | null)?.trim() ?? "";
  const contact_form_recipient_email = contactRaw || null;

  /** Merge every image slot from the form; empty clears the override (site uses code default). */
  const homepage_images: Record<string, string> = { ...prevImages };
  for (const key of Object.keys(DEFAULT_HOMEPAGE_IMAGES) as HomepageImageKey[]) {
    const v = (formData.get(`img_${key}`) as string | null)?.trim() ?? "";
    if (v) homepage_images[key] = v;
    else delete homepage_images[key];
  }

  for (const opt of ["hero_slide_2", "hero_slide_3"] as const) {
    const v = (formData.get(`img_${opt}`) as string | null)?.trim() ?? "";
    if (v) homepage_images[opt] = v;
    else delete homepage_images[opt];
  }

  const homepage_copy: HomepageCopy = { ...prevCopy };
  const copyFields = [
    ["copy_hero_line1", "hero_line1"],
    ["copy_hero_gradient", "hero_gradient"],
    ["copy_hero_tagline", "hero_tagline"],
    ["copy_navbar_call_display", "navbar_call_display"],
    ["copy_navbar_call_tel_href", "navbar_call_tel_href"],
  ] as const;
  for (const [fieldName, jsonKey] of copyFields) {
    const v = (formData.get(fieldName) as string | null)?.trim() ?? "";
    if (v) (homepage_copy as Record<string, string>)[jsonKey] = v;
    else delete (homepage_copy as Record<string, string>)[jsonKey];
  }

  const social_links: SocialLinks = { ...prevSocial };
  const socialFields = [
    ["social_instagram_url", "instagram_url"],
    ["social_facebook_url", "facebook_url"],
    ["social_youtube_url", "youtube_url"],
    ["social_linkedin_url", "linkedin_url"],
    ["social_website_url", "website_url"],
  ] as const;
  for (const [fieldName, jsonKey] of socialFields) {
    const v = (formData.get(fieldName) as string | null)?.trim() ?? "";
    if (v) social_links[jsonKey] = v;
    else delete social_links[jsonKey];
  }

  const instagram_embed_urls = parseInstagramEmbedUrlsBlock(
    String(formData.get("instagram_embed_urls") ?? ""),
  );

  const gallery_image_urls = parseGalleryImageUrlsBlock(String(formData.get("gallery_image_urls") ?? ""));

  const welcomeVideoRaw = String(formData.get("welcome_video_url") ?? "").trim();
  const welcome_video_url = welcomeVideoRaw && /^https?:\/\//i.test(welcomeVideoRaw) ? welcomeVideoRaw : null;

  const { error } = await supabase.from("marketing_site_settings").upsert(
    {
      id: "default",
      default_clinic_id,
      website_branded_for_clinic_id,
      contact_form_recipient_email,
      homepage_images,
      social_links,
      homepage_copy,
      instagram_embed_urls,
      gallery_image_urls,
      welcome_video_url,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/locations");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}

/**
 * Pulls latest post/reel permalinks from Instagram Graph API into `instagram_embed_urls`.
 * Requires server env INSTAGRAM_USER_ID (Instagram Business Account id) and INSTAGRAM_ACCESS_TOKEN.
 */
export async function refreshInstagramEmbedsFromGraph() {
  const supabase = await requireSuperAdmin();

  const env = getInstagramGraphEnv();
  if (!env) {
    redirect(
      `/admin/settings?error=${encodeURIComponent(
        "Set INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN on the server (see .env.example). The account must be a Professional Instagram linked to a Facebook Page.",
      )}`,
    );
  }

  const result = await fetchInstagramMediaPermalinks({
    userId: env.userId,
    accessToken: env.accessToken,
  });

  if (!result.ok) {
    redirect(`/admin/settings?error=${encodeURIComponent(result.message)}`);
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("marketing_site_settings")
    .update({
      instagram_embed_urls: result.permalinks,
      instagram_embed_synced_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", "default");

  if (error) {
    redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?ig_sync=1");
}

export async function addMarketingLocation(formData: FormData) {
  const supabase = await requireSuperAdmin();

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Name is required");

  const addressText = (formData.get("address_lines") as string)?.trim() ?? "";
  const address_lines = addressText.split("\n").map((s) => s.trim()).filter(Boolean);

  const sort_order = Number(formData.get("sort_order") || 0);

  const latRaw = (formData.get("latitude") as string)?.trim() ?? "";
  const lngRaw = (formData.get("longitude") as string)?.trim() ?? "";
  const latitude = latRaw ? Number(latRaw) : null;
  const longitude = lngRaw ? Number(lngRaw) : null;

  const { error } = await supabase.from("marketing_locations").insert({
    name,
    address_lines,
    phone_display: (formData.get("phone_display") as string)?.trim() || null,
    tel_href: (formData.get("tel_href") as string)?.trim() || null,
    hours_label: (formData.get("hours_label") as string)?.trim() || "",
    directions_url: (formData.get("directions_url") as string)?.trim() || null,
    latitude: Number.isFinite(latitude as number) ? latitude : null,
    longitude: Number.isFinite(longitude as number) ? longitude : null,
    sort_order: Number.isFinite(sort_order) ? sort_order : 0,
    is_active: formData.get("is_active") === "on",
  });

  if (error) {
    redirect(`/admin/locations?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/admin/locations");
  revalidatePath("/locations");
  redirect("/admin/locations?saved=1");
}

export async function updateMarketingLocation(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing id");

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Name is required");

  const addressText = (formData.get("address_lines") as string)?.trim() ?? "";
  const address_lines = addressText.split("\n").map((s) => s.trim()).filter(Boolean);

  const sort_order = Number(formData.get("sort_order") || 0);

  const latRaw = (formData.get("latitude") as string)?.trim() ?? "";
  const lngRaw = (formData.get("longitude") as string)?.trim() ?? "";
  const latitude = latRaw ? Number(latRaw) : null;
  const longitude = lngRaw ? Number(lngRaw) : null;

  const { error } = await supabase
    .from("marketing_locations")
    .update({
      name,
      address_lines,
      phone_display: (formData.get("phone_display") as string)?.trim() || null,
      tel_href: (formData.get("tel_href") as string)?.trim() || null,
      hours_label: (formData.get("hours_label") as string)?.trim() || "",
      directions_url: (formData.get("directions_url") as string)?.trim() || null,
      latitude: Number.isFinite(latitude as number) ? latitude : null,
      longitude: Number.isFinite(longitude as number) ? longitude : null,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);

  if (error) {
    redirect(`/admin/locations?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/admin/locations");
  revalidatePath("/locations");
  redirect("/admin/locations?saved=1");
}

export async function deleteMarketingLocation(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing id");

  const { error } = await supabase.from("marketing_locations").delete().eq("id", id);
  if (error) {
    redirect(`/admin/locations?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/admin/locations");
  revalidatePath("/locations");
  redirect("/admin/locations?deleted=1");
}

export async function addMarketingFaq(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const question = (formData.get("question") as string | null)?.trim() ?? "";
  const answer = (formData.get("answer") as string | null)?.trim() ?? "";
  const sort_order = Number(formData.get("sort_order") || 0);
  if (!question || !answer) {
    redirect("/admin/faqs?error=Question%20and%20answer%20are%20required.");
  }
  const { error } = await supabase.from("marketing_faqs").insert({
    question,
    answer,
    sort_order: Number.isFinite(sort_order) ? sort_order : 0,
    is_active: formData.get("is_active") === "on",
  });
  if (error) {
    redirect(`/admin/faqs?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/faq");
  revalidatePath("/admin/faqs");
  redirect("/admin/faqs?saved=1");
}

export async function updateMarketingFaq(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const question = (formData.get("question") as string | null)?.trim() ?? "";
  const answer = (formData.get("answer") as string | null)?.trim() ?? "";
  const sort_order = Number(formData.get("sort_order") || 0);
  if (!id || !question || !answer) {
    redirect("/admin/faqs?error=Missing%20FAQ%20fields.");
  }
  const { error } = await supabase
    .from("marketing_faqs")
    .update({
      question,
      answer,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);
  if (error) {
    redirect(`/admin/faqs?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/faq");
  revalidatePath("/admin/faqs");
  redirect("/admin/faqs?saved=1");
}

export async function deleteMarketingFaq(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  if (!id) {
    redirect("/admin/faqs?error=Missing%20FAQ%20id.");
  }
  const { error } = await supabase.from("marketing_faqs").delete().eq("id", id);
  if (error) {
    redirect(`/admin/faqs?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/faq");
  revalidatePath("/admin/faqs");
  redirect("/admin/faqs?deleted=1");
}

export async function addMarketingReview(formData: FormData) {
  const supabase = await requireMarketingManagerClient();
  const reviewer_name = (formData.get("reviewer_name") as string | null)?.trim() ?? "";
  const pet_name = (formData.get("pet_name") as string | null)?.trim() ?? "";
  const message = (formData.get("message") as string | null)?.trim() ?? "";
  const stars = Number(formData.get("stars") || 5);
  const sort_order = Number(formData.get("sort_order") || 0);
  const owner_image_url = (formData.get("owner_image_url") as string | null)?.trim() || null;
  if (!reviewer_name || !pet_name || !message) {
    redirect("/admin/reviews?error=Reviewer%20name%2C%20pet%20name%20and%20message%20are%20required.");
  }
  const { error } = await supabase.from("marketing_reviews").insert({
    reviewer_name,
    pet_name,
    message,
    stars: Number.isFinite(stars) ? stars : 5,
    sort_order: Number.isFinite(sort_order) ? sort_order : 0,
    owner_image_url,
    is_active: formData.get("is_active") === "on",
  });
  if (error) redirect(`/admin/reviews?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/");
  revalidatePath("/admin/reviews");
  redirect("/admin/reviews?saved=1");
}

export async function updateMarketingReview(formData: FormData) {
  const supabase = await requireMarketingManagerClient();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const reviewer_name = (formData.get("reviewer_name") as string | null)?.trim() ?? "";
  const pet_name = (formData.get("pet_name") as string | null)?.trim() ?? "";
  const message = (formData.get("message") as string | null)?.trim() ?? "";
  const stars = Number(formData.get("stars") || 5);
  const sort_order = Number(formData.get("sort_order") || 0);
  const owner_image_url = (formData.get("owner_image_url") as string | null)?.trim() || null;
  if (!id || !reviewer_name || !pet_name || !message) {
    redirect("/admin/reviews?error=Missing%20review%20fields.");
  }
  const { error } = await supabase
    .from("marketing_reviews")
    .update({
      reviewer_name,
      pet_name,
      message,
      stars: Number.isFinite(stars) ? stars : 5,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      owner_image_url,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);
  if (error) redirect(`/admin/reviews?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/");
  revalidatePath("/admin/reviews");
  redirect("/admin/reviews?saved=1");
}

export async function deleteMarketingReview(formData: FormData) {
  const supabase = await requireMarketingManagerClient();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  if (!id) redirect("/admin/reviews?error=Missing%20review%20id.");
  const { error } = await supabase.from("marketing_reviews").delete().eq("id", id);
  if (error) redirect(`/admin/reviews?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/");
  revalidatePath("/admin/reviews");
  redirect("/admin/reviews?deleted=1");
}

const POPUP_TEMPLATES = ["offer", "community", "reminder", "announcement", "generic"] as const;

export async function addMarketingPopup(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const body = (formData.get("body") as string | null)?.trim() || null;
  const template_type = (formData.get("template_type") as string | null)?.trim() ?? "announcement";
  const image_url = (formData.get("image_url") as string | null)?.trim() || null;
  const cta_label = (formData.get("cta_label") as string | null)?.trim() || null;
  const cta_href = (formData.get("cta_href") as string | null)?.trim() || null;
  const sort_order = Number(formData.get("sort_order") || 0);
  if (!title) redirect("/admin/popups?error=Title%20is%20required.");
  if (!POPUP_TEMPLATES.includes(template_type as (typeof POPUP_TEMPLATES)[number])) {
    redirect("/admin/popups?error=Invalid%20template.");
  }
  const { error } = await supabase.from("marketing_site_popups").insert({
    title,
    body,
    template_type,
    image_url,
    cta_label,
    cta_href,
    sort_order: Number.isFinite(sort_order) ? sort_order : 0,
    is_active: formData.get("is_active") === "on",
  });
  if (error) redirect(`/admin/popups?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  revalidatePath("/admin/popups");
  redirect("/admin/popups?saved=1");
}

export async function updateMarketingPopup(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const body = (formData.get("body") as string | null)?.trim() || null;
  const template_type = (formData.get("template_type") as string | null)?.trim() ?? "announcement";
  const image_url = (formData.get("image_url") as string | null)?.trim() || null;
  const cta_label = (formData.get("cta_label") as string | null)?.trim() || null;
  const cta_href = (formData.get("cta_href") as string | null)?.trim() || null;
  const sort_order = Number(formData.get("sort_order") || 0);
  if (!id || !title) redirect("/admin/popups?error=Missing%20popup%20fields.");
  if (!POPUP_TEMPLATES.includes(template_type as (typeof POPUP_TEMPLATES)[number])) {
    redirect("/admin/popups?error=Invalid%20template.");
  }
  const { error } = await supabase
    .from("marketing_site_popups")
    .update({
      title,
      body,
      template_type,
      image_url,
      cta_label,
      cta_href,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);
  if (error) redirect(`/admin/popups?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  revalidatePath("/admin/popups");
  redirect("/admin/popups?saved=1");
}

export async function deleteMarketingPopup(formData: FormData) {
  const supabase = await requireSuperAdmin();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  if (!id) redirect("/admin/popups?error=Missing%20id.");
  const { error } = await supabase.from("marketing_site_popups").delete().eq("id", id);
  if (error) redirect(`/admin/popups?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  revalidatePath("/admin/popups");
  redirect("/admin/popups?deleted=1");
}

export async function updateMarketingSeoSettings(formData: FormData) {
  const supabase = await requireSuperAdmin();

  const { data: existingRow } = await supabase
    .from("marketing_site_settings")
    .select("seo_settings")
    .eq("id", "default")
    .maybeSingle();

  const prev = (existingRow?.seo_settings as Record<string, string> | null) ?? {};
  const google_site_verification = String(formData.get("google_site_verification") ?? "").trim();
  const public_site_url = String(formData.get("public_site_url") ?? "").trim();

  const seo_settings = { ...prev };
  if (google_site_verification) seo_settings.google_site_verification = google_site_verification;
  else delete seo_settings.google_site_verification;
  if (public_site_url) seo_settings.public_site_url = public_site_url.replace(/\/$/, "");
  else delete seo_settings.public_site_url;

  const { error } = await supabase.from("marketing_site_settings").upsert(
    {
      id: "default",
      seo_settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    redirect(`/admin/seo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/sitemap.xml");
  revalidatePath("/robots.txt");
  revalidatePath("/admin/seo");
  redirect("/admin/seo?saved=1");
}

export async function recordSitemapPingAction() {
  const supabase = await requireSuperAdmin();
  const { data: existingRow } = await supabase
    .from("marketing_site_settings")
    .select("seo_settings")
    .eq("id", "default")
    .maybeSingle();

  const prev = (existingRow?.seo_settings as Record<string, string> | null) ?? {};
  const seo_settings = {
    ...prev,
    last_sitemap_ping_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("marketing_site_settings").upsert(
    {
      id: "default",
      seo_settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    redirect(`/admin/seo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/seo");
  redirect("/admin/seo?pinged=1");
}

const TEAM_PHOTO_BUCKET = "clinic-assets";

async function uploadMarketingTeamPhoto(memberId: string, file: File): Promise<string> {
  if (!file.size) throw new Error("Photo is required.");
  if (!file.type.startsWith("image/")) throw new Error("Photo must be an image file.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Photo must be under 5 MB.");

  const supabase = await requireMarketingManagerClient();
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `marketing/team/${memberId}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from(TEAM_PHOTO_BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(TEAM_PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function addMarketingTeamMember(formData: FormData) {
  const supabase = await requireMarketingManagerClient();
  const full_name = (formData.get("full_name") as string | null)?.trim() ?? "";
  const role_title = (formData.get("role_title") as string | null)?.trim() || null;
  const sort_order = Number(formData.get("sort_order") || 0);
  const photo = formData.get("photo");

  if (!full_name) {
    redirect("/admin/team?error=Name%20is%20required.");
  }
  if (!(photo instanceof File) || photo.size === 0) {
    redirect("/admin/team?error=Photo%20is%20required.");
  }

  try {
    const memberId = crypto.randomUUID();
    const image_url = await uploadMarketingTeamPhoto(memberId, photo);

    const { error } = await supabase.from("marketing_team_members").insert({
      id: memberId,
      full_name,
      role_title,
      image_url,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      is_active: formData.get("is_active") === "on",
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    redirect(`/admin/team?error=${encodeURIComponent(e instanceof Error ? e.message : "Could not add team member.")}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/team");
  revalidatePath("/admin/team");
  redirect("/admin/team?saved=1");
}

export async function updateMarketingTeamMember(formData: FormData) {
  const supabase = await requireMarketingManagerClient();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  const full_name = (formData.get("full_name") as string | null)?.trim() ?? "";
  const role_title = (formData.get("role_title") as string | null)?.trim() || null;
  const sort_order = Number(formData.get("sort_order") || 0);
  const photo = formData.get("photo");

  if (!id || !full_name) {
    redirect("/admin/team?error=Missing%20required%20fields.");
  }

  const payload: Record<string, unknown> = {
    full_name,
    role_title,
    sort_order: Number.isFinite(sort_order) ? sort_order : 0,
    is_active: formData.get("is_active") === "on",
  };

  try {
    if (photo instanceof File && photo.size > 0) {
      payload.image_url = await uploadMarketingTeamPhoto(id, photo);
    }

    const { error } = await supabase.from("marketing_team_members").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } catch (e) {
    redirect(`/admin/team?error=${encodeURIComponent(e instanceof Error ? e.message : "Could not update team member.")}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/team");
  revalidatePath("/admin/team");
  redirect("/admin/team?saved=1");
}

export async function deleteMarketingTeamMember(formData: FormData) {
  const supabase = await requireMarketingManagerClient();
  const id = (formData.get("id") as string | null)?.trim() ?? "";
  if (!id) {
    redirect("/admin/team?error=Missing%20member%20id.");
  }

  const { error } = await supabase.from("marketing_team_members").delete().eq("id", id);
  if (error) {
    redirect(`/admin/team?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/team");
  revalidatePath("/admin/team");
  redirect("/admin/team?deleted=1");
}

const WEBSITE_FAVICON_PATH = "marketing/branding/website-favicon.png";

export async function updateWebsiteFavicon(formData: FormData) {
  const supabase = await requireMarketingManagerClient();
  const photo = formData.get("website_favicon");
  if (!(photo instanceof File) || photo.size === 0) {
    redirect("/admin/settings?error=Choose%20a%20square%20PNG%20favicon%20to%20upload.");
  }

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const validation = validateSquarePngUpload(bytes);
  if (!validation.ok) {
    redirect(`/admin/settings?error=${encodeURIComponent(validation.reason)}`);
  }

  const { error: uploadError } = await supabase.storage.from("clinic-assets").upload(WEBSITE_FAVICON_PATH, bytes, {
    contentType: "image/png",
    upsert: true,
  });
  if (uploadError) {
    redirect(`/admin/settings?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { data: publicUrl } = supabase.storage.from("clinic-assets").getPublicUrl(WEBSITE_FAVICON_PATH);
  const website_favicon_url = `${publicUrl.publicUrl}?v=${Date.now()}`;

  const { error } = await supabase.from("marketing_site_settings").upsert(
    {
      id: "default",
      website_favicon_url,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/icon");
  revalidatePath("/apple-icon");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?favicon_saved=1");
}

export async function clearWebsiteFavicon() {
  const supabase = await requireMarketingManagerClient();
  const { error } = await supabase
    .from("marketing_site_settings")
    .update({ website_favicon_url: null, updated_at: new Date().toISOString() })
    .eq("id", "default");
  if (error) {
    redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/icon");
  revalidatePath("/apple-icon");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?favicon_cleared=1");
}
