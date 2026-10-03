"use client";
import { memo, useEffect, useRef, useState } from "react";
import { LIVE_TUTOR_VIDEOS, type LiveTutorPersonality } from "@/lib/live-tutor/types";
import { ReadyVideoBackground } from "@/components/ready-video-background";
export const PersonalityBackground = memo(function PersonalityBackground({ personality }: { personality: LiveTutorPersonality }) {
  const [layers, setLayers] = useState([personality]);
  if (layers.at(-1) !== personality) setLayers(current => [...current.slice(-1), personality]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (timer.current) clearTimeout(timer.current); const fallback = setTimeout(() => setLayers(current => current.at(-1) === personality ? [personality] : current), 8000); return () => clearTimeout(fallback); }, [personality]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <div className="liveTutorVideoStack" aria-hidden="true" style={{ background: "radial-gradient(ellipse at 65% 20%, #293547, #080d16 80%)" }}>{layers.map(layer => <ReadyVideoBackground key={layer} src={LIVE_TUTOR_VIDEOS[layer].src} fit={LIVE_TUTOR_VIDEOS[layer].fit} className="liveTutorVideo" onReady={() => { if (layer !== personality) return; timer.current = setTimeout(() => setLayers(current => current.at(-1) === layer ? [layer] : current), 560); }} />)}</div>;
});
