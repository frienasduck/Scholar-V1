"use client";
import { ArrowLeft, Check, Clapperboard, Loader2, Play, X } from "lucide-react";
import { generationProgress } from "@/lib/lamtube/model";
import type { VideoState } from "@/lib/lamtube/model";
const stages = [
  { id: "sources", label: "Gather context", detail: "Finding the chapter's foundations" },
  { id: "outline", label: "Plan the lesson", detail: "Giving every concept a clear place" },
  { id: "scenes", label: "Build the visuals", detail: "Turning explanations into motion" },
  { id: "narration", label: "Record narration", detail: "Matching the voice to each scene" },
  { id: "assemble", label: "Bring it together", detail: "Synchronizing and checking playback" },
];
export function GenerationProgress({ video, busy, onRun, onCancel, onBackground, onEdit }: {
  video: VideoState; busy: boolean; onRun: () => void; onCancel: () => void; onBackground: () => void; onEdit: () => void;
}) {
  const active = stages.findIndex((stage) => stage.id === video.stage);
  const processing = video.status === "generating";
  const progress = generationProgress(video);
  return <section className="lt-panel lt-job">
    <div className="lt-job-art" data-running={processing} aria-hidden="true"><div className="lt-job-orbit" /><div className="lt-job-tile"><Clapperboard size={40} /></div><span className="lt-job-spark" /></div>
    <span className="lt-eyebrow">YOUR CHAPTER, COMING TO LIFE</span>
    <h2>{video.title}</h2>
    <p role="status" aria-live="polite">{video.status === "failed" ? "Your saved work is safe. Let's get this stage moving again." : video.status === "cancelled" ? "Cancelled safely. Your completed stages are saved." : video.retryAt ? "An AI cooldown. Your lesson will resume automatically." : processing ? "Keep studying. We'll handle the making." : "Your visual lesson is ready to start."}</p>
    <div className="lt-job-meter"><progress value={progress} max={100} aria-label="Saved lesson progress" /><strong>{progress}%</strong></div>
    <ol className="lt-job-steps">{stages.map((stage, index) => <li key={stage.id} data-active={processing && active === index} data-done={active > index || video.stage === "complete"}>
      <span className="lt-job-step-icon">{active > index ? <Check size={16} /> : processing && active === index ? <Loader2 size={16} className="lt-job-spin" /> : index + 1}</span>
      <div><strong>{stage.label}</strong><small>{stage.detail}</small></div>
    </li>)}</ol>
    <p className="lt-job-saved">{video.plans.length} scenes saved · {video.clips.flat().length} narration phrases saved</p>
    {video.error && <p className="lt-notice" role="alert">{video.error}</p>}
    <div className="lt-action-row">
      <button className="lt-button lt-primary" onClick={onBackground}><ArrowLeft size={17} /> {processing ? "Continue in background" : "Back to all videos"}</button>
      {!processing && <button className="lt-button" disabled={busy} onClick={onRun}>{busy ? <Loader2 size={16} className="lt-job-spin" /> : <Play size={16} />} {video.status === "draft" ? "Start generation" : "Retry saved generation"}</button>}
      {video.status === "draft" && !video.outline && <button className="lt-button" disabled={busy} onClick={onEdit}>Edit settings</button>}
      {processing && <button className="lt-button" onClick={onCancel}><X size={16} /> Cancel generation</button>}
    </div>
    <small>Progress is based on saved work, not a countdown. Processing continues while you use Scholar. If you close Scholar, saved stages resume when you return.</small>
  </section>;
}
