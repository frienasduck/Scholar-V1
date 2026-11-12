"use client";

import dynamic from "next/dynamic";
import { animate } from "animejs";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Download, Loader2 } from "lucide-react";
import { ClassicResourceLibrary } from "@/components/resources/classic-resource-library";
import { useWorkspaceMode } from "@/components/workspaces/workspace-tabs";
import { cn } from "@/lib/utils";
import type { ScholarWorkspaceId } from "@/lib/shrinking-scholar";

const WORKSPACE: ScholarWorkspaceId = "resources";

/** Downloads is a large, rarely-first view. Load its code only when opened. */
const DownloadsView = dynamic(
  () => import("@/components/views/downloads").then((module) => module.DownloadsView),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-[50vh] place-items-center bg-background" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your downloads…
        </div>
      </div>
    ),
  },
);

type ResourceTarget = { subjectId?: string; chapterId?: string; type?: string; q?: string; resourceId?: string } | null;

export function ResourcesView() {
  const { mode, select } = useWorkspaceMode(WORKSPACE, "library");
  const [target, setTarget] = useState<ResourceTarget>(null);
  const [downloadsVisited, setDownloadsVisited] = useState(mode === "downloads");
  const selectMode = (next: "library" | "downloads") => {
    if (next === "downloads") setDownloadsVisited(true);
    select(next);
  };
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const value = sessionStorage.getItem("scholar:resources:target");
        sessionStorage.removeItem("scholar:resources:target");
        if (value) setTarget(JSON.parse(value) as ResourceTarget);
      } catch { /* session storage is optional */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const indicator = indicatorRef.current;
    if (indicator) {
      if (reduce) {
        indicator.style.transform = mode === "downloads" ? "translateX(100%)" : "translateX(0%)";
      } else {
        animate(indicator, {
          translateX: mode === "downloads" ? "100%" : "0%",
          duration: 240,
          ease: "inOut(2)",
        });
      }
    }

    const track = trackRef.current;
    if (!track) return;
    const width = track.parentElement?.clientWidth ?? track.clientWidth / 2;
    if (reduce) {
      track.style.transform = mode === "downloads" ? `translateX(-${width}px)` : "translateX(0px)";
      return;
    }
    animate(track, {
      translateX: mode === "downloads" ? -width : 0,
      duration: 240,
      ease: "inOut(2)",
    });
  }, [mode]);

  return (
    <div className="flex min-h-[calc(var(--scholar-vvh,100dvh)-4rem)] flex-col bg-background" data-workspace={WORKSPACE}>
      <header className="scholar-workspace-header relative z-20 -mx-3 -mt-3 border-b border-border/50 bg-background/80 px-3 py-2.5 backdrop-blur-xl sm:-mx-4 sm:-mt-4 sm:px-4 lg:-mx-6 lg:-mt-6 lg:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden text-xs font-semibold tracking-tight text-muted-foreground sm:block">
            Resources
          </p>
          <div
            role="tablist"
            aria-label="Resources modes"
            className="relative inline-grid w-full sm:w-auto sm:min-w-[260px] grid-cols-2 rounded-2xl border border-border/60 bg-muted/35 p-1"
          >
            <span
              ref={indicatorRef}
              aria-hidden="true"
              className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-xl bg-background shadow-sm will-change-transform"
            />
            <button
              type="button"
              role="tab"
              aria-selected={mode === "library"}
              aria-controls="resources-library-panel"
              onClick={() => selectMode("library")}
              className={cn(
                "relative z-10 inline-flex min-h-11 sm:min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors sm:text-[13px]",
                mode === "library" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <BookOpen className="h-3.5 w-3.5" /> Library
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "downloads"}
              aria-controls="resources-downloads-panel"
              onClick={() => selectMode("downloads")}
              className={cn(
                "relative z-10 inline-flex min-h-11 sm:min-h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors sm:text-[13px]",
                mode === "downloads" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Download className="h-3.5 w-3.5" /> Downloads
            </button>
          </div>
        </div>
      </header>

      {/* Two full-width panels on one track. Downloads enters from the right;
          returning to Library slides the track back. Both stay mounted once
          visited so saved library state and download progress do not remount. */}
      <div className="min-w-0 flex-1 overflow-x-clip">
        <div ref={trackRef} className="flex w-[200%] will-change-transform">
          <section
            id="resources-library-panel"
            role="tabpanel"
            aria-label="Library"
            aria-hidden={mode !== "library"}
            inert={mode !== "library" ? true : undefined}
            className="w-1/2 min-w-0 shrink-0"
          >
            <ClassicResourceLibrary
              key={JSON.stringify(target)}
              subjectId={target?.subjectId}
              chapterId={target?.chapterId}
              type={target?.type}
              initialSearch={target?.q}
              initialResourceId={target?.resourceId}
            />
          </section>
          <section
            id="resources-downloads-panel"
            role="tabpanel"
            aria-label="Downloads"
            aria-hidden={mode !== "downloads"}
            inert={mode !== "downloads" ? true : undefined}
            className="w-1/2 min-w-0 shrink-0"
          >
            {downloadsVisited || mode === "downloads" ? <DownloadsView /> : null}
          </section>
        </div>
      </div>
    </div>
  );
}

export default ResourcesView;
