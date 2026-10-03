"use client";
import { memo, useEffect, useRef, useState } from "react";

/** One decoder, no frame-driven React updates, no filters over the video. */
export const ReadyVideoBackground = memo(function ReadyVideoBackground(props: { src: string; className?: string; fit?: "cover" | "contain" | "fill"; onReady?: () => void }) {
  return <VideoLayer key={props.src} {...props} />;
});
function VideoLayer({ src, className = "absolute inset-0 h-full w-full object-cover pointer-events-none", fit = "cover", onReady }: { src: string; className?: string; fit?: "cover" | "contain" | "fill"; onReady?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const callback = useRef(onReady);
  const revealed = useRef(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => { callback.current = onReady; }, [onReady]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { if (document.hidden || motion.matches) video.pause(); else void video.play().catch(() => undefined); };
    document.addEventListener("visibilitychange", sync); motion.addEventListener("change", sync); sync();
    return () => { document.removeEventListener("visibilitychange", sync); motion.removeEventListener("change", sync); if (timer.current) clearTimeout(timer.current); if (frame.current !== null) video.cancelVideoFrameCallback?.(frame.current); video.pause(); };
  }, [src]);
  const reveal = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const show = () => { frame.current = null; setVisible(true); if (!revealed.current) { revealed.current = true; callback.current?.(); } };
    if (video.requestVideoFrameCallback && !video.paused) { if (frame.current !== null) video.cancelVideoFrameCallback(frame.current); frame.current = video.requestVideoFrameCallback(show); }
    else show();
  };
  return <video ref={videoRef} src={src} muted playsInline autoPlay preload="metadata" aria-hidden="true" className={className} poster="/backgrounds/scholar-poster.svg" style={{ objectFit: fit, opacity: visible ? 1 : 0, transition: "opacity 520ms ease", pointerEvents: "none" }} onLoadedData={reveal} onPlaying={reveal} onError={() => setVisible(false)} onEnded={() => {
    setVisible(false);
    timer.current = setTimeout(() => { const video = videoRef.current; if (!video || document.hidden) return; video.currentTime = 0; void video.play().catch(() => undefined); }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 520);
  }} />;
}
