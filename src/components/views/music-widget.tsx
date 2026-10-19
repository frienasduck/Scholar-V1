"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { suspendStudyMusic } from "@/lib/music-store";
import { getSectionShutdown } from "@/lib/section-availability";

const Player = dynamic(() => import("@/components/study-music/player").then(m => m.StudyMusicPlayer));
export function FloatingMusicWidget({ currentView }: { currentView?: string }) {
  const entitled = useScholarAccess().has("study_music_ad_free");
  const allowed = entitled && !getSectionShutdown("music");
  useEffect(() => { if (!allowed) suspendStudyMusic(); }, [allowed]);
  // This owner stays in AppShell across routes; only the heavy implementation
  // is split. Revocation still immediately suspends playback and timers.
  return allowed ? <Player currentView={currentView}/> : null;
}
