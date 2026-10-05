"use client";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ListMusic, SlidersHorizontal, X, ChevronDown, Maximize2, GripHorizontal, Repeat, Shuffle, Loader2, Headphones, Heart } from "lucide-react";
import { useMusicStore, suspendStudyMusic } from "@/lib/music-store";
import { loadYouTubeAPI, youtubeVideoRequest, type YouTubePlayer, type YouTubeWindow } from "@/lib/study-music/youtube-player";
import { clampPosition, normalizePosition, snapPosition, type Bounds, type Position } from "@/lib/study-music/position";
import { formatTime, trackName } from "@/lib/study-music/model";
import { MusicLibraryRuntime } from "./library-runtime";
import { MusicDrawers } from "./tools";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { MUSIC_PROMO_MESSAGE, MUSIC_PROMO_WINDOW_MS, shouldRunMusicPromo, openScholarPlus } from "@/lib/subscriptions/promo";
import { speakReminder, stopTalkSpeech } from "@/lib/reminders/talk";
import { ambienceEngine } from "@/lib/study-music/ambience";
import { sourcePlaybackAllowed } from "@/lib/study-music/source-visibility";
import { NativeAudioPlayer } from "./native-player";
import { MusicThumbnail } from "./thumbnail";
import { YouTubeSourceSurface } from "./source-surface";
import { musicControllerPosition, youtubeSourcePosition, youtubeSourceSize, type PlayerRect } from "@/lib/study-music/player-layout";
import "./study-music.css";

