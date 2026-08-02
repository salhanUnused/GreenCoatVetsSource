"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMarketingManager } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

async function requireFooterManager() {
  await requireMarketingManager();
  return createClient();
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "column";
}

function redirectFooterError(message: string): never {
  redirect(`/admin/footer?error=${encodeURIComponent(message)}`);
}

export async function addFooterGroup(formData: FormData) {
  const supabase = await requireFooterManager();
  const title = (formData.get("title") as string)?.trim();
  if (!title) redirectFooterError("Column title is required");

  let slug = (formData.get("slug") as string)?.trim().toLowerCase() || slugify(title);
  const sort_order = Number(formData.get("sort_order") || 0);

  const { data: existing } = await supabase.from("marketing_footer_groups").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const { error } = await supabase.from("marketing_footer_groups").insert({
    slug,
    title,
    sort_order: Number.isFinite(sort_order) ? sort_order : 0,
  });

  if (error) redirectFooterError(error.message);
  revalidatePath("/", "layout");
  revalidatePath("/");
  redirect("/admin/footer?saved=1");
}

export async function updateFooterGroup(formData: FormData) {
  const supabase = await requireFooterManager();
  const id = formData.get("id") as string;
  if (!id) redirectFooterError("Missing column id");

  const title = (formData.get("title") as string)?.trim();
  if (!title) redirectFooterError("Column title is required");

  const sort_order = Number(formData.get("sort_order") || 0);

  const { error } = await supabase
    .from("marketing_footer_groups")
    .update({
      title,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
    })
    .eq("id", id);

  if (error) redirectFooterError(error.message);
  revalidatePath("/", "layout");
  revalidatePath("/");
  redirect("/admin/footer?saved=1");
}

export async function deleteFooterGroup(formData: FormData) {
  const supabase = await requireFooterManager();
  const id = formData.get("id") as string;
  if (!id) redirectFooterError("Missing column id");

  const { error } = await supabase.from("marketing_footer_groups").delete().eq("id", id);
  if (error) redirectFooterError(error.message);
  revalidatePath("/", "layout");
  revalidatePath("/");
  redirect("/admin/footer?deleted=1");
}

export async function reorderFooterGroup(formData: FormData) {
  const supabase = await requireFooterManager();
  const id = formData.get("id") as string;
  const direction = formData.get("direction") as string;
  if (!id || (direction !== "up" && direction !== "down")) redirectFooterError("Invalid reorder");

  const { data: row } = await supabase.from("marketing_footer_groups").select("id, sort_order").eq("id", id).maybeSingle();
  if (!row) redirectFooterError("Column not found");

  const { data: all } = await supabase
    .from("marketing_footer_groups")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  const list = all ?? [];
  const idx = list.findIndex((r) => r.id === id);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= list.length) {
    redirect("/admin/footer");
  }

  const a = list[idx]!;
  const b = list[swapWith]!;
  const orderA = a.sort_order as number;
  const orderB = b.sort_order as number;

  await supabase.from("marketing_footer_groups").update({ sort_order: orderB }).eq("id", a.id);
  const { error } = await supabase.from("marketing_footer_groups").update({ sort_order: orderA }).eq("id", b.id);

  if (error) redirectFooterError(error.message);
  revalidatePath("/", "layout");
  revalidatePath("/");
  redirect("/admin/footer?saved=1");
}

export async function addFooterLink(formData: FormData) {
  const supabase = await requireFooterManager();
  const group_id = formData.get("group_id") as string;
  if (!group_id) redirectFooterError("Missing column");

  const label = (formData.get("label") as string)?.trim();
  const href = (formData.get("href") as string)?.trim();
  if (!label || !href) redirectFooterError("Label and URL are required");

  const sort_order = Number(formData.get("sort_order") || 0);
  const open_in_new_tab = formData.get("open_in_new_tab") === "on";
  const is_active = formData.get("is_active") === "on";

  const { error } = await supabase.from("marketing_footer_links").insert({
    group_id,
    label,
    href,
    sort_order: Number.isFinite(sort_order) ? sort_order : 0,
    open_in_new_tab,
    is_active,
  });

  if (error) redirectFooterError(error.message);
  revalidatePath("/", "layout");
  revalidatePath("/");
  redirect("/admin/footer?saved=1");
}

export async function updateFooterLink(formData: FormData) {
  const supabase = await requireFooterManager();
  const id = formData.get("id") as string;
  if (!id) redirectFooterError("Missing link id");

  const label = (formData.get("label") as string)?.trim();
  const href = (formData.get("href") as string)?.trim();
  if (!label || !href) redirectFooterError("Label and URL are required");

  const sort_order = Number(formData.get("sort_order") || 0);
  const open_in_new_tab = formData.get("open_in_new_tab") === "on";
  const is_active = formData.get("is_active") === "on";

  const { error } = await supabase
    .from("marketing_footer_links")
    .update({
      label,
      href,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      open_in_new_tab,
      is_active,
    })
    .eq("id", id);

  if (error) redirectFooterError(error.message);
  revalidatePath("/", "layout");
  revalidatePath("/");
  redirect("/admin/footer?saved=1");
}

export async function deleteFooterLink(formData: FormData) {
  const supabase = await requireFooterManager();
  const id = formData.get("id") as string;
  if (!id) redirectFooterError("Missing link id");

  const { error } = await supabase.from("marketing_footer_links").delete().eq("id", id);
  if (error) redirectFooterError(error.message);
  revalidatePath("/", "layout");
  revalidatePath("/");
  redirect("/admin/footer?deleted=1");
}

export async function reorderFooterLink(formData: FormData) {
  const supabase = await requireFooterManager();
  const id = formData.get("id") as string;
  const direction = formData.get("direction") as string;
  if (!id || (direction !== "up" && direction !== "down")) redirectFooterError("Invalid reorder");

  const { data: linkRow } = await supabase.from("marketing_footer_links").select("id, group_id, sort_order").eq("id", id).maybeSingle();
  if (linkRow == null) redirectFooterError("Link not found");

  const groupId = linkRow.group_id as string;

  const { data: siblings } = await supabase
    .from("marketing_footer_links")
    .select("id, sort_order")
    .eq("group_id", groupId)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  const list = siblings ?? [];
  const idx = list.findIndex((r) => r.id === id);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= list.length) {
    redirect("/admin/footer");
  }

  const a = list[idx]!;
  const b = list[swapWith]!;
  const orderA = a.sort_order as number;
  const orderB = b.sort_order as number;

  await supabase.from("marketing_footer_links").update({ sort_order: orderB }).eq("id", a.id);
  const { error } = await supabase.from("marketing_footer_links").update({ sort_order: orderA }).eq("id", b.id);

  if (error) redirectFooterError(error.message);
  revalidatePath("/", "layout");
  revalidatePath("/");
  redirect("/admin/footer?saved=1");
}
