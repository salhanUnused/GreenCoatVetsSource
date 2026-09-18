"use client";

import { useLayoutEffect } from "react";

const FORM_ID = "form-visit-record";

type DraftMap = Record<string, string | boolean>;
type StoredDraft = { revision: string; fields: DraftMap };

function storageKey(visitId: string) {
  return `saasclinics:visit-eval-draft:${visitId}`;
}

function readDraft(form: HTMLFormElement): DraftMap {
  const out: DraftMap = {};
  const elements = Array.from(form.elements) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
  for (const el of elements) {
    const name = el.name?.trim();
    if (!name) continue;
    if (el instanceof HTMLButtonElement) continue;
    if (el instanceof HTMLInputElement) {
      if (el.type === "hidden" || el.type === "submit" || el.type === "button" || el.type === "file") continue;
      if (el.type === "checkbox" || el.type === "radio") {
        out[name] = el.checked;
        continue;
      }
    }
    out[name] = el.value;
  }
  return out;
}

function applyDraft(form: HTMLFormElement, draft: DraftMap) {
  for (const [name, value] of Object.entries(draft)) {
    const named = form.elements.namedItem(name);
    if (!named) continue;
    const els = named instanceof RadioNodeList ? Array.from(named) : [named];
    for (const node of els) {
      if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) {
        continue;
      }
      if (node instanceof HTMLInputElement && (node.type === "checkbox" || node.type === "radio")) {
        node.checked = Boolean(value);
      } else {
        node.value = String(value ?? "");
      }
    }
  }
}

/**
 * Persists structured-record field values in sessionStorage so switching
 * documentation modes (or soft navigations) does not wipe unsaved evaluation data.
 */
export function VisitFormDraftGuard({ visitId, revision }: { visitId: string; revision: string }) {
  useLayoutEffect(() => {
    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    if (!form) return;

    const key = storageKey(visitId);

    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredDraft;
        if (parsed?.revision === revision && parsed.fields && typeof parsed.fields === "object") {
          applyDraft(form, parsed.fields);
        } else {
          sessionStorage.removeItem(key);
        }
      }
    } catch {
      /* ignore */
    }

    const persist = () => {
      try {
        const payload: StoredDraft = { revision, fields: readDraft(form) };
        sessionStorage.setItem(key, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    };

    form.addEventListener("input", persist);
    form.addEventListener("change", persist);
    return () => {
      form.removeEventListener("input", persist);
      form.removeEventListener("change", persist);
    };
  }, [visitId, revision]);

  return null;
}
