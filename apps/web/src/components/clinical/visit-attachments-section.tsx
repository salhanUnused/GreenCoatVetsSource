"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { deleteVisitAttachment, uploadVisitAttachment } from "@/app/(portal)/visits/actions";
import {
  VisitAttachmentsLive,
  type VisitAttachmentRow,
} from "@/components/clinical/visit-attachments-live";

export function VisitAttachmentsSection({
  visitId,
  clinicId,
  petId,
  branchId,
  initialAttachments,
}: {
  visitId: string;
  clinicId: string;
  petId: string;
  branchId: string;
  initialAttachments: VisitAttachmentRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const bumpList = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    startTransition(async () => {
      try {
        await uploadVisitAttachment(fd);
        form.reset();
        bumpList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  function onDelete(attachmentId: string) {
    setError(null);
    const fd = new FormData();
    fd.set("attachment_id", attachmentId);
    fd.set("visit_id", visitId);
    startTransition(async () => {
      try {
        await deleteVisitAttachment(fd);
        bumpList();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed.");
      }
    });
  }

  return (
    <>
      <form
        ref={formRef}
        onSubmit={onUpload}
        className="space-y-2"
        encType="multipart/form-data"
        // Prevent accidental nesting from submitting the visit save form.
        onClick={(e) => e.stopPropagation()}
      >
        <input type="hidden" name="visit_id" value={visitId} />
        <input type="hidden" name="pet_id" value={petId} />
        <input type="hidden" name="branch_id" value={branchId} />
        <input className="input-file-soft input-file-compact max-w-md" name="file" type="file" required />
        <button
          type="submit"
          disabled={pending}
          className="btn-secondary btn-compact inline-flex items-center justify-center gap-2 text-xs disabled:opacity-60"
        >
          {pending ? (
            <>
              <span
                className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden
              />
              Working…
            </>
          ) : (
            "Upload file"
          )}
        </button>
      </form>

      {error ? (
        <p className="mt-2 text-[11px] font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 space-y-1.5 text-[11px]">
        <VisitAttachmentsLive
          visitId={visitId}
          clinicId={clinicId}
          initialAttachments={initialAttachments}
          refreshKey={refreshKey}
          onDelete={onDelete}
          deleteDisabled={pending}
        />
      </ul>
    </>
  );
}
