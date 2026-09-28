"use client";

import { useEffect, useRef, useState } from "react";
import { SCHOLAR_SCENES, SCHOLAR_SCENE_ORDER, nextScholarScene, type ScholarScene } from "./personalization-presentation";

const SCENE_INTERVAL_MS = 9000;

/** Auto-cycles three muted clips. Only the active and imminent videos are fetched. */
export function SceneBackdrop({ reduced, hidden }: { reduced: boolean; hidden: boolean }) {
  const [scene, setScene] = useState<ScholarScene>("earth");
  const [requested, setRequested] = useState<ScholarScene[]>(["earth", "venus"]);
  const [ready, setReady] = useState<Partial<Record<ScholarScene, boolean>>>({});
  const [systemReduced, setSystemReduced] = useState(false);
  const videos = useRef<Partial<Record<ScholarScene, HTMLVideoElement | null>>>({});
  const stillOnly = reduced || systemReduced;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSystemReduced(preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (stillOnly || hidden) return;
    const timer = window.setInterval(() => {
      setRequested((loaded) => loaded.includes("mars") ? loaded : [...loaded, "mars"]);
      setScene((current) => nextScholarScene(current));
    }, SCENE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [stillOnly, hidden]);

  useEffect(() => {
    for (const name of SCHOLAR_SCENE_ORDER) {
      const video = videos.current[name];
      if (!video) continue;
      if (name === scene && ready[name] && !stillOnly && !hidden) {
        void video.play().catch(() => { /* Poster is the intentional fallback. */ });
      } else {
        video.pause();
      }
    }
  }, [scene, ready, stillOnly, hidden, requested]);

  return <div className="your-scholar-scene" aria-hidden="true" data-scene={scene}>
    {SCHOLAR_SCENE_ORDER.map((name) => requested.includes(name) ? <div
      key={name}
      className="your-scholar-scene-layer"
      data-scene={name}
      data-active={scene === name}
      style={{ backgroundImage: `url("${SCHOLAR_SCENES[name].poster}")` }}
    >{!stillOnly ? <video
      key={name}
      ref={(node) => { videos.current[name] = node; }}
      className="your-scholar-scene-video"
      data-scene={name}
      data-visible={Boolean(ready[name])}
      src={SCHOLAR_SCENES[name].video}
      poster={SCHOLAR_SCENES[name].poster}
      autoPlay={name === "earth"}
      muted loop playsInline
      preload={name === scene ? "auto" : "metadata"}
      onCanPlay={() => setReady((current) => current[name] ? current : { ...current, [name]: true })}
      onError={() => setReady((current) => current[name] ? { ...current, [name]: false } : current)}
    /> : null}</div> : null)}
    <div className="your-scholar-scene-grade" />
    <div className="your-scholar-scene-grain" />
  </div>;
}
