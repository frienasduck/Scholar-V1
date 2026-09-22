"use client";

import { useEffect, useRef, useState } from "react";
import { LIVE_TUTOR_VIDEOS, type LiveTutorPersonality } from "@/lib/live-tutor/types";

type Layer = { personality: LiveTutorPersonality; key: number };

export function PersonalityBackground({ personality }: { personality: LiveTutorPersonality }) {
  const sequence = useRef(1);
  const [layers, setLayers] = useState<Layer[]>([{ personality, key: 0 }]);

  useEffect(() => {
    setLayers((current) => {
      if (current.at(-1)?.personality === personality) return current;
      sequence.current += 1;
      return [...current.slice(-1), { personality, key: sequence.current }];
    });
  }, [personality]);

  const reveal = (key: number) => {
    setLayers((current) => current.map((layer) => layer.key === key ? { ...layer, ready: true } as Layer & { ready: boolean } : layer));
    window.setTimeout(() => setLayers((current) => current.filter((layer) => layer.key === key || current.length === 1)), 720);
  };

  return (
    <div className="liveTutorVideoStack" aria-hidden="true">
      {layers.map((layer, index) => {
        const asset = LIVE_TUTOR_VIDEOS[layer.personality];
        const ready = Boolean((layer as Layer & { ready?: boolean }).ready) || layers.length === 1;
        return (
          <video
            key={layer.key}
            className={`liveTutorVideo ${ready && index === layers.length - 1 ? "isVisible" : ""}`}
            autoPlay
            muted
            loop
            playsInline
            preload={index === layers.length - 1 ? "auto" : "metadata"}
            poster={asset.poster}
            style={{ objectFit: asset.fit }}
            onCanPlay={() => reveal(layer.key)}
          >
            <source src={asset.src} type="video/mp4" />
          </video>
        );
      })}
    </div>
  );
}
