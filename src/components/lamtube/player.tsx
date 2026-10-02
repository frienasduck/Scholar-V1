"use client";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Ref } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Maximize,
  Captions,
  Bookmark,
  RotateCcw,
} from "lucide-react";
import type { VideoState } from "@/lib/lamtube/model";
import { locate, clockLabel, clamp } from "@/lib/lamtube/timeline";
import { SceneCanvas, paintScene } from "./scene-canvas";

export function TimelinePlayer({
  video,
  preview = false,
  onMoment,
  onWatch,
  onBookmark,
  seekRef,
}: {
  video: VideoState;
  preview?: boolean;
  onMoment: (time: number) => void;
  onWatch: (time: number) => void;
  onBookmark: (time: number) => void;
  seekRef?: Ref<{ seek: (time: number) => void }>;
}) {
  // Parent keys this by audio IDs. Watch/notes responses must not reset media.
  const [timeline] = useState(() => video.timeline!);
  const audio = useRef<HTMLAudioElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(
    clamp(video.watch.position, 0, timeline.duration)
  );
  const [playing, setPlaying] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(
    locate(timeline, time).sceneIndex
  );
  const [captions, setCaptions] = useState(video.settings.captions);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<{
    scene: string;
    value: number;
  } | null>(null);
  const checked = useRef(new Set<string>());
  const raf = useRef(0);
  const startLoop = useRef<() => void>(() => {});
  const runtime = useRef({
    time,
    playing: false,
    clipStart: 0,
    source: "",
    target: 0,
    ready: false,
    rate: 1,
    reduced: false,
    lastFrame: 0,
    lastUI: 0,
    lastSave: 0,
  });
  const callbacks = useRef({ onMoment, onWatch });
  useLayoutEffect(() => {
    callbacks.current = { onMoment, onWatch };
  }, [onMoment, onWatch]);
  const setPlayback = useCallback((value: boolean) => {
    runtime.current.playing = value;
    setPlaying(value);
    if (!value) {
      audio.current?.pause();
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    } else startLoop.current();
  }, []);
  const playAudio = useCallback(() => {
    if (!runtime.current.playing || preview || !runtime.current.ready) return;
    void audio.current?.play().catch(() => {
      setPlayback(false);
      setError(
        "Playback was blocked. Tap Play to enable audio, or check that this private narration is available."
      );
    });
  }, [preview, setPlayback]);
  const seek = useCallback(
    (target: number) => {
      const r = runtime.current;
      const at = locate(timeline, target);
      r.time = clamp(target, 0, timeline.duration);
      r.clipStart = at.clipStart;
      r.target = at.clipTime;
      setTime(r.time);
      setSceneIndex(at.sceneIndex);
      callbacks.current.onMoment(r.time);
      paintScene(svg.current, at.scene, at.local, r.reduced);
      const media = audio.current;
      if (media && !preview) {
        const source = `/api/lamtube/${encodeURIComponent(
          video.id
        )}/audio/${encodeURIComponent(at.clip.id)}`;
        if (r.source !== source) {
          r.source = source;
          r.ready = false;
          setBuffering(true);
          media.src = source;
          media.load();
        } else if (r.ready) {
          media.currentTime = Math.min(
            r.target,
            Math.max(0, media.duration - 0.001)
          );
          playAudio();
        }
      }
    },
    [timeline, preview, video.id, playAudio]
  );
  useImperativeHandle(seekRef, () => ({ seek }), [seek]);
  function fullscreen() {
    if (!root.current?.requestFullscreen) {
      setError(
        "Fullscreen is unavailable in this browser; the responsive player remains available."
      );
      return;
    }
    void root.current
      .requestFullscreen()
      .catch(() =>
        setError(
          "Fullscreen is unavailable in this browser; the responsive player remains available."
        )
      );
  }
  const toggle = useCallback(() => {
    const r = runtime.current;
    if (r.playing) {
      setPlayback(false);
      callbacks.current.onWatch(r.time);
      return;
    }
    if (r.time >= timeline.duration - 0.01) seek(0);
    setError("");
    setPlayback(true);
    r.lastFrame = performance.now();
    playAudio();
  }, [timeline.duration, seek, setPlayback, playAudio]);
  useLayoutEffect(() => {
    const at = locate(timeline, runtime.current.time);
    paintScene(svg.current, at.scene, at.local, runtime.current.reduced);
  }, [sceneIndex, timeline]);
  useEffect(() => {
    const media = audio.current!;
    const r = runtime.current;
    r.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ready = () => {
      r.ready = true;
      media.currentTime = Math.min(
        r.target,
        Math.max(0, media.duration - 0.001)
      );
      media.playbackRate = r.rate;
      setBuffering(false);
      playAudio();
    };
    const ended = () => {
      const target = r.clipStart + media.duration;
      const scene = locate(timeline, r.clipStart + 0.001).scene;
      if (
        scene.question &&
        video.settings.interactive &&
        target >= scene.start + scene.duration - 0.02 &&
        !checked.current.has(scene.id)
      ) {
        checked.current.add(scene.id);
        r.time = scene.start + scene.duration - 0.001;
        setTime(r.time);
        callbacks.current.onMoment(r.time);
        setPlayback(false);
        return;
      }
      if (target >= timeline.duration - 0.05) {
        r.time = timeline.duration;
        setTime(r.time);
        setPlayback(false);
        callbacks.current.onWatch(r.time);
      } else seek(target + 0.001);
    };
    const failed = () => {
      r.ready = false;
      setBuffering(false);
      setPlayback(false);
      setError(
        "Narration could not load. Your position is retained. Check your connection or sign in again, then retry."
      );
    };
    const waiting = () => setBuffering(true);
    const canplay = () => setBuffering(false);
    const hidden = () => {
      if (document.hidden) {
        setPlayback(false);
        callbacks.current.onWatch(r.time);
      }
    };
    media.addEventListener("loadedmetadata", ready);
    media.addEventListener("ended", ended);
    media.addEventListener("error", failed);
    media.addEventListener("waiting", waiting);
    media.addEventListener("playing", canplay);
    document.addEventListener("visibilitychange", hidden);
    // Media mount is external synchronization; schedule the initial paint/load once.
    const initial = requestAnimationFrame(() => seek(r.time));
    const animate = (now: number) => {
      if (r.playing) {
        if (preview) {
          const previous = locate(timeline, r.time).scene;
          r.time = Math.min(
            timeline.duration,
            r.time + Math.min(0.1, (now - r.lastFrame) / 1000) * r.rate
          );
          if (
            previous.question &&
            video.settings.interactive &&
            r.time >= previous.start + previous.duration &&
            !checked.current.has(previous.id)
          ) {
            checked.current.add(previous.id);
            r.time = previous.start + previous.duration - 0.001;
            setTime(r.time);
            setPlayback(false);
          }
        } else if (r.ready)
          r.time = Math.min(timeline.duration, r.clipStart + media.currentTime);
        const at = locate(timeline, r.time);
        paintScene(svg.current, at.scene, at.local, r.reduced);
        if (now - r.lastUI >= 200) {
          r.lastUI = now;
          setTime(r.time);
          setSceneIndex(at.sceneIndex);
          callbacks.current.onMoment(r.time);
        }
        if (now - r.lastSave >= 10000) {
          r.lastSave = now;
          callbacks.current.onWatch(r.time);
        }
        if (r.time >= timeline.duration) {
          setTime(timeline.duration);
          callbacks.current.onMoment(timeline.duration);
          setPlayback(false);
          callbacks.current.onWatch(r.time);
        }
      }
      r.lastFrame = now;
      raf.current =
        r.playing && !document.hidden ? requestAnimationFrame(animate) : 0;
    };
    startLoop.current = () => {
      if (!raf.current) {
        r.lastFrame = performance.now();
        raf.current = requestAnimationFrame(animate);
      }
    };
    return () => {
      cancelAnimationFrame(initial);
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      media.pause();
      media.removeAttribute("src");
      media.load();
      media.removeEventListener("loadedmetadata", ready);
      media.removeEventListener("ended", ended);
      media.removeEventListener("error", failed);
      media.removeEventListener("waiting", waiting);
      media.removeEventListener("playing", canplay);
      document.removeEventListener("visibilitychange", hidden);
      callbacks.current.onWatch(r.time);
    };
  }, [
    timeline,
    preview,
    seek,
    playAudio,
    setPlayback,
    video.settings.interactive,
  ]);
  const at = locate(timeline, time);
  const scene = timeline.scenes[sceneIndex];
  const answer = response?.scene === scene.id ? response.value : null;
  function changeRate(value: number) {
    runtime.current.rate = value;
    setRate(value);
    if (audio.current) audio.current.playbackRate = value;
  }
  function retryAudio() {
    runtime.current.source = "";
    seek(runtime.current.time);
  }
  function keyboard(event: React.KeyboardEvent) {
    if ((event.target as HTMLElement).closest("input,select,textarea,button"))
      return;
    if ([" ", "k"].includes(event.key)) {
      event.preventDefault();
      toggle();
    }
    if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      seek(runtime.current.time + (event.key === "ArrowRight" ? 10 : -10));
    }
    if (event.key.toLowerCase() === "c") setCaptions((c) => !c);
    if (event.key.toLowerCase() === "f") fullscreen();
  }
  return (
    <div
      ref={root}
      className="lt-player"
      tabIndex={0}
      aria-label="AI lesson player. Space to play, arrows to seek, C for captions, F for fullscreen"
      onKeyDown={keyboard}
    >
      <audio ref={audio} preload="metadata" aria-hidden="true" />
      <div
        className={`lt-stage lt-aspect-${video.settings.aspect.replace(
          ":",
          "-"
        )}`}
      >
        <div className="lt-scene-heading">
          <span>
            {preview
              ? "SILENT INTERACTIVE PREVIEW"
              : `SCENE ${sceneIndex + 1} / ${timeline.scenes.length}`}
          </span>
          <h3>{scene.title}</h3>
        </div>
        <SceneCanvas scene={scene} svgRef={svg} />
        {captions && (
          <div className="lt-caption" aria-label="Current narration">
            {at.clip.text}
          </div>
        )}
        {buffering && !preview && (
          <div className="lt-buffer" role="status">
            Loading narration…
          </div>
        )}
        {!playing && time === 0 && (
          <button
            className="lt-play-overlay"
            aria-label="Play lesson"
            onClick={toggle}
          >
            <Play size={32} />
          </button>
        )}
      </div>
      <div className="lt-controls">
        <input
          className="lt-seek"
          type="range"
          min={0}
          max={timeline.duration}
          step={0.01}
          value={time}
          aria-label="Seek lesson timeline"
          aria-valuetext={`${clockLabel(time)} of ${clockLabel(
            timeline.duration
          )}`}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <div className="lt-control-row">
          <div className="lt-control-group">
            <button aria-label={playing ? "Pause" : "Play"} onClick={toggle}>
              {playing ? <Pause /> : <Play />}
            </button>
            <button
              aria-label="Back 10 seconds"
              onClick={() => seek(runtime.current.time - 10)}
            >
              <SkipBack size={18} />
            </button>
            <button
              aria-label="Forward 10 seconds"
              onClick={() => seek(runtime.current.time + 10)}
            >
              <SkipForward size={18} />
            </button>
            <span className="lt-time">
              {clockLabel(time)} / {clockLabel(timeline.duration)}
            </span>
          </div>
          <div className="lt-control-group">
            <label className="lt-volume">
              <Volume2 size={17} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                aria-label="Volume"
                value={volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  if (audio.current)
                    audio.current.volume = Number(e.target.value);
                }}
              />
            </label>
            <select
              aria-label="Playback speed"
              value={rate}
              onChange={(e) => changeRate(Number(e.target.value))}
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((v) => (
                <option value={v} key={v}>
                  {v}×
                </option>
              ))}
            </select>
            <button
              aria-label="Toggle captions"
              aria-pressed={captions}
              onClick={() => setCaptions(!captions)}
            >
              <Captions size={19} />
            </button>
            <button
              aria-label="Bookmark current moment"
              onClick={() => onBookmark(runtime.current.time)}
            >
              <Bookmark size={18} />
            </button>
            <button aria-label="Fullscreen" onClick={fullscreen}>
              <Maximize size={18} />
            </button>
          </div>
        </div>
      </div>
      {error && (
        <p className="lt-notice" role="alert">
          {error}
          <button onClick={retryAudio}>
            <RotateCcw size={15} /> Retry audio
          </button>
        </p>
      )}
      <nav className="lt-markers" aria-label="Lesson chapter and scene markers">
        {timeline.scenes.map((s, i) => (
          <button
            key={s.id}
            aria-current={sceneIndex === i ? "step" : undefined}
            onClick={() => seek(s.start)}
          >
            <span>{clockLabel(s.start)}</span>
            {s.title}
          </button>
        ))}
      </nav>
      {scene.question &&
        video.settings.interactive &&
        time >= scene.start + scene.duration - 0.4 && (
          <section className="lt-check">
            <h4>Pause & check</h4>
            <p>{scene.question.prompt}</p>
            <div className="lt-options">
              {scene.question.options.map((option, i) => (
                <button
                  key={i}
                  aria-pressed={answer === i}
                  onClick={() => {
                    setPlayback(false);
                    setResponse({ scene: scene.id, value: i });
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
            {answer !== null && (
              <p role="status">
                {answer === scene.question.answer
                  ? "Correct. "
                  : "Try this reasoning. "}
                {scene.question.explanation}
              </p>
            )}
            <button
              className="lt-button"
              onClick={() => {
                checked.current.add(scene.id);
                seek(scene.start + scene.duration + 0.001);
                if (sceneIndex < timeline.scenes.length - 1) {
                  setPlayback(true);
                  playAudio();
                }
              }}
            >
              Continue lesson <SkipForward size={16} />
            </button>
          </section>
        )}
      <details className="lt-transcript">
        <summary>Accessible transcript & sources</summary>
        {timeline.scenes.map((s) => (
          <section key={s.id}>
            <button onClick={() => seek(s.start)}>
              {clockLabel(s.start)} · {s.title}
            </button>
            <p>{s.phrases.join(" ")}</p>
            {s.sourceIds.map((id) => {
              const source = video.sources.find((x) => x.citation.id === id)
                ?.citation;
              return source ? (
                <p key={id}>
                  {id}: {source.title}{" "}
                  {source.page ? `· page ${source.page}` : ""}{" "}
                  {source.url && /^https:\/\//.test(source.url) ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Original source
                    </a>
                  ) : (
                    "· Private source"
                  )}
                </p>
              ) : null;
            })}
            {!s.sourceIds.length && (
              <small>
                General explanation · no source-supported claim is implied
              </small>
            )}
          </section>
        ))}
      </details>
    </div>
  );
}
