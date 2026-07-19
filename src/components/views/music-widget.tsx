"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X,
  Minimize2, Maximize2, Repeat, Repeat1, Shuffle, Music as MusicIcon,
  AlertCircle, Loader2,
} from "lucide-react";
import { useMusicStore } from "@/lib/music-store";
import { cn } from "@/lib/utils";

// YouTube IFrame API singleton
let ytPlayer: any = null;
let ytReady = false;
let ytApiLoading = false;

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (ytReady) { resolve(); return; }
    if (ytApiLoading) {
      const check = setInterval(() => { if (ytReady) { clearInterval(check); resolve(); } }, 200);
      return;
    }
    ytApiLoading = true;
    if (typeof window === "undefined") { resolve(); return; }
    (window as any).onYouTubeIframeAPIReady = () => { ytReady = true; resolve(); };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
}

function fmtTime(s: number): string {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ============================================================================
// Floating Music Widget — liquid glass mini-player
// ============================================================================

export function FloatingMusicWidget() {
  const {
    currentTrack, isPlaying, currentTime, duration, volume, muted,
    widgetVisible, widgetMinimized, widgetExpanded, widgetPosition,
    repeatMode, shuffle, buffering, error,
    togglePlay, setPlaying, setCurrentTime, setDuration,
    setVolume, toggleMute, next, prev, stop, closeWidget,
    toggleMinimize, toggleExpand, setWidgetPosition,
    setRepeatMode, toggleShuffle, setBuffering, setError, seekTo,
  } = useMusicStore();

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; dragging: boolean }>({
    startX: 0, startY: 0, origX: 0, origY: 0, dragging: false,
  });
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: -1, y: -1 };
    try {
      const saved = localStorage.getItem("scholar-music-widget-pos");
      return saved ? JSON.parse(saved) : { x: -1, y: -1 };
    } catch {
      return { x: -1, y: -1 };
    }
  });
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Save position
  useEffect(() => {
    if (pos.x >= 0) {
      try { localStorage.setItem("scholar-music-widget-pos", JSON.stringify(pos)); } catch { /* ignore */ }
    }
  }, [pos]);

  // Initialize YouTube player when a track is loaded
  useEffect(() => {
    if (!currentTrack || !widgetVisible) return;

    let cancelled = false;
    loadYouTubeAPI().then(() => {
      if (cancelled || !playerContainerRef.current) return;

      // Create or update player
      if (!ytPlayer) {
        ytPlayer = new (window as any).YT.Player("scholar-yt-player", {
          videoId: currentTrack.id,
          playerVars: { autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1 },
          events: {
            onReady: () => {
              ytPlayer.setVolume(muted ? 0 : volume);
              setDuration(ytPlayer.getDuration() || 0);
            },
            onStateChange: (e: any) => {
              const YT = (window as any).YT;
              if (e.data === YT.PlayerState.PLAYING) { setPlaying(true); setBuffering(false); setDuration(ytPlayer.getDuration() || 0); }
              else if (e.data === YT.PlayerState.PAUSED) { setPlaying(false); }
              else if (e.data === YT.PlayerState.BUFFERING) { setBuffering(true); }
              else if (e.data === YT.PlayerState.ENDED) { setBuffering(false); next(); }
              else if (e.data === YT.PlayerState.ERROR) { setError("Playback error"); }
            },
          },
        });
      } else {
        // Load new video
        ytPlayer.loadVideoById(currentTrack.id);
        ytPlayer.playVideo();
      }
    });

    return () => { cancelled = true; };
  }, [currentTrack?.id]);

  // Sync play/pause
  useEffect(() => {
    if (!ytPlayer || !ytReady || !currentTrack) return;
    if (isPlaying) ytPlayer.playVideo();
    else ytPlayer.pauseVideo();
  }, [isPlaying]);

  // Sync volume
  useEffect(() => {
    if (!ytPlayer || !ytReady) return;
    ytPlayer.setVolume(muted ? 0 : volume);
  }, [volume, muted]);

  // Progress tracking
  useEffect(() => {
    if (isPlaying && ytPlayer && ytReady) {
      progressIntervalRef.current = setInterval(() => {
        try {
          setCurrentTime(ytPlayer.getCurrentTime() || 0);
          const d = ytPlayer.getDuration() || 0;
          if (d) setDuration(d);
        } catch { /* ignore */ }
      }, 1000);
    }
    return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
  }, [isPlaying]);

  // Handle seek
  const handleSeek = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!ytPlayer || !ytReady) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const pct = (clientX - rect.left) / rect.width;
    const newTime = pct * duration;
    ytPlayer.seekTo(newTime, true);
    seekTo(newTime);
  }, [duration, seekTo]);

  // Dragging
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Don't drag if clicking on a button or slider
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("[data-no-drag]")) return;
    // Only drag if originating from the drag handle
    if (!target.closest("[data-drag-handle]")) return;

    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const currentPos = pos.x >= 0 ? pos : getDefaultPosition();
    dragRef.current = { startX: clientX, startY: clientY, origX: currentPos.x, origY: currentPos.y, dragging: true };
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragRef.current.dragging) return;
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    let newX = dragRef.current.origX + dx;
    let newY = dragRef.current.origY + dy;

    // Clamp to viewport
    const widgetW = widgetExpanded ? 360 : 340;
    const widgetH = widgetMinimized ? 56 : widgetExpanded ? 400 : 84;
    newX = Math.max(8, Math.min(window.innerWidth - widgetW - 8, newX));
    newY = Math.max(8, Math.min(window.innerHeight - widgetH - 8, newY));
    setPos({ x: newX, y: newY });
  };

  const handleDragEnd = () => {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    // Snap to nearest edge
    const widgetW = 340;
    const midX = window.innerWidth / 2;
    let snappedX = pos.x;
    if (pos.x + widgetW / 2 < midX) snappedX = 16;
    else snappedX = window.innerWidth - widgetW - 16;
    setPos({ x: snappedX, y: pos.y });
  };

  function getDefaultPosition(): { x: number; y: number } {
    const isMobile = window.innerWidth < 1024;
    const widgetW = 340;
    if (isMobile) {
      // On mobile, position above bottom navigation with safe area
      const bottomNavHeight = 72;
      const safeArea = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--safe-area-bottom") || "0", 10);
      return { x: 12, y: window.innerHeight - 120 - bottomNavHeight - safeArea };
    }
    return { x: window.innerWidth - widgetW - 20, y: window.innerHeight - 120 };
  }

  // Calculate actual position
  const actualPos = pos.x >= 0 ? pos : (typeof window !== "undefined" ? getDefaultPosition() : { x: 20, y: 20 });
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  if (!widgetVisible || !currentTrack) return null;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{
        position: "fixed",
        left: isMobile ? "12px" : `${actualPos.x}px`,
        right: isMobile ? "12px" : "auto",
        top: isMobile ? "auto" : `${actualPos.y}px`,
        bottom: isMobile ? `calc(72px + var(--safe-area-bottom))` : "auto",
        zIndex: 35,
        touchAction: "pan-y",
      }}
    >
      {/* Hidden YouTube player container */}
      <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
        <div ref={playerContainerRef} id="scholar-yt-player" />
      </div>

      {/* Drag handle — only this area initiates drag */}
      <div
        data-drag-handle
        style={{ touchAction: "none", cursor: "grab" }}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        {/* Minimized capsule */}
      {widgetMinimized ? (
        <div
          className="rounded-full overflow-hidden border border-white/15"
          style={{
            background: "rgba(15, 15, 20, 0.75)",
            backdropFilter: "blur(30px) saturate(1.5)",
            WebkitBackdropFilter: "blur(30px) saturate(1.5)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.1)",
          }}
        >
          <div className="flex items-center gap-2 p-2 pr-3">
            <div className="relative h-10 w-10 rounded-full overflow-hidden shrink-0">
              <img src={currentTrack.thumbnail} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              {isPlaying && (
                <div className="absolute inset-0 grid place-items-center bg-black/30">
                  <div className="flex gap-0.5 items-end h-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="w-0.5 bg-white rounded-full" animate={{ height: [3, 10, 3] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }} style={{ height: 3 }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-1.5 text-white/90 hover:text-white" aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); toggleMinimize(); }} className="p-1.5 text-white/50 hover:text-white" aria-label="Expand">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Normal / Expanded widget */
        <div
          className={cn("rounded-2xl overflow-hidden border border-white/15")}
          style={{
            width: isMobile ? "100%" : (widgetExpanded ? "340px" : "340px"),
            background: "rgba(15, 15, 20, 0.72)",
            backdropFilter: "blur(30px) saturate(1.5)",
            WebkitBackdropFilter: "blur(30px) saturate(1.5)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.12)",
          }}
        >
          {/* Compact mode */}
          {!widgetExpanded ? (
            <div className="p-2.5">
              <div className="flex items-center gap-2.5">
                {/* Thumbnail */}
                <div className="relative h-12 w-12 rounded-lg overflow-hidden shrink-0">
                  <img src={currentTrack.thumbnail} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
                  {buffering && <div className="absolute inset-0 grid place-items-center bg-black/40"><Loader2 className="h-4 w-4 text-white animate-spin" /></div>}
                </div>

                {/* Title + progress */}
                <div className="flex-1 min-w-0" data-no-drag>
                  <p className="text-xs font-medium text-white truncate leading-tight">{currentTrack.title}</p>
                  <p className="text-[10px] text-white/40 truncate">{currentTrack.artist}</p>
                  {/* Progress bar */}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[9px] text-white/40 font-mono shrink-0">{fmtTime(currentTime)}</span>
                    <div
                      className="flex-1 h-1 rounded-full bg-white/10 cursor-pointer"
                      onClick={handleSeek}
                    >
                      <div className="h-full rounded-full bg-white/60" style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="text-[9px] text-white/40 font-mono shrink-0">{fmtTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-0.5 shrink-0" data-no-drag>
                  <button onClick={(e) => { e.stopPropagation(); prev(); }} className="p-1.5 text-white/60 hover:text-white transition-colors" aria-label="Previous">
                    <SkipBack className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" aria-label={isPlaying ? "Pause" : "Play"}>
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); next(); }} className="p-1.5 text-white/60 hover:text-white transition-colors" aria-label="Next">
                    <SkipForward className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Expand + close */}
                <div className="flex items-center gap-0.5 shrink-0" data-no-drag>
                  <button onClick={(e) => { e.stopPropagation(); toggleExpand(); }} className="p-1.5 text-white/40 hover:text-white transition-colors" aria-label="Expand">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); closeWidget(); }} className="p-1.5 text-white/40 hover:text-rose-300 transition-colors" aria-label="Close">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Expanded mode */
            <div className="p-3 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Now Playing</span>
                <div className="flex items-center gap-0.5" data-no-drag>
                  <button onClick={(e) => { e.stopPropagation(); toggleExpand(); }} className="p-1.5 text-white/40 hover:text-white" aria-label="Collapse">
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); toggleMinimize(); }} className="p-1.5 text-white/40 hover:text-white" aria-label="Minimize">
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); closeWidget(); }} className="p-1.5 text-white/40 hover:text-rose-300" aria-label="Close">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Large artwork */}
              <div className="relative aspect-square rounded-xl overflow-hidden mx-auto max-w-[180px]">
                <img src={currentTrack.thumbnail} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }} />
                {buffering && <div className="absolute inset-0 grid place-items-center bg-black/40"><Loader2 className="h-6 w-6 text-white animate-spin" /></div>}
                {isPlaying && (
                  <div className="absolute bottom-2 right-2 flex gap-0.5 items-end h-4">
                    {[0, 1, 2, 3].map((i) => (
                      <motion.span key={i} className="w-1 bg-white/80 rounded-full" animate={{ height: [3, 14, 3] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }} style={{ height: 3 }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="text-center">
                <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
                <p className="text-xs text-white/40 truncate">{currentTrack.artist}</p>
              </div>

              {/* Progress */}
              <div data-no-drag>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 font-mono">{fmtTime(currentTime)}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 cursor-pointer" onClick={handleSeek}>
                    <div className="h-full rounded-full bg-white/60 relative" style={{ width: `${progressPct}%` }}>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-md" />
                    </div>
                  </div>
                  <span className="text-[10px] text-white/40 font-mono">{fmtTime(duration)}</span>
                </div>
              </div>

              {/* Main controls */}
              <div className="flex items-center justify-center gap-3" data-no-drag>
                <button onClick={(e) => { e.stopPropagation(); toggleShuffle(); }} className={cn("p-2 transition-colors", shuffle ? "text-white" : "text-white/40 hover:text-white")} aria-label="Shuffle">
                  <Shuffle className="h-4 w-4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); prev(); }} className="p-2 text-white/80 hover:text-white" aria-label="Previous">
                  <SkipBack className="h-5 w-5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-3 rounded-full bg-white/15 hover:bg-white/25 text-white" aria-label={isPlaying ? "Pause" : "Play"}>
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); next(); }} className="p-2 text-white/80 hover:text-white" aria-label="Next">
                  <SkipForward className="h-5 w-5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off"); }} className={cn("p-2 transition-colors", repeatMode !== "off" ? "text-white" : "text-white/40 hover:text-white")} aria-label="Repeat">
                  {repeatMode === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2" data-no-drag>
                <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="p-1 text-white/50 hover:text-white" aria-label="Mute">
                  {muted || volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <input
                  type="range" min={0} max={100} value={muted ? 0 : volume}
                  onChange={(e) => { e.stopPropagation(); setVolume(Number(e.target.value)); }}
                  className="flex-1 accent-white h-1"
                  style={{ height: 4 }}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button onClick={(e) => { e.stopPropagation(); next(); }} className="text-rose-300 hover:text-white">Skip</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </motion.div>
  );
}