const openMusic = () => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "music" } }));
function PlayerProgress() {
  const { time, duration, radio, native } = useMusicStore(useShallow(s => ({ time: s.currentTime, duration: s.duration, radio: s.currentTrack?.tags?.includes("radio"), native: s.currentTrack?.mediaSource === "AUDIO_SOURCE" })));
  return <div className="sm-progress"><input aria-label="Seek music" type="range" min={0} max={duration || 1} step={.1} value={Math.min(time, duration || 1)} disabled={!duration} onChange={e => useMusicStore.getState().seekTo(Number(e.target.value))} /><div><span>{radio ? "LIVE" : formatTime(time)}</span><span>{native ? "Continuous sound loop" : duration ? formatTime(duration) : radio ? "Live radio" : "Duration unknown"}</span></div></div>;
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
function MiniProgress() {
  const progress = useMusicStore(s => s.duration > 0 ? Math.min(100, s.currentTime / s.duration * 100) : 0);
  return <div className="sm-mini-progress" aria-hidden="true"><i style={{ width: `${progress}%` }}/></div>;
}
function PlayerFocus() {
  const focus = useMusicStore(s => s.focus);
  return focus && focus.phase !== "complete" ? <button className="sm-controller-focus" onClick={() => useMusicStore.getState().setDrawer("quick")}>Focus · {formatTime(focus.remaining)}{focus.paused ? " · paused" : ""}</button> : null;
}
function HeaderPlaybackIcon({ playing }: { playing: boolean }) {
  const buffering = useMusicStore(s => s.buffering);
  return buffering ? <Loader2 size={18} className="sm-spin"/> : playing ? <Pause size={18}/> : <Play size={18}/>;
}

export function StudyMusicPlayer({ currentView }: { currentView?: string }) {
  const access = useScholarAccess();
  const allowed = access.has("study_music_ad_free");
  useEffect(() => {
    if (!allowed) { suspendStudyMusic(); void ambienceEngine.destroy(); }
    return () => { void ambienceEngine.destroy(); };
  }, [allowed]);
  return allowed ? <StudyMusicRuntime currentView={currentView}/> : null;
}
function StudyMusicRuntime({ currentView }: { currentView?: string }) {
  const { track, visible, minimized, expanded, owner, position, ambience, ambienceEnabled } = useMusicStore(useShallow(s => ({ track: s.currentTrack, visible: s.widgetVisible, minimized: s.widgetMinimized, expanded: s.widgetExpanded, owner: s.owner, position: s.widgetPosition, ambience: s.ambience, ambienceEnabled: s.ambienceEnabled })));
  const error = useMusicStore(s => s.error), playing = useMusicStore(s => s.isPlaying), playNonce = useMusicStore(s => s.playNonce), seek = useMusicStore(s => s.seekRequest);
  const volume = useMusicStore(s => s.volume), muted = useMusicStore(s => s.muted);
  const drawer = useMusicStore(s => s.drawer), favorite = useMusicStore(s => !!s.currentTrack && s.library.favorites.includes(s.currentTrack.id));
  const box = useRef<HTMLDivElement>(null), sourceBox = useRef<HTMLElement>(null), host = useRef<HTMLDivElement>(null), player = useRef<YouTubePlayer | null>(null);
  const [ready, setReady] = useState(false), [retry, setRetry] = useState(0), [promo, setPromo] = useState(false), [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const loadedId = useRef(""), promoRef = useRef(false), approved = useRef(false), lastOwner = useRef(owner);
  const awaitingPlayback = useRef(false);
  const dragging = useRef<{ start: Position; initial: Position; pointer: number } | null>(null), xy = useRef<Position>({ x: 0, y: 0 }), raf = useRef(0);
  const access = useScholarAccess();
  const accessLoaded = access.entitlementsLoaded === true, adFree = accessLoaded && access.has("study_music_ad_free");
  const youtube = track?.mediaSource === "YOUTUBE_VIDEO_SOURCE";
  const blocked = !!drawer || modalOpen;
  const canPlaySource = useCallback(() => {
    const element = host.current;
    if (!element || document.hidden || !useMusicStore.getState().widgetVisible) return false;
    const rect = element.getBoundingClientRect();
    const points = [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]];
    const unobscured = points.every(([x, y]) => {
      const hit = document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y);
      return !!hit && (hit === element || element.contains(hit));
    });
    return sourcePlaybackAllowed(rect, { width: window.innerWidth, height: window.innerHeight }, unobscured);
  }, []);
  const bounds = useCallback((): Bounds => ({ width: box.current?.offsetWidth ?? 356, height: box.current?.offsetHeight ?? 240, viewportWidth: window.innerWidth, viewportHeight: window.visualViewport?.height ?? window.innerHeight, bottomInset: window.innerWidth < 768 ? 80 : 16 }), []);

  useEffect(() => {
    ambienceEngine.update(ambience, ambienceEnabled);
  }, [ambience, ambienceEnabled]);

  // Persisted playback is cued, never automatically played with sound.
  useEffect(() => {
    if (lastOwner.current !== owner) { player.current?.pauseVideo(); loadedId.current = ""; approved.current = false; lastOwner.current = owner; }
  }, [owner]);
  useEffect(() => {
    if (!youtube || !playing || !accessLoaded || approved.current) return;
    let shown = false; try { shown = sessionStorage.getItem("scholar:study-music-promo") === "1"; } catch { /* Private storage may be disabled. */ }
    approved.current = true;
    if (!shouldRunMusicPromo({ loaded: true, adFree, alreadyShown: shown })) return;
    promoRef.current = true; player.current?.pauseVideo();
    const display = setTimeout(() => setPromo(true), 0);
    try { sessionStorage.setItem("scholar:study-music-promo", "1"); } catch { /* Session-only eligibility still held in memory. */ }
    speakReminder(MUSIC_PROMO_MESSAGE);
    const timer = setTimeout(() => { stopTalkSpeech(); promoRef.current = false; setPromo(false); const s = useMusicStore.getState(); if (s.isPlaying && canPlaySource()) player.current?.playVideo(); }, MUSIC_PROMO_WINDOW_MS);
    return () => { clearTimeout(display); clearTimeout(timer); stopTalkSpeech(); promoRef.current = false; setPromo(false); };
  }, [youtube, playing, accessLoaded, adFree, owner, canPlaySource]);

  // Tools and other application dialogs must never cover an active source player.
  // Detach the paused embed while a modal is open, then restore it cued, not autoplaying.
  useEffect(() => {
    const inspect = () => {
      const open = !!document.querySelector('[role="dialog"][data-state="open"], [role="dialog"][aria-modal="true"]');
      if (open && useMusicStore.getState().currentTrack?.mediaSource === "YOUTUBE_VIDEO_SOURCE") {
        player.current?.pauseVideo(); useMusicStore.getState().setPlaying(false);
      }
      setModalOpen(open);
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "aria-modal"] });
    inspect(); return () => observer.disconnect();
  }, []);

  const hasTrack = !!youtube && visible && !blocked;
  useEffect(() => {
    if (!hasTrack || !host.current) return;
    let disposed = false;
    const mount = host.current;
    void loadYouTubeAPI().then(() => {
      if (disposed || !mount.isConnected) return;
      const state = useMusicStore.getState(); if (state.currentTrack?.mediaSource !== "YOUTUBE_VIDEO_SOURCE") return;
      const initial = youtubeVideoRequest(state.currentTrack.id, state.currentTrack.tags?.includes("radio") ? 0 : state.currentTime);
      loadedId.current = initial.videoId;
      awaitingPlayback.current = state.isPlaying;
      const element = document.createElement("div"); mount.replaceChildren(element);
      const w = window as YouTubeWindow;
      player.current = new w.YT!.Player(element, {
        videoId: initial.videoId, width: "100%", height: "100%", playerVars: { autoplay: 0, start: initial.startSeconds, controls: 0, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady(event) { if (disposed) return; player.current = event.target; setReady(true); },
          onAutoplayBlocked() { const s = useMusicStore.getState(); if (!disposed && s.isPlaying && s.currentTrack?.mediaSource === "YOUTUBE_VIDEO_SOURCE") s.setError("Your browser requires a playback gesture. Press Play in the YouTube source player to allow sound."); },
          onStateChange(event) {
            if (disposed) return;
            const s = useMusicStore.getState();
            // Late iframe events cannot stop or advance a newly selected audio source.
            if (s.currentTrack?.mediaSource !== "YOUTUBE_VIDEO_SOURCE" || s.currentTrack.id !== loadedId.current) return;
            s.setBuffering(event.data === 3);
            if (event.data === 1) {
              awaitingPlayback.current = false;
              if (!canPlaySource() || promoRef.current) { player.current?.pauseVideo(); s.setPlaying(false); return; }
              s.setError(null); s.setPlaying(true);
            }
            // Loading/cueing emits pause events before the requested playback starts.
            if (event.data === 2 && !promoRef.current && !awaitingPlayback.current) s.setPlaying(false);
            if (event.data === 0) s.next(true);
          },
          onError(event) { const current = useMusicStore.getState().currentTrack; if (!disposed && current?.mediaSource === "YOUTUBE_VIDEO_SOURCE" && current.id === loadedId.current) useMusicStore.getState().setError([101, 150].includes(event.data) ? "This creator does not allow embedded playback. Open on YouTube or choose another track." : event.data === 153 ? "YouTube could not verify this browser's embed identity. Try your regular browser or open on YouTube." : `YouTube playback error ${event.data}. Retry, choose another track, or open on YouTube.`); },
        },
      });
    }).catch(err => { if (!disposed) useMusicStore.getState().setError(err.message); });
    const poll = setInterval(() => {
      if (!player.current || document.hidden) return;
      try { const s = useMusicStore.getState(); const duration = s.currentTrack?.tags?.includes("radio") ? 0 : player.current.getDuration(); s.setDuration(duration); if (s.isPlaying) s.setCurrentTime(duration > 0 && duration <= 604800 ? player.current.getCurrentTime() : 0); } catch { /* Iframe may still be initializing. */ }
    }, 1000);
    const visibility = setInterval(() => {
      if (player.current && useMusicStore.getState().isPlaying && !promoRef.current && !canPlaySource()) {
        player.current.pauseVideo(); useMusicStore.getState().setPlaying(false);
      }
    }, 250);
    const hide = () => { if (document.hidden) { player.current?.pauseVideo(); useMusicStore.getState().setPlaying(false); } };
    document.addEventListener("visibilitychange", hide);
    return () => { disposed = true; clearInterval(poll); clearInterval(visibility); document.removeEventListener("visibilitychange", hide); if (mount.isConnected) player.current?.pauseVideo(); player.current?.destroy(); player.current = null; loadedId.current = ""; setReady(false); mount.replaceChildren(); };
  }, [hasTrack, retry, canPlaySource]);

  useEffect(() => {
    const p = player.current, s = useMusicStore.getState(); if (!ready || !p || s.currentTrack?.mediaSource !== "YOUTUBE_VIDEO_SOURCE") return;
    if (loadedId.current !== s.currentTrack.id) {
      loadedId.current = s.currentTrack.id;
      const request = youtubeVideoRequest(s.currentTrack.id, s.currentTrack.tags?.includes("radio") ? 0 : s.currentTime);
      awaitingPlayback.current = s.isPlaying;
      if (s.isPlaying && !promoRef.current && canPlaySource()) p.loadVideoById(request);
      else p.cueVideoById(request);
    } else if (s.currentTime === 0 && s.isPlaying && playNonce) p.seekTo(0, true);
    if (s.isPlaying && !promoRef.current && canPlaySource()) { awaitingPlayback.current = true; p.playVideo(); } else p.pauseVideo();
  }, [ready, track?.id, playNonce, canPlaySource]);
  useEffect(() => { if (!ready || !player.current) return; awaitingPlayback.current = playing; if (playing && !promoRef.current && canPlaySource()) player.current.playVideo(); else { player.current.pauseVideo(); if (playing && !promoRef.current) useMusicStore.getState().setPlaying(false); } }, [playing, ready, canPlaySource]);
  useEffect(() => { if (ready && player.current) { player.current.setVolume(volume); if (muted) player.current.mute(); else player.current.unMute(); } }, [volume, muted, ready]);
  useEffect(() => { if (ready && player.current && seek.nonce) player.current.seekTo(seek.time, true); }, [seek, ready]);

  const placeSource = useCallback((controller: PlayerRect) => {
    if (!sourceBox.current || !host.current) return;
    const viewport = { width: window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight, contentLeft: document.querySelector("#main-scroll")?.getBoundingClientRect().left ?? 0 };
    const size = youtubeSourceSize(viewport, controller.height, expanded);
    sourceBox.current.style.width = `${size.width}px`; host.current.style.height = `${size.videoHeight}px`;
    const pos = youtubeSourcePosition({ width: size.width, height: sourceBox.current.offsetHeight }, viewport, controller, expanded);
    sourceBox.current.style.left = `${pos.x}px`; sourceBox.current.style.top = `${pos.y}px`;
  }, [expanded]);
  const layout = useCallback(() => {
    if (!box.current || dragging.current) return;
    const viewport = { width: window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight };
    const shortWide = viewport.height < 620 && viewport.width >= 560;
    const width = Math.min(viewport.width - 16, viewport.width < 768 && !shortWide ? viewport.width - 16 : 356);
    box.current.style.width = `${width}px`;
    const size = { width, height: box.current.offsetHeight };
    const pos = musicControllerPosition(size, viewport, position, expanded); xy.current = pos;
    box.current.style.left = "0px"; box.current.style.top = "0px"; box.current.style.transform = `translate3d(${pos.x}px,${pos.y}px,0)`;
    placeSource({ ...pos, ...size });
  }, [expanded, position, placeSource]);
  useEffect(() => {
    const initial = requestAnimationFrame(layout);
    const resize = new ResizeObserver(layout); if (box.current) resize.observe(box.current); if (sourceBox.current) resize.observe(sourceBox.current);
    window.addEventListener("resize", layout); window.addEventListener("scroll", layout, true); window.visualViewport?.addEventListener("resize", layout);
    return () => { cancelAnimationFrame(initial); cancelAnimationFrame(raf.current); resize.disconnect(); window.removeEventListener("resize", layout); window.removeEventListener("scroll", layout, true); window.visualViewport?.removeEventListener("resize", layout); };
  }, [layout, visible, track, currentView]);
  useEffect(() => {
    const open = () => { setMobileDetailsOpen(true); if (useMusicStore.getState().widgetMinimized) useMusicStore.getState().toggleMinimize(); };
    window.addEventListener("scholar:music-controls", open);
    return () => window.removeEventListener("scholar:music-controls", open);
  }, []);
  const toggleControls = () => {
    if (window.innerWidth < 768) { setMobileDetailsOpen(v => !v); if (minimized) useMusicStore.getState().toggleMinimize(); }
    else useMusicStore.getState().toggleMinimize();
  };

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
    <NativeAudioPlayer/>
    <MusicDrawers/>
    <div ref={box} data-study-music-player className={`sm-floating sm-controller ${minimized ? "sm-pill" : ""} ${mobileDetailsOpen ? "sm-controller-open" : ""} ${playing ? "sm-controller-playing" : ""}`} hidden={!track || !visible} tabIndex={0} role="region" aria-label="Study Music player" onKeyDown={keyboard}>
      <div className="sm-player-header">
        <button className="sm-drag sm-icon" aria-label="Move player. Use arrow keys to choose a corner." title="Drag to move · arrow keys choose a corner"
          onKeyDown={e => { if (!e.key.startsWith("Arrow")) return; e.preventDefault(); useMusicStore.getState().setWidgetPosition({ x: e.key === "ArrowLeft" ? 0 : e.key === "ArrowRight" ? 1 : position.x, y: e.key === "ArrowUp" ? 0 : e.key === "ArrowDown" ? 1 : position.y }); }}
          onPointerDown={e => { if (window.innerWidth < 768) return; e.currentTarget.setPointerCapture(e.pointerId); dragging.current = { start: { x: e.clientX, y: e.clientY }, initial: xy.current, pointer: e.pointerId }; box.current!.style.transition = "none"; }}
          onPointerMove={e => { const d = dragging.current; if (!d) return; const b = bounds(); xy.current = clampPosition({ x: d.initial.x + e.clientX - d.start.x, y: d.initial.y + e.clientY - d.start.y }, b); xy.current.y = Math.max(72, xy.current.y); cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(() => { if (box.current) { box.current.style.transform = `translate3d(${xy.current.x}px,${xy.current.y}px,0)`; placeSource({ ...xy.current, width: b.width, height: b.height }); } }); }}
          onPointerUp={e => { if (!dragging.current) return; cancelAnimationFrame(raf.current); dragging.current = null; e.currentTarget.releasePointerCapture(e.pointerId); box.current!.style.transition = ""; useMusicStore.getState().setWidgetPosition(normalizePosition(snapPosition(xy.current, bounds()), bounds())); }}
          onPointerCancel={() => { dragging.current = null; if (box.current) box.current.style.transition = ""; layout(); }}><GripHorizontal size={17}/></button>
        {track && <div className="sm-player-art"><MusicThumbnail track={track}/></div>}
        <button className="sm-player-title" onClick={() => { if (window.innerWidth < 768) toggleControls(); else if (minimized) useMusicStore.getState().toggleMinimize(); else openMusic(); }}><small>NOW LISTENING</small><strong>{track ? trackName(track) : "Study Music"}</strong><span>{track?.artist}</span></button>
        <div className={`sm-wave ${playing ? "sm-wave-playing" : ""}`} aria-hidden="true"><i/><i/><i/><i/></div>
        <button className={`sm-icon sm-header-play ${minimized ? "sm-pill-play" : ""}`} aria-label={playing ? "Pause music" : "Play music"} onClick={useMusicStore.getState().togglePlay}><HeaderPlaybackIcon playing={playing}/></button>
        <button className="sm-icon sm-header-next" aria-label="Next track" onClick={() => useMusicStore.getState().next()}><SkipForward size={17}/></button>
        <button className="sm-icon sm-toggle-controls" aria-label={minimized ? "Expand player" : "Toggle music controls"} onClick={toggleControls}><ChevronDown size={17}/></button>
        <button className="sm-icon" aria-label="Close music player" onClick={useMusicStore.getState().closeWidget}><X size={17}/></button>
      </div>
      {!minimized && <div className="sm-player-body">
        {promo && <div className="sm-promo" role="status">A short Scholar promotion · <button onClick={() => openScholarPlus({ source: "study-music-ad" })}>Explore Plus</button><small>Plus removes Scholar promotions, not YouTube ads.</small></div>}
        {error && <div className="sm-error" role="alert">{error}<div><button onClick={() => { const s = useMusicStore.getState(); s.setError(null); setRetry(v => v + 1); s.setPlaying(true); }}>Retry</button>{youtube && <> · <a href={`https://www.youtube.com/watch?v=${track?.id}`} target="_blank" rel="noopener noreferrer">Open on YouTube</a></>}</div></div>}
        <div className="sm-listening-meta"><span>{youtube ? "YouTube source" : "Scholar-native audio"}</span><button className="sm-icon" aria-label="Favorite current track" aria-pressed={favorite} onClick={() => track && useMusicStore.getState().favorite(track.id)}><Heart size={17} fill={favorite ? "currentColor" : "none"}/></button></div>
        <PlayerProgress/><PlayerButtons/>
        <div className="sm-player-footer"><button onClick={openMusic}>Music workspace</button>{youtube ? <button onClick={useMusicStore.getState().toggleExpand}><Maximize2 size={11}/>{expanded ? "Minimize video" : "Show video"}</button> : <button onClick={() => useMusicStore.getState().setDrawer("quick")}>Focus & tools</button>}</div>
        <PlayerFocus/>
      </div>}
      <MiniProgress/>
    </div>
    {youtube && visible && <YouTubeSourceSurface surfaceRef={sourceBox} hostRef={host} expanded={expanded} blocked={blocked} onToggle={useMusicStore.getState().toggleExpand}/>}
  </>;
}
export function StudyMusicQuickAccess() {
  const access = useScholarAccess();
  const focus = useMusicStore(s => s.focus);
  const allowed = access.has("study_music_ad_free");
  return <button className="sm-quick-access" aria-label="Study Music quick controls" title={allowed ? focus ? "Music & active focus session" : "Study Music" : "Study Music · Scholar Plus"} onClick={() => allowed ? useMusicStore.getState().setDrawer("quick") : openMusic()}><Headphones size={18}/>{allowed && focus && focus.phase !== "complete" && <span className="sm-status-dot"/>}</button>;
}
