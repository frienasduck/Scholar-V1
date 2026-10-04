"use client";
import type { RefObject } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/** Only the source surface owns the iframe; the music controller never does. */
export function YouTubeSourceSurface({ surfaceRef, hostRef, expanded, blocked, onToggle }: {
  surfaceRef: RefObject<HTMLElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  expanded: boolean;
  blocked: boolean;
  onToggle: () => void;
}) {
  return <section ref={surfaceRef} data-study-music-source className={`sm-ui sm-source-surface ${expanded ? "sm-source-expanded" : ""}`} aria-label="YouTube source player">
    <div className="sm-source-heading"><span>YouTube source</span><button aria-expanded={expanded} onClick={onToggle}>{expanded ? <Minimize2 size={12}/> : <Maximize2 size={12}/>} {expanded ? "Minimize video" : "Show video"}</button></div>
    <div className="sm-youtube" ref={hostRef} aria-label="Official YouTube video player"/>
    {blocked && <p className="sm-source-note">Paused while tools are open.</p>}
  </section>;
}
