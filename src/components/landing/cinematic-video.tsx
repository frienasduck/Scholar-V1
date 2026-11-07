"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, Pause, Play, RotateCcw } from "lucide-react";
import styles from "./cinematic-video.module.css";

/** The hero listens to this event so it does not compete with a product film. */
export const CINEMATIC_PLAYBACK_EVENT = "scholar:cinematic-playback";
export type CinematicPlaybackDetail = { id: string; active: boolean };

type MediaState = "poster" | "loading" | "playing" | "paused" | "blocked" | "error";
type Preference = "checking" | "none" | "motion" | "data";
type DataConnection = EventTarget & { saveData?: boolean };
type VideoNavigator = Navigator & { connection?: DataConnection };
type PlaybackOwner = { id: string; stop: () => void };

// Client-side media ownership, not server/request state. Only one showcase keeps
// an attached source when it claims playback; the previous one releases its decoder.
let owner: PlaybackOwner | null = null;

function announce(id: string, active: boolean) {
  window.dispatchEvent(new CustomEvent<CinematicPlaybackDetail>(CINEMATIC_PLAYBACK_EVENT, { detail: { id, active } }));
}

function claimPlayback(id: string, stop: () => void) {
  if (owner?.id === id) return;
  owner?.stop();
  owner = { id, stop };
  announce(id, true);
}

function releasePlayback(id: string) {
  if (owner?.id !== id) return;
  owner = null;
  announce(id, false);
}

export interface CinematicVideoProps {
  title: string;
  description: string;
  mp4: string;
  webm?: string;
  poster: string;
  provenance: string;
  features?: readonly string[];
  paused?: boolean;
}

