"use client";
import { ArrowLeft, Check, Clapperboard, Loader2, Play, X, AudioLines, Layers3, ShieldCheck } from "lucide-react";
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
  const running = processing && !video.retryAt;
  const savedPhrases = video.clips.reduce((sum, clips) => sum + clips.length, 0);
  return <section className="lt-panel lt-job lt-studio" data-running={running}>
    <div className="lt-studio-heading"><span className="lt-eyebrow"><Clapperboard size={15} /> LAMTUBE · LESSON STUDIO</span><span className="lt-studio-save"><ShieldCheck size={14} /> Progress saved</span></div>
    <h2>{video.title}</h2>
    <p role="status" aria-live="polite">{video.status === "failed" ? "Your saved work is safe. Let's get this stage moving again." : video.status === "cancelled" ? "Cancelled safely. Your completed stages are saved." : video.retryAt ? "An AI cooldown. Your lesson will resume automatically." : processing ? "Keep studying. We'll handle the making." : "Your visual lesson is ready to start."}</p>
    <div className="lt-studio-layout"><div className="lt-studio-workbench">
      <div className="lt-studio-canvas" aria-hidden="true"><span className="lt-studio-canvas-label">{stages[active]?.label || "Your visual lesson"}</span><div className="lt-studio-composition"><span className="lt-studio-node"><Layers3 size={28} /></span><span className="lt-studio-connector" /><span className="lt-studio-frame"><Clapperboard size={36} /><span /><span /></span><span className="lt-studio-connector" /><span className="lt-studio-node"><AudioLines size={28} /></span></div><div className="lt-studio-wave">{Array.from({length: 19}, (_, index) => <i key={index} style={{animationDelay: `${index * .08}s`, height: `${8 + (index * 7 % 23)}px`}} />)}</div><span className="lt-studio-canvas-caption">Context → visuals → voice</span></div>
      <div className="lt-job-meter"><progress value={progress} max={100} aria-label="Saved lesson progress" /><strong>{progress}%</strong></div>
      <div className="lt-studio-counts"><span><strong>{video.plans.length}</strong> scenes saved</span><span><strong>{savedPhrases}</strong> voice clips saved</span><span><strong>{video.outline?.scenes.length ?? "—"}</strong> planned scenes</span></div>
    </div>
    <ol className="lt-job-steps">{stages.map((stage, index) => <li key={stage.id} data-active={processing && active === index} data-done={active > index || video.stage === "complete"}>
      <span className="lt-job-step-icon">{active > index ? <Check size={16} /> : running && active === index ? <Loader2 size={16} className="lt-job-spin" /> : index + 1}</span>
      <div><strong>{stage.label}</strong><small>{stage.detail}</small></div>
    </li>)}</ol></div>
    {video.outline && <div className="lt-studio-storyboard" aria-label="Your lesson storyboard">{video.outline.scenes.map((scene, index) => <div key={index} data-saved={index < video.plans.length}><span>{String(index + 1).padStart(2, "0")}</span><strong>{scene.title}</strong><small>{index < video.plans.length ? `${video.clips[index]?.length ?? 0} / ${video.plans[index].phrases.length} voice clips` : "Scene planned"}</small></div>)}</div>}
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
