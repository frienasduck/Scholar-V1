"use client";

import { useEffect, useRef, useState } from "react";
import { SCHOLAR_SCENES, type ScholarScene } from "./personalization-presentation";

const SCENE_ORDER = Object.keys(SCHOLAR_SCENES) as ScholarScene[];

/** One active video, with other clips fetched only after explicit user intent. */
export function SceneBackdrop({ scene, requested, reduced, hidden }: { scene: ScholarScene; requested: ScholarScene[]; reduced: boolean; hidden: boolean }) {
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
    for (const name of SCENE_ORDER) {
      const video = videos.current[name];
      if (!video) continue;
      if (name === scene && ready[name] && !stillOnly && !hidden) {
        void video.play().catch(() => { /* Poster is the intentional fallback. */ });
      } else {
        video.pause();
      }
    }
  }, [scene, ready, stillOnly, hidden, requested]);

  return <div className="your-scholar-scene" aria-hidden="true" style={{ backgroundImage: `url("${SCHOLAR_SCENES[scene].poster}")` }}>
    {SCENE_ORDER.map((name) => requested.includes(name) && !stillOnly ? <video
      key={name}
      ref={(node) => { videos.current[name] = node; }}
      className="your-scholar-scene-video"
      data-scene={name}
      data-visible={name === scene && Boolean(ready[name])}
      src={SCHOLAR_SCENES[name].video}
      poster={SCHOLAR_SCENES[name].poster}
      autoPlay={name === "earth"}
      muted loop playsInline
      preload={name === scene ? "auto" : "metadata"}
      onCanPlay={() => setReady((current) => current[name] ? current : { ...current, [name]: true })}
      onError={() => setReady((current) => current[name] ? { ...current, [name]: false } : current)}
    /> : null)}
    <div className="your-scholar-scene-grade" />
    <div className="your-scholar-scene-grain" />
  </div>;
}
