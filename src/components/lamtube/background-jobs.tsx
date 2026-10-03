"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { videoRequest } from "@/lib/lamtube/client";
import { libraryScope, refreshVideoLibrary, libraryError, videoScope } from "@/lib/lamtube/library";
import { toast } from "@/lib/notifications/notification-api";

/** Shell-owned, not player-owned: navigation no longer kills generation. */
export function LamTubeBackgroundJobs() {
  const scope = useStore((s) => videoScope(s.authed && !s.guestMode, s.user.email, s.user.username));
  useEffect(() => {
    libraryScope(scope);
    if (scope === "guest") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let busy = false;
    let retrySoon = false;
    const seen = new Map<string, string>();
    const kickedAt = new Map<string, number>();
    async function poll() {
      if (controller.signal.aborted) return;
      if (busy) { retrySoon = true; return; }
      busy = true;
      clearTimeout(timer);
      let delay = 60000;
      try {
        const { videos } = await refreshVideoLibrary(scope, controller.signal);
        if (controller.signal.aborted) return;
        for (const video of videos) {
          if (seen.get(video.id) === "generating" && video.status === "ready")
            toast.success("Your LAMTube lesson is ready", { description: "Find it first in LAMTube's video feed." });
          seen.set(video.id, video.status);
        }
        const jobs = videos.filter((video) => video.status === "generating");
        if (jobs.length) {
          delay = 10000;
          // Existing database leases serialize competing tabs, workers and UI requests.
          // Observe every ten seconds, but do not enqueue the same 45s batch on every poll.
          const now = Date.now();
          const due = jobs.filter((video) => (!video.retryAt || video.retryAt <= now) && now - (kickedAt.get(video.id) ?? 0) >= 45000).slice(0, 3);
          await Promise.all(due.map(async (video) => {
            kickedAt.set(video.id, now);
            try { await videoRequest(`/api/lamtube/${video.id}`, { action: "start" }, controller.signal); }
            catch (error) { kickedAt.delete(video.id); throw error; }
          }));
        }
      } catch (error) {
        if (!controller.signal.aborted) libraryError(scope, (error as Error).message);
        delay = 30000;
      } finally {
        busy = false;
        if (!controller.signal.aborted) {
          timer = setTimeout(() => void poll(), retrySoon ? 1000 : delay);
          retrySoon = false;
        }
      }
    }
    const wake = () => { void poll(); };
    const visible = () => { if (!document.hidden) wake(); };
    window.addEventListener("scholar:lamtube-jobs", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", visible);
    void poll();
    return () => {
      controller.abort(); clearTimeout(timer);
      window.removeEventListener("scholar:lamtube-jobs", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [scope]);
  return null;
}
