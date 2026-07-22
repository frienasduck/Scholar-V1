"use client";

import { useEffect, useState } from "react";

export type LamRenderQuality = "desktop-high" | "mobile-optimized";

function detectQuality(): LamRenderQuality {
  if (typeof window === "undefined") return "desktop-high";
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  if (!mobile) return "desktop-high";
  const nav = navigator as Navigator & { deviceMemory?: number };
  const constrained = (navigator.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return mobile || constrained || coarse ? "mobile-optimized" : "desktop-high";
}

export function useLamRenderQuality() {
  const [quality, setQuality] = useState<LamRenderQuality>("desktop-high");
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setQuality(detectQuality());
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return quality;
}

