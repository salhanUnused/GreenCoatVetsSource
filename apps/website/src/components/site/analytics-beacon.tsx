"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Records a lightweight page view (path only) for super-admin traffic stats.
 * Deferred + idle so it does not compete with LCP / hydration.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    if (last.current === pathname) return;
    last.current = pathname;

    const send = () => {
      const body = JSON.stringify({ path: pathname });
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const ok = navigator.sendBeacon("/api/analytics/pulse", new Blob([body], { type: "application/json" }));
        if (ok) return;
      }
      void fetch("/api/analytics/pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    };

    let idleId: number | undefined;
    const t = window.setTimeout(() => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(() => send(), { timeout: 4000 });
      } else {
        send();
      }
    }, 2000);

    return () => {
      window.clearTimeout(t);
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [pathname]);

  return null;
}