/** Real media only. A poster is never reported as successful video playback. */
export function CinematicVideo({ title, description, mp4, webm, poster, provenance, features = [], paused = false }: CinematicVideoProps) {
  const id = useId();
  const frameRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLProgressElement>(null);
  const runRef = useRef(false);
  const playAttemptRef = useRef(0);
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [ambientPaused, setAmbientPaused] = useState(false);
  const [preference, setPreference] = useState<Preference>("checking");
  const [explicitPlay, setExplicitPlay] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [sourceMounted, setSourceMounted] = useState(false);
  const [state, setState] = useState<MediaState>("poster");
  const [retry, setRetry] = useState(0);
  const failedRef = useRef(false);
  const replayRef = useRef(false);

  const stop = useCallback(() => {
    playAttemptRef.current += 1;
    videoRef.current?.pause();
    setSourceMounted(false);
    setState(current => current === "error" ? current : "paused");
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const data = window.matchMedia("(prefers-reduced-data: reduce)");
    const connection = (navigator as VideoNavigator).connection;
    const syncPreferences = () => setPreference(connection?.saveData || data.matches ? "data" : motion.matches ? "motion" : "none");
    const syncHidden = () => setHidden(document.hidden);
    const journey = frame.closest<HTMLElement>("[data-motion]");
    const syncAmbient = () => setAmbientPaused(journey?.dataset.motion === "paused");
    syncPreferences();
    syncHidden();
    syncAmbient();
    motion.addEventListener("change", syncPreferences);
    data.addEventListener("change", syncPreferences);
    connection?.addEventListener("change", syncPreferences);
    document.addEventListener("visibilitychange", syncHidden);
    const ambientObserver = journey ? new MutationObserver(syncAmbient) : null;
    ambientObserver?.observe(journey!, { attributes: true, attributeFilter: ["data-motion"] });
    const approach = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => setNear(entries[0]?.isIntersecting ?? false), { rootMargin: "250px" }) : null;
    const visibility = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
      const entry = entries[0];
      setInView(Boolean(entry?.isIntersecting && entry.intersectionRatio >= .15));
    }, { threshold: [0, .15, .5] }) : null;
    approach?.observe(frame);
    visibility?.observe(frame);
    // Without visibility APIs, prefer the poster until the person explicitly plays.
    if (!approach || !visibility) { setNear(true); setInView(true); setPreference("motion"); }
    return () => {
      approach?.disconnect();
      visibility?.disconnect();
      ambientObserver?.disconnect();
      motion.removeEventListener("change", syncPreferences);
      data.removeEventListener("change", syncPreferences);
      connection?.removeEventListener("change", syncPreferences);
      document.removeEventListener("visibilitychange", syncHidden);
      playAttemptRef.current += 1;
      videoRef.current?.pause();
      releasePlayback(id);
    };
  }, [id]);

  const shouldRun = near && inView && !hidden && !paused && !ambientPaused && !userPaused && (preference === "none" || explicitPlay);
  runRef.current = shouldRun;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!shouldRun || failedRef.current) {
      video.pause();
      releasePlayback(id);
      if (!inView || hidden) setSourceMounted(false);
      return;
    }
    claimPlayback(id, stop);
    setState("loading");
    setSourceMounted(true);
  }, [shouldRun, inView, hidden, id, retry, stop]);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !runRef.current || failedRef.current || owner?.id !== id) return;
    const attempt = ++playAttemptRef.current;
    if (replayRef.current && video.readyState > 0) {
      video.currentTime = 0;
      replayRef.current = false;
    }
    try {
      await video.play();
    } catch (error) {
      if (attempt !== playAttemptRef.current || !runRef.current) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState(error instanceof DOMException && error.name === "NotAllowedError" ? "blocked" : "error");
      failedRef.current = true;
      releasePlayback(id);
    }
  }, [id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // load() after the source tree changes also releases the network/decoder when
    // it is removed. preload=none prevents distant/offscreen source requests.
    video.load();
  }, [sourceMounted, mp4, webm]);

  useEffect(() => {
    if (shouldRun && sourceMounted && !failedRef.current) {
      claimPlayback(id, stop);
      void play();
    }
  }, [shouldRun, sourceMounted, id, retry, play, stop]);

  function requestPlay(replay = false) {
    failedRef.current = false;
    replayRef.current = replay;
    setExplicitPlay(true);
    setUserPaused(false);
    setRetry(value => value + 1);
    if (sourceMounted && runRef.current) {
      claimPlayback(id, stop);
      void play();
    }
  }

  function pause() {
    setUserPaused(true);
    videoRef.current?.pause();
    setState("paused");
    releasePlayback(id);
  }

  const globallyPaused = paused || ambientPaused;
  const posterReason = globallyPaused ? "Ambient motion is paused." : preference === "data" && !explicitPlay ? "Data-saving preference: video waits for your choice." : preference === "motion" && !explicitPlay ? "Reduced motion: video waits for your choice." : "Muted cinematic product film.";
  const status = globallyPaused ? "Ambient motion is paused. Resume it above to play." : state === "playing" ? "Playing · muted" : state === "loading" ? "Loading video…" : state === "blocked" ? "Autoplay was blocked. Press play to watch." : state === "error" ? "The video could not be loaded. The poster is not playback." : state === "paused" ? "Video paused." : posterReason;
  const showPlay = state !== "playing" && state !== "loading";

  return <figure ref={frameRef} className={styles.film} data-cinematic-video="true" data-media-state={state} data-source-attached={sourceMounted}>
    <div className={styles.screen}>
      <video
        ref={videoRef}
        id={`${id}-video`}
        width={1920}
        height={1080}
        aria-label={`${title} — silent product film`}
        aria-describedby={`${id}-description`}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        className={styles.video}
        onCanPlay={() => void play()}
        onPlaying={() => {
          if (!runRef.current || owner?.id !== id) { videoRef.current?.pause(); return; }
          setState("playing");
        }}
        onPause={() => setState(current => current === "playing" || current === "loading" ? "paused" : current)}
        onWaiting={() => { if (runRef.current && !failedRef.current) setState("loading"); }}
        onError={() => {
          if (!sourceMounted) return;
          failedRef.current = true;
          setState("error");
          releasePlayback(id);
        }}
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (progressRef.current && video?.duration && Number.isFinite(video.duration)) progressRef.current.value = video.currentTime / video.duration;
        }}
      >
        {sourceMounted ? <>
          {webm ? <source src={webm} type="video/webm" /> : null}
          <source src={mp4} type="video/mp4" />
        </> : null}
        Your browser does not support this video. Read the description below for the product-film sequence.
      </video>
      <div className={styles.topline}><span>THE SCHOLAR FILMS</span><span>01 · LAM</span></div>
      <div className={styles.overlay}><span>Inside the intelligent classroom</span><div>{features.map(feature => <span key={feature}>{feature}</span>)}</div></div>
      {showPlay ? <button type="button" className={styles.centerPlay} aria-label={`${state === "error" ? "Retry" : "Watch"} ${title} film`} aria-controls={`${id}-video`} disabled={globallyPaused || hidden} onClick={() => requestPlay()}><Play size={22} aria-hidden="true" /><span>{state === "error" ? "Retry video" : "Watch the film"}</span></button> : null}
      {state === "loading" ? <span className={styles.loading} aria-hidden="true"><LoaderCircle size={28} /></span> : null}
    </div>
    <div className={styles.transport}>
      <div className={styles.buttons}>
        <button type="button" aria-label={state === "playing" ? `Pause ${title} video` : `Play ${title} video`} aria-controls={`${id}-video`} disabled={globallyPaused || hidden} onClick={state === "playing" ? pause : () => requestPlay()}>{state === "playing" ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}<span>{state === "playing" ? "Pause" : "Play"}</span></button>
        <button type="button" aria-label={`Replay ${title} video`} aria-controls={`${id}-video`} disabled={globallyPaused || hidden} onClick={() => requestPlay(true)}><RotateCcw size={15} aria-hidden="true" /><span>Replay</span></button>
      </div>
      <progress ref={progressRef} max={1} value={0} aria-label={`${title} video progress`} className={styles.progress} />
      <span className={styles.state} role="status" aria-live="polite">{status}</span>
    </div>
    <figcaption id={`${id}-description`} className={styles.caption}><strong>{provenance}</strong><p>{description}</p></figcaption>
  </figure>;
}
