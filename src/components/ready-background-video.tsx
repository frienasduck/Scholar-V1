"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

export const BACKGROUND_READY_EVENT = "scholar:background-ready";

interface ReadyBackgroundVideoProps {
  src: string;
  poster?: string;
  className?: string;
  style?: CSSProperties;
  objectPosition?: string;
  readinessId?: string;
}

export function ReadyBackgroundVideo({
  src,
  poster = "/backgrounds/scholar-poster.svg",
  className,
  style,
  objectPosition,
  readinessId = "page-background",
}: ReadyBackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(false);
  const [loadVideo, setLoadVideo] = useState(false);
  const reduceMotion = useStore(state => state.settings.reduceMotion);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const announcedRef = useRef(false);
  useEffect(() => { if (loadVideo) videoRef.current?.load(); }, [loadVideo, src]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const active = visibleRef.current && !document.hidden && !media.matches && !reduceMotion;
      if (active) { setLoadVideo(true); if (videoRef.current?.readyState && videoRef.current.readyState >= 2) void videoRef.current.play().catch(() => undefined); }
      else videoRef.current?.pause();
    };
    const observer = new IntersectionObserver(entries => { visibleRef.current = entries[0]?.isIntersecting ?? false; sync(); }, { rootMargin: "100px" });
    if (containerRef.current) observer.observe(containerRef.current);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { observer.disconnect(); media.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync); videoRef.current?.pause(); };
  }, [reduceMotion, src]);

  const announceReady = (status: "video" | "poster") => {
    if (announcedRef.current) return;
    announcedRef.current = true;
    window.dispatchEvent(new CustomEvent(BACKGROUND_READY_EVENT, {
      detail: { id: readinessId, status },
    }));
  };

  const activateVideo = async () => {
    const video = videoRef.current;
    if (!video || failed || !visibleRef.current || document.hidden || reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      await video.play();
      // The poster remains visible until the browser confirms actual playback.
    } catch {
      setFailed(true);
      announceReady("poster");
    }
  };

  const keepPoster = () => {
    setFailed(true);
    announceReady("poster");
  };

  return (
    <div ref={containerRef} className={cn("absolute inset-0 overflow-hidden", className)} style={style} aria-hidden="true">
      <img
        src={poster}
        alt=""
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
          ready ? "opacity-0" : "opacity-100",
        )}
        style={{ objectPosition }}
        onLoad={() => {
          announceReady("poster");
        }}
        onError={() => announceReady("poster")}
      />
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="metadata"
        poster={poster}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
          ready ? "opacity-100" : "opacity-0",
        )}
        style={{ objectPosition }}
        onLoadedData={() => void activateVideo()}
        onCanPlay={() => void activateVideo()}
        onPlaying={() => {
          setReady(true);
          announceReady("video");
        }}
        onError={keepPoster}
        onStalled={() => {
          if (!ready) announceReady("poster");
        }}
        onEmptied={() => setReady(false)}
      >
        {loadVideo && <source src={src} type="video/mp4" />}
      </video>
    </div>
  );
}
