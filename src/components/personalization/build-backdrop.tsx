"use client";

import { useEffect, useRef, useState } from "react";
import { BUILD_VIDEO } from "./personalization-presentation";

/** A single late-warmed video, retained through the reveal and released on exit. */
export function BuildBackdrop({ playing, reduced }: { playing: boolean; reduced: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    // Restore after React's development effect replay; release on real disposal.
    if (!element.hasAttribute("src")) element.src = BUILD_VIDEO;
    return () => { element.pause(); element.removeAttribute("src"); element.load(); };
  }, [reduced, failed]);
  useEffect(() => {
    const element = video.current;
    if (!element || reduced || failed) return;
    let alive = true;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (!playing || document.hidden || motion.matches) element.pause();
      else void element.play().catch(() => { if (alive) setFailed(true); });
    };
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    // Only chooses the visual fallback; never delays the actual build.
    const timer = playing ? setTimeout(() => { if (element.readyState < 2) setFailed(true); }, 2200) : undefined;
    sync();
    return () => {
      alive = false; clearTimeout(timer); element.pause();
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
    };
  }, [playing, reduced, failed]);
  return <div className="your-scholar-build-backdrop" data-video-ready={ready && !failed} data-video-fallback={reduced || failed} aria-hidden="true">
    <div className="your-scholar-build-fallback"><div /><span /></div>
    {!reduced && !failed ? <video ref={video} src={BUILD_VIDEO} muted loop playsInline autoPlay={playing} preload={playing ? "auto" : "metadata"} onLoadedData={() => setReady(true)} onError={() => setFailed(true)} /> : null}
    <div className="your-scholar-build-shade" />
  </div>;
}
