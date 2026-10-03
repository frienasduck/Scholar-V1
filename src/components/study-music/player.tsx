"use client";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ListMusic, SlidersHorizontal, X, ChevronDown, Maximize2, GripHorizontal, Repeat, Shuffle, Loader2, Headphones } from "lucide-react";
import { useMusicStore } from "@/lib/music-store";
import { loadYouTubeAPI, youtubeVideoRequest, type YouTubePlayer, type YouTubeWindow } from "@/lib/study-music/youtube-player";
import { clampPosition, normalizePosition, restorePosition, snapPosition, type Bounds, type Position } from "@/lib/study-music/position";
import { formatTime, trackName } from "@/lib/study-music/model";
import { MusicLibraryRuntime } from "./library-runtime";
import { MusicDrawers } from "./tools";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { MUSIC_PROMO_MESSAGE, MUSIC_PROMO_WINDOW_MS, shouldRunMusicPromo, openScholarPlus } from "@/lib/subscriptions/promo";
import { speakReminder, stopTalkSpeech } from "@/lib/reminders/talk";
import { ambienceEngine } from "@/lib/study-music/ambience";
import "./study-music.css";

const openMusic = () => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "music" } }));
function PlayerProgress() {
  const { time, duration, radio } = useMusicStore(useShallow(s => ({ time: s.currentTime, duration: s.duration, radio: s.currentTrack?.tags?.includes("radio") })));
  return <div className="sm-progress"><input aria-label="Seek music" type="range" min={0} max={duration || 1} step={1} value={Math.min(time, duration || 1)} disabled={!duration} onChange={e => useMusicStore.getState().seekTo(Number(e.target.value))} /><div><span>{radio ? "LIVE" : formatTime(time)}</span><span>{duration ? formatTime(duration) : radio ? "Live radio" : "Duration unknown"}</span></div></div>;
}
function PlayerButtons() {
  const { playing, volume, muted, repeat, shuffle, buffering } = useMusicStore(useShallow(s => ({ playing: s.isPlaying, volume: s.volume, muted: s.muted, repeat: s.repeatMode, shuffle: s.shuffle, buffering: s.buffering })));
  const s = useMusicStore.getState();
  return <>
    <div className="sm-player-buttons">
      <button className="sm-icon" aria-label="Shuffle" aria-pressed={shuffle} onClick={s.toggleShuffle}><Shuffle size={17}/></button>
      <button className="sm-icon" aria-label="Previous track" onClick={s.prev}><SkipBack size={19}/></button>
      <button className="sm-play" aria-label={playing ? "Pause music" : "Play music"} onClick={s.togglePlay}>{buffering ? <Loader2 className="sm-spin" size={21}/> : playing ? <Pause size={21}/> : <Play size={21}/>}</button>
      <button className="sm-icon" aria-label="Next track" onClick={() => s.next()}><SkipForward size={19}/></button>
      <button className="sm-icon" aria-label={`Repeat: ${repeat}`} aria-pressed={repeat !== "off"} onClick={() => s.setRepeatMode(repeat === "off" ? "all" : repeat === "all" ? "one" : "off")}><Repeat size={17}/>{repeat === "one" && <sup>1</sup>}</button>
      <button className="sm-icon" aria-label="Open queue" onClick={() => s.setDrawer("queue")}><ListMusic size={19}/></button>
    </div>
    <div className="sm-volume"><button className="sm-icon" aria-label={muted ? "Unmute music" : "Mute music"} onClick={s.toggleMute}>{muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}</button><input aria-label="Music volume" type="range" min={0} max={100} value={volume} onChange={e => s.setVolume(Number(e.target.value))}/><button className="sm-icon" aria-label="Ambience mixer" onClick={() => s.setDrawer("mixer")}><SlidersHorizontal size={17}/></button></div>
  </>;
}

