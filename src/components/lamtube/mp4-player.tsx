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
  VolumeX,
  Maximize,
  Captions,
  Bookmark,
  Download,
  RotateCcw,
} from "lucide-react";
import type { VideoState } from "@/lib/lamtube/model";
import { locate, clockLabel, clamp } from "@/lib/lamtube/timeline";

export function Mp4VideoPlayer({
  video,
  onMoment,
  onWatch,
  onBookmark,
  seekRef,
}: {
  video: VideoState;
  onMoment: (time: number) => void;
  onWatch: (time: number) => void;
  onBookmark: (time: number) => void;
  seekRef?: Ref<{ seek: (time: number) => void }>;
}) {
  const timeline = video.timeline!;
  const duration = video.render?.duration || timeline.duration;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(() => clamp(video.watch.position, 0, duration));
  const [playing, setPlaying] = useState(false);
  const [captions, setCaptions] = useState(video.settings.captions);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<{ scene: string; value: number } | null>(null);
  const checked = useRef(new Set<string>());
  const lastSavedRef = useRef(0);
  const callbacks = useRef({ onMoment, onWatch });

  useLayoutEffect(() => {
    callbacks.current = { onMoment, onWatch };
  }, [onMoment, onWatch]);

  const at = locate(timeline, time);
  const scene = timeline.scenes[at.sceneIndex];
  const answer = response?.scene === scene.id ? response.value : null;

  const syncCaptionsTrack = useCallback((show: boolean) => {
    const el = videoRef.current;
    if (!el || !el.textTracks.length) return;
    for (let i = 0; i < el.textTracks.length; i++) {
      el.textTracks[i].mode = show ? "showing" : "hidden";
    }
  }, []);

  useEffect(() => {
    syncCaptionsTrack(captions);
  }, [captions, syncCaptionsTrack]);

  const seek = useCallback(
    (target: number) => {
      const next = clamp(target, 0, duration);
      if (videoRef.current) {
        videoRef.current.currentTime = next;
      }
      setTime(next);
      callbacks.current.onMoment(next);
    },
    [duration]
  );

  useImperativeHandle(seekRef, () => ({ seek }), [seek]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setError("");
    if (el.paused) {
      if (el.currentTime >= duration - 0.1) el.currentTime = 0;
      void el.play().catch(() => {
        setPlaying(false);
        setError("Playback was blocked by browser policy. Press Play again to start audio/video.");
      });
    } else {
      el.pause();
    }
  }, [duration]);

  const toggleFullscreen = useCallback(() => {
    const host = containerRef.current;
    if (!host) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void host.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onLoaded = () => {
      if (video.watch.position > 0 && video.watch.position < duration - 0.5) {
        el.currentTime = video.watch.position;
      }
      syncCaptionsTrack(captions);
      setBuffering(false);
    };
    const onTimeUpdate = () => {
      const cur = el.currentTime;
      setTime(cur);
      callbacks.current.onMoment(cur);
      // Pause-and-check quiz at scene boundary when interactive quizzes are enabled
      const loc = locate(timeline, cur);
      const prevIdx = loc.sceneIndex - 1;
      if (video.settings.interactive && prevIdx >= 0) {
        const prevScene = timeline.scenes[prevIdx];
        if (prevScene?.question && !checked.current.has(prevScene.id) && cur >= prevScene.start + prevScene.duration && cur <= prevScene.start + prevScene.duration + 0.65) {
          checked.current.add(prevScene.id);
          el.pause();
          el.currentTime = Math.max(prevScene.start, prevScene.start + prevScene.duration - 0.15);
          setTime(el.currentTime);
        }
      }
      if (Date.now() - lastSavedRef.current > 8000) {
        lastSavedRef.current = Date.now();
        callbacks.current.onWatch(cur);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      callbacks.current.onWatch(el.currentTime);
    };
    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
    const onErr = () => {
      setBuffering(false);
      setPlaying(false);
      setError("Could not stream the compiled MP4 video. Retry loading the stream.");
    };

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("error", onErr);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("error", onErr);
    };
  }, [captions, duration, syncCaptionsTrack, timeline, video.settings.interactive, video.watch.position]);

  const aspect =
    video.settings.aspect === "9:16"
      ? "lt-stage-9-16"
      : video.settings.aspect === "1:1"
        ? "lt-stage-1-1"
        : "lt-stage-16-9";

  const videoSrc = `/api/lamtube/${encodeURIComponent(video.id)}/video`;
  const captionsSrc = `/api/lamtube/${encodeURIComponent(video.id)}/captions.vtt`;
  const mb = video.render ? (video.render.sizeBytes / (1024 * 1024)).toFixed(1) : null;

  return (
    <div
      ref={containerRef}
      className="lt-player"
      tabIndex={0}
      aria-label="AI generated MP4 video player. Space to play, arrows to seek, C for captions, F for fullscreen"
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest("input,select,textarea,button,a")) return;
        if ([" ", "k"].includes(event.key)) {
          event.preventDefault();
          togglePlay();
        } else if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          seek(time + (event.key === "ArrowRight" ? 10 : -10));
        } else if (event.key.toLowerCase() === "c") {
          setCaptions((c) => !c);
        } else if (event.key.toLowerCase() === "f") {
          toggleFullscreen();
        }
      }}
    >
      <div className={`lt-stage ${aspect}`} data-aspect={video.settings.aspect} data-player="mp4">
        <video
          ref={videoRef}
          src={videoSrc}
          playsInline
          preload="metadata"
          onClick={togglePlay}
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#050914", display: "block" }}
        >
          <track kind="captions" src={captionsSrc} srcLang="en" label="Subtitles" default={captions} />
        </video>
        {buffering && <div className="lt-buffer">Buffering video…</div>}
        {!playing && !error && (
          <button
            className="lt-center-play"
            aria-label={time > 0.5 && time < duration - 0.5 ? "Resume video" : "Play video"}
            onClick={togglePlay}
          >
            <Play size={28} />
          </button>
        )}
      </div>

      <div className="lt-controls">
        <div className="lt-scrubber-row">
          <input
            className="lt-seek"
            type="range"
            min={0}
            max={Math.max(duration, 0.1)}
            step={0.1}
            value={time}
            aria-label="Seek video timeline"
            onChange={(e) => seek(Number(e.target.value))}
          />
          <span className="lt-time">
            {clockLabel(time)} / {clockLabel(duration)}
          </span>
        </div>
        <div className="lt-control-row">
          <div className="lt-control-group">
            <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={() => seek(time - 10)} aria-label="Back 10 seconds">
              <SkipBack size={18} />
            </button>
            <button onClick={() => seek(time + 10)} aria-label="Forward 10 seconds">
              <SkipForward size={18} />
            </button>
            {video.render && (
              <span className="lt-scene-label">
                {video.render.width}×{video.render.height} · {video.render.fps}fps · MP4
                {mb ? ` (${mb} MB)` : ""}
              </span>
            )}
          </div>
          <div className="lt-control-group">
            <button
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                if (videoRef.current) videoRef.current.muted = next;
              }}
            >
              {muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Volume"
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                setMuted(v === 0);
                if (videoRef.current) {
                  videoRef.current.volume = v;
                  videoRef.current.muted = v === 0;
                }
              }}
            />
            <select
              aria-label="Playback speed"
              value={rate}
              onChange={(e) => {
                const r = Number(e.target.value);
                setRate(r);
                if (videoRef.current) videoRef.current.playbackRate = r;
              }}
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
              onClick={() => setCaptions((c) => !c)}
            >
              <Captions size={19} />
            </button>
            <button aria-label="Bookmark current moment" onClick={() => onBookmark(time)}>
              <Bookmark size={18} />
            </button>
            <a
              className="lt-button"
              href={`${videoSrc}?download=1`}
              download
              aria-label="Download MP4 video"
            >
              <Download size={16} />
            </a>
            <button aria-label="Fullscreen" onClick={toggleFullscreen}>
              <Maximize size={18} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="lt-notice" role="alert">
          {error}{" "}
          <button
            onClick={() => {
              setError("");
              videoRef.current?.load();
            }}
          >
            <RotateCcw size={15} /> Reload stream
          </button>
        </p>
      )}

      <nav className="lt-markers" aria-label="Lesson chapter and scene markers">
        {timeline.scenes.map((s, i) => (
          <button
            key={s.id}
            aria-current={at.sceneIndex === i ? "step" : undefined}
            onClick={() => seek(s.start)}
          >
            <span>{clockLabel(s.start)}</span>
            {s.title}
          </button>
        ))}
      </nav>

      {scene.question &&
        video.settings.interactive &&
        time >= scene.start + scene.duration - 0.5 && (
          <section className="lt-check">
            <h4>Pause & check</h4>
            <p>{scene.question.prompt}</p>
            <div className="lt-options">
              {scene.question.options.map((option, i) => (
                <button
                  key={i}
                  aria-pressed={answer === i}
                  onClick={() => {
                    videoRef.current?.pause();
                    setResponse({ scene: scene.id, value: i });
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
            {answer !== null && (
              <p role="status">
                {answer === scene.question.answer ? "Correct. " : "Try this reasoning. "}
                {scene.question.explanation}
              </p>
            )}
            <button
              className="lt-button"
              onClick={() => {
                checked.current.add(scene.id);
                seek(scene.start + scene.duration + 0.05);
                void videoRef.current?.play().catch(() => {});
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
              const source = video.sources.find((x) => x.citation.id === id)?.citation;
              return source ? (
                <p key={id}>
                  {id}: {source.title} {source.page ? `· page ${source.page}` : ""}{" "}
                  {source.url && /^https:\/\//.test(source.url) ? (
                    <a href={source.url} target="_blank" rel="noopener noreferrer">
                      Original source
                    </a>
                  ) : (
                    "· Private source"
                  )}
                </p>
              ) : null;
            })}
            {!s.sourceIds.length && (
              <small>General explanation · no source-supported claim is implied</small>
            )}
          </section>
        ))}
      </details>
    </div>
  );
}
