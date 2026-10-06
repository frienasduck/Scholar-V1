"use client";
import { Headphones } from "lucide-react";
import { useMusicStore } from "@/lib/music-store";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import "./study-music.css";

export function StudyMusicQuickAccess() {
  const access = useScholarAccess();
  const focus = useMusicStore(s => s.focus);
  const allowed = access.has("study_music_ad_free");
  return <button className="sm-quick-access" aria-label="Study Music quick controls" title={allowed ? focus ? "Music & active focus session" : "Study Music" : "Study Music · Scholar Plus"} onClick={() => allowed ? useMusicStore.getState().setDrawer("quick") : window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "music" } }))}><Headphones size={18}/>{allowed && focus && focus.phase !== "complete" && <span className="sm-status-dot"/>}</button>;
}
