"use client";

import { useEffect, useRef, useState } from "react";

type Direction = "up" | "down";
type IdlePose = "sit" | "sleep";
const TOP_OFFSET_PX = 104;
const MIN_BOTTOM_OFFSET_PX = 24;
const FOOTER_CLEARANCE_PX = 16;

/**
 * Decorative site-wide scroll tracker for the public website.
 * Scroll handlers are rAF-throttled; idle poses stay static to avoid continuous CPU work.
 */
export function ScrollDogIndicator() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [direction, setDirection] = useState<Direction>("down");
  const [moving, setMoving] = useState(false);
  const [idlePose, setIdlePose] = useState<IdlePose>("sit");
  const [bottomOffset, setBottomOffset] = useState(MIN_BOTTOM_OFFSET_PX);
  const lastY = useRef(0);
  const moveTimer = useRef<number | undefined>(undefined);
  const sleepTimer = useRef<number | undefined>(undefined);
  const raf = useRef<number | undefined>(undefined);
  const latest = useRef({ visible: false, progress: 0, bottomOffset: MIN_BOTTOM_OFFSET_PX });

  useEffect(() => {
    const clearTimers = () => {
      if (moveTimer.current !== undefined) window.clearTimeout(moveTimer.current);
      if (sleepTimer.current !== undefined) window.clearTimeout(sleepTimer.current);
    };

    const apply = () => {
      raf.current = undefined;
      const doc = document.documentElement;
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 0);
      const y = window.scrollY;
      const footerRect = document.querySelector("footer")?.getBoundingClientRect();
      const footerOverlap = footerRect ? Math.max(window.innerHeight - footerRect.top, 0) : 0;
      const nextVisible = maxScroll > 280;
      const nextProgress = maxScroll > 0 ? Math.min(Math.max(y / maxScroll, 0), 1) : 0;
      const nextBottom = Math.max(MIN_BOTTOM_OFFSET_PX, footerOverlap + FOOTER_CLEARANCE_PX);

      if (latest.current.visible !== nextVisible) {
        latest.current.visible = nextVisible;
        setVisible(nextVisible);
      }
      if (Math.abs(latest.current.progress - nextProgress) > 0.002) {
        latest.current.progress = nextProgress;
        setProgress(nextProgress);
      }
      if (latest.current.bottomOffset !== nextBottom) {
        latest.current.bottomOffset = nextBottom;
        setBottomOffset(nextBottom);
      }

      const delta = y - lastY.current;
      if (Math.abs(delta) > 1) {
        setDirection(delta > 0 ? "down" : "up");
        setMoving(true);
        setIdlePose("sit");
        clearTimers();
        moveTimer.current = window.setTimeout(() => setMoving(false), 140);
        sleepTimer.current = window.setTimeout(() => setIdlePose("sleep"), 1250);
      }
      lastY.current = y;
    };

    const schedule = () => {
      if (raf.current !== undefined) return;
      raf.current = window.requestAnimationFrame(apply);
    };

    apply();
    const initialSleep = window.setTimeout(() => setIdlePose("sleep"), 1250);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf.current !== undefined) window.cancelAnimationFrame(raf.current);
      window.clearTimeout(initialSleep);
      clearTimers();
    };
  }, []);

  if (!visible) return null;

  const stateClass = moving ? `scroll-dog--${direction}` : idlePose === "sleep" ? "scroll-dog--sleep" : "scroll-dog--sit";

  return (
    <div
      className="scroll-dog-indicator"
      aria-hidden="true"
      style={{ top: `${TOP_OFFSET_PX}px`, bottom: `${bottomOffset}px` }}
    >
      <div
        className={`scroll-dog-runner ${stateClass}`}
        style={{ top: `calc(${progress.toFixed(4)} * (100% - 3rem))` }}
      >
        <span className="scroll-dog-shadow" />
        <span className="material-symbols-outlined scroll-dog-emoji scroll-paw-icon">pets</span>
        {moving ? (
          <span className="scroll-dog-arrow">{direction === "down" ? "↓" : "↑"}</span>
        ) : idlePose === "sleep" ? (
          <span className="scroll-dog-zzz">Zzz</span>
        ) : null}
      </div>
    </div>
  );
}
