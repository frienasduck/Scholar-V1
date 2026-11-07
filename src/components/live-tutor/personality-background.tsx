"use client";
import { memo, useEffect, useRef, useState } from "react";
import { DEFAULT_LAM_WALLPAPER, type LiveTutorPersonality } from "@/lib/live-tutor/types";
import { ReadyVideoBackground } from "@/components/ready-video-background";

export const PersonalityBackground = memo(function PersonalityBackground({
  src,
  personality,
}: {
  src?: string;
  personality?: LiveTutorPersonality;
}) {
  const currentSrc = src || DEFAULT_LAM_WALLPAPER.src;
  const [layers, setLayers] = useState([currentSrc]);
  if (layers.at(-1) !== currentSrc) setLayers((current) => [...current.slice(-1), currentSrc]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const fallback = setTimeout(() => setLayers((current) => (current.at(-1) === currentSrc ? [currentSrc] : current)), 8000);
    return () => clearTimeout(fallback);
  }, [currentSrc]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div className="liveTutorVideoStack" aria-hidden="true" style={{ background: "radial-gradient(ellipse at 65% 20%, #151d28, #05080f 80%)" }}>
      {layers.map((layer) => (
        <ReadyVideoBackground
          key={layer}
          src={layer}
          fit="cover"
          className="liveTutorVideo"
          onReady={() => {
            if (layer !== currentSrc) return;
            timer.current = setTimeout(() => setLayers((current) => (current.at(-1) === layer ? [layer] : current)), 560);
          }}
        />
      ))}
    </div>
  );
});