export function StudyMusicPlayer({ currentView }: { currentView?: string }) {
  const { track, visible, minimized, expanded, owner, position, ambience, ambienceEnabled } = useMusicStore(useShallow(s => ({ track: s.currentTrack, visible: s.widgetVisible, minimized: s.widgetMinimized, expanded: s.widgetExpanded, owner: s.owner, position: s.widgetPosition, ambience: s.ambience, ambienceEnabled: s.ambienceEnabled })));
  const error = useMusicStore(s => s.error), playing = useMusicStore(s => s.isPlaying), playNonce = useMusicStore(s => s.playNonce), seek = useMusicStore(s => s.seekRequest);
  const volume = useMusicStore(s => s.volume), muted = useMusicStore(s => s.muted);
  const box = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null), player = useRef<YouTubePlayer | null>(null);
  const [ready, setReady] = useState(false), [retry, setRetry] = useState(0), [promo, setPromo] = useState(false), [docked, setDocked] = useState(false);
  const loadedId = useRef(""), promoRef = useRef(false), approved = useRef(false), lastOwner = useRef(owner);
  const awaitingPlayback = useRef(false);
  const dragging = useRef<{ start: Position; initial: Position; pointer: number } | null>(null), xy = useRef<Position>({ x: 0, y: 0 }), raf = useRef(0);
  const access = useScholarAccess();
  const accessLoaded = access.entitlementsLoaded === true, adFree = accessLoaded && access.has("study_music_ad_free");
  const bounds = useCallback((): Bounds => ({ width: box.current?.offsetWidth ?? 356, height: box.current?.offsetHeight ?? 400, viewportWidth: window.innerWidth, viewportHeight: window.visualViewport?.height ?? window.innerHeight, bottomInset: window.innerWidth < 640 ? 90 : 20 }), []);

  useEffect(() => {
    ambienceEngine.update(ambience, ambienceEnabled);
  }, [ambience, ambienceEnabled]);

  // Persisted playback is cued, never automatically played with sound.
  useEffect(() => {
    if (lastOwner.current !== owner) { player.current?.pauseVideo(); loadedId.current = ""; approved.current = false; lastOwner.current = owner; }
  }, [owner]);
  useEffect(() => {
    if (!track || !playing || !accessLoaded || approved.current) return;
    let shown = false; try { shown = sessionStorage.getItem("scholar:study-music-promo") === "1"; } catch { /* Private storage may be disabled. */ }
    approved.current = true;
    if (!shouldRunMusicPromo({ loaded: true, adFree, alreadyShown: shown })) return;
    promoRef.current = true; player.current?.pauseVideo();
    const display = setTimeout(() => setPromo(true), 0);
    try { sessionStorage.setItem("scholar:study-music-promo", "1"); } catch { /* Session-only eligibility still held in memory. */ }
    speakReminder(MUSIC_PROMO_MESSAGE);
    const timer = setTimeout(() => { stopTalkSpeech(); promoRef.current = false; setPromo(false); const s = useMusicStore.getState(); if (s.isPlaying && !document.hidden) player.current?.playVideo(); }, MUSIC_PROMO_WINDOW_MS);
    return () => { clearTimeout(display); clearTimeout(timer); stopTalkSpeech(); promoRef.current = false; setPromo(false); };
  }, [!!track, playing, accessLoaded, adFree, owner]);

  const hasTrack = !!track;
  useEffect(() => {
    if (!hasTrack || !host.current) return;
    let disposed = false;
    const mount = host.current;
    void loadYouTubeAPI().then(() => {
      if (disposed || !mount.isConnected) return;
      const state = useMusicStore.getState(); if (!state.currentTrack) return;
      const initial = youtubeVideoRequest(state.currentTrack.id, state.currentTrack.tags?.includes("radio") ? 0 : state.currentTime);
      loadedId.current = initial.videoId;
      awaitingPlayback.current = state.isPlaying;
      const element = document.createElement("div"); mount.replaceChildren(element);
      const w = window as YouTubeWindow;
      player.current = new w.YT!.Player(element, {
        videoId: initial.videoId, width: "100%", height: "100%", playerVars: { autoplay: 0, start: initial.startSeconds, controls: 1, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady(event) { if (disposed) return; player.current = event.target; setReady(true); },
          onStateChange(event) {
            if (disposed) return;
            const s = useMusicStore.getState(); s.setBuffering(event.data === 3);
            if (event.data === 1) {
              awaitingPlayback.current = false;
              if (document.hidden || !s.widgetVisible || promoRef.current) { player.current?.pauseVideo(); return; }
              s.setError(null); s.setPlaying(true);
            }
            // Loading/cueing emits pause events before the requested playback starts.
            if (event.data === 2 && !promoRef.current && !awaitingPlayback.current) s.setPlaying(false);
            if (event.data === 0) s.next(true);
          },
          onError(event) { if (!disposed) useMusicStore.getState().setError([101, 150].includes(event.data) ? "This creator does not allow embedded playback. Open on YouTube or choose another track." : event.data === 153 ? "YouTube could not verify this browser's embed identity. Try your regular browser or open on YouTube." : `YouTube playback error ${event.data}. Retry, choose another track, or open on YouTube.`); },
        },
      });
    }).catch(err => { if (!disposed) useMusicStore.getState().setError(err.message); });
    const poll = setInterval(() => {
      if (!player.current || document.hidden) return;
      try { const s = useMusicStore.getState(); const duration = s.currentTrack?.tags?.includes("radio") ? 0 : player.current.getDuration(); s.setDuration(duration); if (s.isPlaying) s.setCurrentTime(duration > 0 && duration <= 604800 ? player.current.getCurrentTime() : 0); } catch { /* Iframe may still be initializing. */ }
    }, 1000);
    const hide = () => { if (document.hidden) { player.current?.pauseVideo(); useMusicStore.getState().setPlaying(false); } };
    document.addEventListener("visibilitychange", hide);
    return () => { disposed = true; clearInterval(poll); document.removeEventListener("visibilitychange", hide); player.current?.destroy(); player.current = null; loadedId.current = ""; setReady(false); mount.replaceChildren(); };
  }, [hasTrack, retry]);

  useEffect(() => {
    const p = player.current, s = useMusicStore.getState(); if (!ready || !p || !s.currentTrack) return;
    if (loadedId.current !== s.currentTrack.id) {
      loadedId.current = s.currentTrack.id;
      const request = youtubeVideoRequest(s.currentTrack.id, s.currentTrack.tags?.includes("radio") ? 0 : s.currentTime);
      awaitingPlayback.current = s.isPlaying;
      if (s.isPlaying && !promoRef.current && !document.hidden) p.loadVideoById(request);
      else p.cueVideoById(request);
    } else if (s.currentTime === 0 && s.isPlaying && playNonce) p.seekTo(0, true);
    if (s.isPlaying && !promoRef.current && !document.hidden) { awaitingPlayback.current = true; p.playVideo(); } else p.pauseVideo();
  }, [ready, track?.id, playNonce]);
  useEffect(() => { if (!ready || !player.current) return; awaitingPlayback.current = playing; if (playing && !promoRef.current && !document.hidden) player.current.playVideo(); else player.current.pauseVideo(); }, [playing, ready]);
  useEffect(() => { if (ready && player.current) { player.current.setVolume(volume); if (muted) player.current.mute(); else player.current.unMute(); } }, [volume, muted, ready]);
  useEffect(() => { if (ready && player.current && seek.nonce) player.current.seekTo(seek.time, true); }, [seek, ready]);

  const layout = useCallback(() => {
    if (!box.current || dragging.current) return;
    const dock = currentView === "music" && !minimized ? document.querySelector<HTMLElement>("[data-study-music-dock]") : null;
    const rect = dock?.getBoundingClientRect(), viewport = window.visualViewport?.height ?? window.innerHeight;
    const isDock = !!rect && rect.top >= 64 && rect.bottom <= viewport - 8;
    setDocked(isDock);
    if (isDock && rect) {
      box.current.style.width = `${rect.width}px`; box.current.style.left = `${rect.left}px`; box.current.style.top = `${rect.top}px`; box.current.style.transform = "none";
    } else {
      box.current.style.width = `${Math.min(window.innerWidth - 16, expanded && !minimized ? 460 : 356)}px`;
      const pos = window.innerWidth < 640 ? restorePosition({ x: .5, y: 1 }, bounds()) : restorePosition(position, bounds()); xy.current = pos;
      box.current.style.left = "0px"; box.current.style.top = "0px"; box.current.style.transform = `translate3d(${pos.x}px,${pos.y}px,0)`;
    }
  }, [currentView, minimized, expanded, position, bounds]);
  useEffect(() => {
    const initial = requestAnimationFrame(layout);
    const resize = new ResizeObserver(layout); if (box.current) resize.observe(box.current);
    window.addEventListener("resize", layout); window.addEventListener("scroll", layout, true); window.visualViewport?.addEventListener("resize", layout);
    return () => { cancelAnimationFrame(initial); cancelAnimationFrame(raf.current); resize.disconnect(); window.removeEventListener("resize", layout); window.removeEventListener("scroll", layout, true); window.visualViewport?.removeEventListener("resize", layout); };
  }, [layout, visible, track]);

  const keyboard = (event: KeyboardEvent) => {
    if (event.defaultPrevented || (event.target as HTMLElement).closest("input,textarea,select,a,[contenteditable=true]")) return;
    const s = useMusicStore.getState();
    if (event.key === " " && !(event.target as HTMLElement).closest("button")) { event.preventDefault(); s.togglePlay(); }
    if (event.key.toLowerCase() === "m") s.toggleMute();
    if (event.key.toLowerCase() === "n") s.next();
    if (event.key.toLowerCase() === "p") s.prev();
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); s.seekTo(s.currentTime + (event.key === "ArrowRight" ? 10 : -10)); }
  };
  return <>
    <MusicLibraryRuntime/>
    <MusicDrawers/>
    <div ref={box} data-study-music-player className={`sm-floating ${docked ? "sm-docked" : ""} ${minimized ? "sm-pill" : ""}`} hidden={!track || !visible} tabIndex={0} role="region" aria-label="Study Music player" onKeyDown={keyboard}>
      <div className="sm-player-header">
        <button className="sm-drag sm-icon" disabled={docked} aria-label="Move player. Use arrow keys to choose a corner." title="Drag to move · arrow keys choose a corner"
          onKeyDown={e => { if (!e.key.startsWith("Arrow")) return; e.preventDefault(); useMusicStore.getState().setWidgetPosition({ x: e.key === "ArrowLeft" ? 0 : e.key === "ArrowRight" ? 1 : position.x, y: e.key === "ArrowUp" ? 0 : e.key === "ArrowDown" ? 1 : position.y }); }}
          onPointerDown={e => { if (docked || window.innerWidth < 640) return; e.currentTarget.setPointerCapture(e.pointerId); dragging.current = { start: { x: e.clientX, y: e.clientY }, initial: xy.current, pointer: e.pointerId }; box.current!.style.transition = "none"; }}
          onPointerMove={e => { const d = dragging.current; if (!d) return; xy.current = clampPosition({ x: d.initial.x + e.clientX - d.start.x, y: d.initial.y + e.clientY - d.start.y }, bounds()); cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(() => { if (box.current) box.current.style.transform = `translate3d(${xy.current.x}px,${xy.current.y}px,0)`; }); }}
          onPointerUp={e => { if (!dragging.current) return; cancelAnimationFrame(raf.current); dragging.current = null; e.currentTarget.releasePointerCapture(e.pointerId); box.current!.style.transition = ""; useMusicStore.getState().setWidgetPosition(normalizePosition(snapPosition(xy.current, bounds()), bounds())); }}
          onPointerCancel={() => { dragging.current = null; if (box.current) box.current.style.transition = ""; layout(); }}><GripHorizontal size={17}/></button>
        <button className="sm-player-title" onClick={minimized ? useMusicStore.getState().toggleMinimize : openMusic}><small>STUDY MUSIC</small><strong>{track ? trackName(track) : "Study Music"}</strong><span>{track?.artist}</span></button>
        <div className={`sm-wave ${playing ? "sm-wave-playing" : ""}`} aria-hidden="true"><i/><i/><i/><i/></div>
        {minimized && <button className="sm-icon" aria-label={playing ? "Pause music" : "Play music"} onClick={useMusicStore.getState().togglePlay}>{playing ? <Pause size={18}/> : <Play size={18}/>}</button>}
        <button className="sm-icon" aria-label={minimized ? "Expand player" : "Minimize player controls"} onClick={useMusicStore.getState().toggleMinimize}><ChevronDown size={17}/></button>
        <button className="sm-icon" aria-label="Close music player" onClick={useMusicStore.getState().closeWidget}><X size={17}/></button>
      </div>
      <div className="sm-youtube" ref={host} aria-label="Official YouTube video player"/>
      {!minimized && <div className="sm-player-body">
        {promo && <div className="sm-promo" role="status">A short Scholar promotion · <button onClick={() => openScholarPlus({ source: "study-music-ad" })}>Explore Plus</button><small>Plus removes Scholar promotions, not YouTube ads.</small></div>}
        {error && <div className="sm-error" role="alert">{error}<div><button onClick={() => { useMusicStore.getState().setError(null); setRetry(v => v + 1); }}>Retry</button> · <a href={`https://www.youtube.com/watch?v=${track?.id}`} target="_blank" rel="noopener noreferrer">Open on YouTube</a></div></div>}
        <PlayerProgress/><PlayerButtons/>
        <div className="sm-player-footer"><button onClick={openMusic}>Full workspace</button><button aria-label="Change player size" onClick={useMusicStore.getState().toggleExpand}><Maximize2 size={14}/> {expanded ? "Compact" : "Expand"}</button></div>
      </div>}
    </div>
  </>;
}
export function StudyMusicQuickAccess() {
  const focus = useMusicStore(s => s.focus);
  return <button className="sm-quick-access" aria-label="Study Music quick controls" title={focus ? "Music & active focus session" : "Study Music"} onClick={() => useMusicStore.getState().setDrawer("quick")}><Headphones size={18}/>{focus && focus.phase !== "complete" && <span className="sm-status-dot"/>}</button>;
}
