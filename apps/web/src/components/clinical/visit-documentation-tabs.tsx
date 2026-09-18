"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PawCircularLoader } from "@/components/web/paw-circular-loader";

export type VisitDocumentationTab = "form" | "photo" | "digital";

const TABS: Array<{ id: VisitDocumentationTab; label: string; hint: string; loadingMessage: string }> = [
  {
    id: "form",
    label: "Structured record",
    hint: "Voice dictation, clinical form, and prescription",
    loadingMessage: "Opening structured record…",
  },
  {
    id: "photo",
    label: "Photo sheet",
    hint: "Write on paper, photograph with phone or camera, save as PDF report",
    loadingMessage: "Opening photo sheet…",
  },
  {
    id: "digital",
    label: "Digital sheet",
    hint: "Draw on the clinic template on screen",
    loadingMessage: "Opening digital sheet…",
  },
];

function isVisitDocTab(value: string | null): value is VisitDocumentationTab {
  return value === "form" || value === "photo" || value === "digital";
}

export function VisitDocumentationTabs({
  visitId,
  defaultTab = "form",
  formPanel,
  photoPanel,
  digitalPanel,
}: {
  visitId: string;
  defaultTab?: VisitDocumentationTab;
  formPanel: ReactNode;
  photoPanel: ReactNode;
  digitalPanel: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("doc");
  const activeTab = isVisitDocTab(tabParam) ? tabParam : defaultTab;
  const [switchingTo, setSwitchingTo] = useState<VisitDocumentationTab | null>(null);
  const [photoMountKey, setPhotoMountKey] = useState(1);
  /** Keep panels mounted after first open so form/canvas state is not wiped. */
  const [everOpened, setEverOpened] = useState<Record<VisitDocumentationTab, boolean>>({
    form: true,
    photo: false,
    digital: false,
  });

  useEffect(() => {
    setPhotoMountKey((key) => key + 1);
    setEverOpened({ form: true, photo: false, digital: false });
  }, [visitId]);

  useEffect(() => {
    setEverOpened((prev) => (prev[activeTab] ? prev : { ...prev, [activeTab]: true }));
  }, [activeTab]);

  const setTab = useCallback(
    (tab: VisitDocumentationTab) => {
      if (tab === activeTab) return;
      if (tab === "photo") {
        setPhotoMountKey((key) => key + 1);
        setEverOpened((prev) => ({ ...prev, photo: true }));
      }
      setSwitchingTo(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("doc", tab);
      router.replace(`/visits/${visitId}?${params.toString()}`, { scroll: false });
    },
    [activeTab, router, searchParams, visitId],
  );

  useEffect(() => {
    if (!switchingTo || switchingTo !== activeTab) return;
    const timer = window.setTimeout(() => setSwitchingTo(null), 180);
    return () => window.clearTimeout(timer);
  }, [activeTab, switchingTo]);

  const isSwitching = switchingTo !== null;
  const loadingMessage = useMemo(
    () => TABS.find((tab) => tab.id === (switchingTo ?? activeTab))?.loadingMessage ?? "Loading…",
    [activeTab, switchingTo],
  );
  const activeHint = useMemo(() => TABS.find((tab) => tab.id === activeTab)?.hint ?? "", [activeTab]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-2 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              disabled={isSwitching}
              className={`flex-1 rounded-xl px-4 py-3 text-left transition-colors disabled:opacity-70 ${
                activeTab === tab.id
                  ? "border border-primary bg-primary text-white shadow-sm shadow-primary/20"
                  : "border border-transparent bg-white text-slate-800 hover:border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="block text-sm font-bold">{tab.label}</span>
              <span
                className={`mt-0.5 block text-[11px] leading-snug ${
                  activeTab === tab.id ? "text-white/90" : "text-slate-500"
                }`}
              >
                {tab.hint}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 px-2 text-[11px] text-on-surface-variant">{activeHint}</p>
      </div>

      <div className="relative">
        {isSwitching ? (
          <div className="absolute inset-0 z-20 flex min-h-[280px] items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container-lowest/95 py-16 backdrop-blur-[1px]">
            <PawCircularLoader size="md" message={loadingMessage} />
          </div>
        ) : null}

        {/* Keep structured record in the DOM so evaluation fields are not wiped when switching modes */}
        {everOpened.form ? (
          <div
            className={activeTab === "form" ? "block" : "hidden"}
            aria-hidden={activeTab !== "form"}
          >
            {formPanel}
          </div>
        ) : null}

        {everOpened.photo ? (
          <div
            className={activeTab === "photo" ? "block" : "hidden"}
            aria-hidden={activeTab !== "photo"}
          >
            <div key={`photo-panel-${visitId}-${photoMountKey}`}>{photoPanel}</div>
          </div>
        ) : null}

        {everOpened.digital ? (
          <div
            className={activeTab === "digital" ? "block" : "hidden"}
            aria-hidden={activeTab !== "digital"}
          >
            {digitalPanel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
