"use client";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Loader2,
  Play,
  X,
  AudioLines,
  Layers3,
  ShieldCheck,
} from "lucide-react";
import { generationProgress } from "@/lib/lamtube/model";
import type { VideoState } from "@/lib/lamtube/model";

const stages = [
  { id: "sources", label: "Gather context", detail: "Reading curriculum & selected notes" },
  { id: "outline", label: "Plan the lesson", detail: "Structuring scene flow & objectives" },
  { id: "scenes", label: "Design animated scenes", detail: "Plotting equations, graphs & motion" },
  { id: "illustrations", label: "Create visual plates", detail: "Generating crisp textbook plates" },
  { id: "narration", label: "Record AI narration", detail: "Synthesizing clear synced speech" },
  { id: "assemble", label: "Sync audio timeline", detail: "Measuring phrase offsets & subtitles" },
  { id: "render", label: "Encode H.264 MP4", detail: "Rendering 30 FPS frames & audio mux" },
  { id: "complete", label: "Quality verified", detail: "Playable HD video stream ready" },
] as const;

export function GenerationProgress({
  video,
  busy,
  onRun,
  onCancel,
  onBackground,
  onEdit,
}: {
  video: VideoState;
  busy: boolean;
  onRun: () => void;
  onCancel: () => void;
  onBackground: () => void;
  onEdit: () => void;
}) {
  const active = stages.findIndex((stage) => stage.id === video.stage);
  const processing = video.status === "generating";
  const progress = generationProgress(video);
  const running = processing && !video.retryAt;
  const savedPhrases = video.clips.reduce((sum, clips) => sum + clips.length, 0);
  const savedPlates = (video.assets ?? []).filter((a) => a.mimeType !== "none").length;

  return (
    <section className="lt-panel lt-job lt-studio" data-running={running} data-stage={video.stage}>
      <div className="lt-studio-heading">
        <span className="lt-eyebrow">
          <Clapperboard size={15} /> LAMTUBE · AI VIDEO PRODUCTION STUDIO
        </span>
        <span className="lt-studio-save">
          <ShieldCheck size={14} /> Progress saved
        </span>
      </div>
      <h2>{video.title}</h2>
      <p role="status" aria-live="polite">
        {video.status === "failed"
          ? "Your saved work is safe. Fix or retry to resume from the last completed stage."
          : video.status === "cancelled"
            ? "Cancelled safely. Your completed stages are preserved."
            : video.retryAt
              ? "Waiting briefly for shared AI rate limit. Generation will resume automatically."
              : processing
                ? stages[active]?.detail || "Producing your educational MP4 video…"
                : "Your AI video draft is ready to start."}
      </p>
      <div className="lt-studio-layout">
        <div className="lt-studio-workbench">
          <div className="lt-studio-canvas" aria-hidden="true">
            <span className="lt-studio-canvas-label">{stages[active]?.label || "Producing MP4"}</span>
            <div className="lt-studio-composition">
              <span className="lt-studio-node">
                <Layers3 size={24} />
              </span>
              <span className="lt-studio-connector" />
              <span className="lt-studio-node">
                <ImageIcon size={24} />
              </span>
              <span className="lt-studio-connector" />
              <span className="lt-studio-frame">
                <Film size={34} />
                <span />
                <span />
              </span>
              <span className="lt-studio-connector" />
              <span className="lt-studio-node">
                <AudioLines size={24} />
              </span>
            </div>
            <div className="lt-studio-wave">
              {Array.from({ length: 19 }, (_, index) => (
                <i
                  key={index}
                  style={{
                    animationDelay: `${index * 0.08}s`,
                    height: `${8 + ((index * 7) % 23)}px`,
                  }}
                />
              ))}
            </div>
            <span className="lt-studio-canvas-caption">Plan → visuals → narration → H.264 MP4</span>
          </div>
          <div className="lt-job-meter">
            <progress value={progress} max={100} aria-label="Saved lesson progress" />
            <strong>{progress}%</strong>
          </div>
          <div className="lt-studio-counts">
            <span>
              <strong>{video.plans.length}</strong> scenes designed
            </span>
            <span>
              <strong>{savedPhrases}</strong> voice clips saved
            </span>
            <span>
              <strong>{savedPlates}</strong> visual plates
            </span>
          </div>
        </div>
        <ol className="lt-job-steps">
          {stages.map((stage, index) => (
            <li
              key={stage.id}
              data-active={processing && active === index}
              data-done={active > index || video.stage === "complete"}
            >
              <span className="lt-job-step-icon">
                {active > index || video.stage === "complete" ? (
                  <Check size={16} />
                ) : running && active === index ? (
                  <Loader2 size={16} className="lt-job-spin" />
                ) : (
                  index + 1
                )}
              </span>
              <div>
                <strong>{stage.label}</strong>
                <small>{stage.detail}</small>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {video.outline && (
        <div className="lt-studio-storyboard" aria-label="Your lesson storyboard">
          {video.outline.scenes.map((scene, index) => (
            <div key={index} data-saved={index < video.plans.length}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{scene.title}</strong>
              <small>
                {index < video.plans.length
                  ? `${video.clips[index]?.length ?? 0} / ${video.plans[index].phrases.length} voice clips`
                  : "Scene planned"}
              </small>
            </div>
          ))}
        </div>
      )}
      {video.error && (
        <p className="lt-notice" role="alert">
          {video.error}
        </p>
      )}
      <div className="lt-action-row">
        <button className="lt-button lt-primary" onClick={onBackground}>
          <ArrowLeft size={17} /> {processing ? "Continue in background" : "Back to all videos"}
        </button>
        {!processing && (
          <button className="lt-button" disabled={busy} onClick={onRun}>
            {busy ? <Loader2 size={16} className="lt-job-spin" /> : <Play size={16} />}{" "}
            {video.status === "draft" ? "Start generation" : "Retry saved generation"}
          </button>
        )}
        {video.status === "draft" && !video.outline && (
          <button className="lt-button" disabled={busy} onClick={onEdit}>
            Edit settings
          </button>
        )}
        {processing && (
          <button className="lt-button" onClick={onCancel}>
            <X size={16} /> Cancel generation
          </button>
        )}
      </div>
      <small>
        Progress reflects persisted pipeline artifacts. Finished MP4s stay saved in your library.
      </small>
    </section>
  );
}
