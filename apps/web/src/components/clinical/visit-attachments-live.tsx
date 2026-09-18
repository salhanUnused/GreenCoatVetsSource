"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type VisitAttachmentRow = {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  created_at: string;
  storage_path: string;
};

export function VisitAttachmentsLive({
  visitId,
  clinicId,
  initialAttachments,
  refreshKey = 0,
  onDelete,
  deleteDisabled = false,
}: {
  visitId: string;
  clinicId: string;
  initialAttachments: VisitAttachmentRow[];
  refreshKey?: number;
  onDelete?: (attachmentId: string) => void;
  deleteDisabled?: boolean;
}) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("file_attachments")
      .select("id, file_name, mime_type, created_at, storage_path")
      .eq("visit_id", visitId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

    setAttachments((data ?? []) as VisitAttachmentRow[]);
  }, [visitId, clinicId]);

  useEffect(() => {
    setAttachments(initialAttachments);
  }, [initialAttachments]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`visit-attachments-${visitId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "file_attachments",
          filter: `visit_id=eq.${visitId}`,
        },
        () => {
          void reload();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [visitId, reload]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function loadPreviews() {
      const next: Record<string, string> = {};
      for (const row of attachments) {
        if (!row.mime_type?.startsWith("image/")) continue;
        const { data } = await supabase.storage.from("medical-files").createSignedUrl(row.storage_path, 3600);
        if (data?.signedUrl) next[row.id] = data.signedUrl;
      }
      if (!cancelled) setPreviewUrls(next);
    }

    void loadPreviews();
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  if (!attachments.length) {
    return <li className="text-on-surface-variant">No attachments yet.</li>;
  }

  return (
    <>
      {attachments.map((attachment) => (
        <li key={attachment.id} className="rounded-lg border border-outline-variant/15 px-2 py-1.5">
          {previewUrls[attachment.id] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrls[attachment.id]}
              alt={attachment.file_name ?? "Visit attachment"}
              className="mb-2 max-h-40 rounded-md border border-outline-variant/10 object-contain"
            />
          ) : null}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">{attachment.file_name ?? "File"}</p>
              <p className="text-on-surface-variant">
                {attachment.mime_type ?? "-"} · {new Date(attachment.created_at).toLocaleString()}
              </p>
            </div>
            {onDelete ? (
              <button
                type="button"
                disabled={deleteDisabled}
                className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                onClick={() => {
                  if (window.confirm(`Delete “${attachment.file_name ?? "this file"}”?`)) {
                    onDelete(attachment.id);
                  }
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </>
  );
}
