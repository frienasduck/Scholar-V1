"use client";

import { useEffect, useState } from "react";

export type LamRenderQuality = "desktop-high" | "mobile-optimized";
// Match AppShell's lg desktop dock. Tablet/phone landscape has no header dock.
export const LAM_COMPACT_MEDIA_QUERY = "(max-width: 1023px)";

function detectQuality(): LamRenderQuality {
  if (typeof window === "undefined") return "desktop-high";
  const mobile = window.matchMedia(LAM_COMPACT_MEDIA_QUERY).matches;
  if (!mobile) return "desktop-high";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const constrained = (navigator.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return mobile || constrained || coarse ? "mobile-optimized" : "desktop-high";
}

export function useLamRenderQuality() {
  const [quality, setQuality] = useState<LamRenderQuality>("desktop-high");
  useEffect(() => {
    const query = window.matchMedia(LAM_COMPACT_MEDIA_QUERY);
    const sync = () => setQuality(detectQuality());
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return quality;
}
