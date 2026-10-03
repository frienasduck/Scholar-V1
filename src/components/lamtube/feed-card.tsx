"use client";
import { Clapperboard, Loader2, Play, AlertCircle } from "lucide-react";
import { generationProgress } from "@/lib/lamtube/model";
import type { VideoState } from "@/lib/lamtube/model";
import { clockLabel } from "@/lib/lamtube/timeline";
export function AIVideoFeedCard({ video, onOpen }: { video: VideoState; onOpen: (video: VideoState) => void }) {
  return <button className="nt-glass nt-ai-card rounded-2xl overflow-hidden text-left group" onClick={() => onOpen(video)} aria-label={`${video.status === "ready" ? "Watch" : "View progress for"} ${video.title}`}>
    <div className="nt-ai-thumbnail">
      {video.status === "generating" ? <Loader2 size={34} className="lt-job-spin" /> : video.status === "failed" ? <AlertCircle size={34} /> : <Clapperboard size={38} />}
      <span className="nt-ai-label">YOUR AI LESSON</span>
      <span className="nt-ai-duration">{video.status === "ready" ? clockLabel(video.timeline?.duration ?? 0) : video.status === "generating" ? `${generationProgress(video)}% · creating` : "Needs attention"}</span>
      {video.status === "ready" && <span className="nt-ai-play"><Play size={22} /></span>}
    </div>
    <div className="p-3.5"><h3 className="text-sm font-medium text-white line-clamp-2">{video.title}</h3><p className="text-xs text-white/50 mt-1 line-clamp-2">LAM · {video.settings.chapters.map((c) => c.title).join(" · ")}</p>
      {video.status === "generating" && <progress className="nt-ai-progress" value={generationProgress(video)} max={100} aria-label="Saved generation progress" />}
      <p className="text-[11px] text-fuchsia-300 mt-2">{video.status === "generating" ? "Working in the background" : video.status === "ready" ? "Private · Created for you" : "Saved stages available to retry"}</p></div>
  </button>;
}
