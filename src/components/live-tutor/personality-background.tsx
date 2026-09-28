"use client";

import { useEffect, useRef, useState } from "react";
import { LIVE_TUTOR_VIDEOS, type LiveTutorPersonality } from "@/lib/live-tutor/types";

type Layer = { personality: LiveTutorPersonality; key: number; ready?: boolean };

export function PersonalityBackground({ personality }: { personality: LiveTutorPersonality }) {
  const sequence = useRef(1);
  const revealTimers = useRef(new Map<number, number>());
  const loopTimers = useRef(new Map<number, number>());
  const [layers, setLayers] = useState<Layer[]>([{ personality, key: 0 }]);
  const [fading, setFading] = useState<number | null>(null);

  useEffect(() => () => {
    revealTimers.current.forEach((timer) => window.clearTimeout(timer));
    revealTimers.current.clear();
    loopTimers.current.forEach((timer) => window.clearTimeout(timer));
    loopTimers.current.clear();
  }, []);

  useEffect(() => {
    setLayers((current) => {
      if (current.at(-1)?.personality === personality) return current;
      sequence.current += 1;
      return [...current.slice(-1), { personality, key: sequence.current }];
    });
  }, [personality]);

  const reveal = (key: number) => {
    setLayers((current) => current.map((layer) => layer.key === key ? { ...layer, ready: true } : layer));
    const existing = revealTimers.current.get(key);
    if (existing !== undefined) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      revealTimers.current.delete(key);
      setLayers((current) => current.filter((layer) => layer.key === key || current.length === 1));
    }, 720);
    revealTimers.current.set(key, timer);
  };

  const restart = (key: number, video: HTMLVideoElement) => {
    setFading(key);
    const timer = window.setTimeout(() => {
      loopTimers.current.delete(key);
      video.currentTime = 0;
      void video.play().catch(() => undefined);
      setFading((current) => current === key ? null : current);
    }, 520);
    loopTimers.current.set(key, timer);
  };

  return (
    <div className="liveTutorVideoStack" aria-hidden="true">
      {layers.map((layer, index) => {
        const asset = LIVE_TUTOR_VIDEOS[layer.personality];
        const ready = Boolean(layer.ready) || layers.length === 1;
        return (
          <video
            key={layer.key}
            className={`liveTutorVideo ${ready && index === layers.length - 1 && fading !== layer.key ? "isVisible" : ""}`}
            autoPlay
            muted
            playsInline
            preload={index === layers.length - 1 ? "auto" : "metadata"}
            poster={asset.poster}
            style={{ objectFit: asset.fit }}
            onCanPlay={() => reveal(layer.key)}
            onEnded={(event) => restart(layer.key, event.currentTarget)}
          >
            <source src={asset.src} type="video/mp4" />
          </video>
        );
      })}
    </div>
  );
}
