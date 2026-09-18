"use client";

import dynamic from "next/dynamic";

/** Lazy-load react-rnd floating windows so the portal shell stays light. */
export const ClinicalWindowsLayerLazy = dynamic(
  () => import("./clinical-windows-layer").then((m) => ({ default: m.ClinicalWindowsLayer })),
  { ssr: false },
);
