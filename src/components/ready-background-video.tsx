"use client";

import { useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

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
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const announceReady = (status: "video" | "poster") => {
    window.dispatchEvent(new CustomEvent(BACKGROUND_READY_EVENT, {
      detail: { id: readinessId, status },
    }));
  };

  const activateVideo = async () => {
    const video = videoRef.current;
    if (!video || ready || failed) return;
    try {
      await video.play();
      setReady(true);
      announceReady("video");
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
    <div className={cn("absolute inset-0 overflow-hidden", className)} style={style} aria-hidden="true">
      <img
        src={poster}
        alt=""
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
          ready ? "opacity-0" : "opacity-100",
        )}
        style={{ objectPosition }}
        onLoad={() => {
          if (failed) announceReady("poster");
        }}
      />
      <video
        ref={videoRef}
        muted
        autoPlay
        loop
        playsInline
        preload="auto"
        poster={poster}
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
          ready ? "opacity-100" : "opacity-0",
        )}
        style={{ objectPosition }}
        onLoadedData={() => void activateVideo()}
        onCanPlay={() => void activateVideo()}
        onError={keepPoster}
      >
        <source src={src} type="video/mp4" />
      </video>
    </div>
  );
}
