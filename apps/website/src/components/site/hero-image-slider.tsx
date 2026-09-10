"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_HOMEPAGE_IMAGES } from "@/lib/marketing/defaults";
import { resolveMarketingImageUrl } from "@/lib/marketing/resolve-marketing-image-url";

export function HeroImageSlider({
  urls = [],
  alt,
}: {
  urls?: string[] | null;
  alt: string;
}) {
  const resolvedUrls = useMemo(
    () =>
      (Array.isArray(urls) ? urls : [])
        .map((url) => resolveMarketingImageUrl(url))
        .filter(Boolean),
    [urls],
  );
  const fallback = resolveMarketingImageUrl(DEFAULT_HOMEPAGE_IMAGES.hero);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const list = useMemo(() => {
    const usable = resolvedUrls.filter((src) => !failed.has(src));
    return usable.length ? usable : [fallback];
  }, [resolvedUrls, failed, fallback]);

  const [index, setIndex] = useState(0);
  const listSignature = useMemo(() => list.join("|"), [list]);

  useEffect(() => {
    setIndex(0);
  }, [listSignature]);

  useEffect(() => {
    if (list.length <= 1) return;

    let id: number | undefined;
    const start = () => {
      if (id !== undefined) return;
      id = window.setInterval(() => {
        setIndex((i) => (i + 1) % list.length);
      }, 5500);
    };
    const stop = () => {
      if (id === undefined) return;
      window.clearInterval(id);
      id = undefined;
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [list.length]);

  if (!list.length) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-[2rem] shadow-2xl shadow-on-surface/10 transition-transform duration-700 lg:rotate-2">
      <div className="relative h-[min(70vh,600px)] w-full">
        {list.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${i === index ? "z-10 opacity-100" : "z-0 opacity-0"}`}
          >
            {/* Native img so Supabase storage and any admin URL work without Next image allowlists */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={i === 0 ? alt : ""}
              className="h-full w-full object-cover"
              decoding="async"
              loading={i === 0 ? "eager" : "lazy"}
              onError={() => {
                setFailed((prev) => {
                  if (prev.has(src)) return prev;
                  const next = new Set(prev);
                  next.add(src);
                  return next;
                });
              }}
            />
          </div>
        ))}
      </div>
      {list.length > 1 ? (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {list.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === index ? "w-8 bg-white" : "w-2 bg-white/50"}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
