import { Linking } from "react-native";
import { supabase } from "./supabase";

export type VisitAttachmentRow = {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  storage_bucket: string;
  storage_path: string;
  created_at: string;
};

export async function fetchVisitAttachments(visitId: string): Promise<VisitAttachmentRow[]> {
  const { data, error } = await supabase
    .from("file_attachments")
    .select("id, file_name, mime_type, storage_bucket, storage_path, created_at")
    .eq("visit_id", visitId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as VisitAttachmentRow[]) ?? [];
}

export async function openVisitAttachment(row: VisitAttachmentRow): Promise<void> {
  const { data, error } = await supabase.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60 * 60);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not open file.");
  await Linking.openURL(data.signedUrl);
}
