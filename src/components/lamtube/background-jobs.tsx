"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { videoRequest } from "@/lib/lamtube/client";
import { libraryScope, refreshVideoLibrary, libraryError, videoScope } from "@/lib/lamtube/library";
import { toast } from "@/lib/notifications/notification-api";

/** Shell-owned, not player-owned: navigation no longer kills generation. */
export function AiVideoBackgroundJobs() {
  return <LamTubeBackgroundJobs />;
}

/** Legacy export kept for shell shutdown contract; use AiVideoBackgroundJobs when only AI Video Maker is unpaused. */
export function LamTubeBackgroundJobs() {
  const scope = useStore((s) => videoScope(s.authed && !s.guestMode, s.user.email, s.user.username));
  useEffect(() => {
    libraryScope(scope);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let busy = false;
    let retrySoon = false;
    const seen = new Map<string, string>();
    const kickedAt = new Map<string, number>();

    async function poll() {
      if (controller.signal.aborted) return;
      if (busy) {
        retrySoon = true;
        return;
      }
      busy = true;
      clearTimeout(timer);
      let delay = scope === "guest" ? 60000 : 45000;
      try {
        const res = await refreshVideoLibrary(scope, controller.signal);
        if (controller.signal.aborted) return;
        const { videos } = res;
        for (const video of videos) {
          if (seen.get(video.id) === "generating" && video.status === "ready") {
            toast.success("Your AI video lesson is ready", {
              description: "Watch, download MP4, or review in AI Video Maker.",
            });
          }
          seen.set(video.id, video.status);
        }
        const jobs = videos.filter((video) => video.status === "generating");
        if (jobs.length) {
          delay = 3500;
          const now = Date.now();
          const due = jobs
            .filter((video) => (!video.retryAt || video.retryAt <= now) && now - (kickedAt.get(video.id) ?? 0) >= 45000)
            .slice(0, 3);
          await Promise.all(
            due.map(async (video) => {
              kickedAt.set(video.id, now);
              try {
                await videoRequest(`/api/lamtube/${video.id}`, { action: "start" }, controller.signal);
              } catch (error) {
                kickedAt.delete(video.id);
                throw error;
              }
            })
          );
        }
      } catch (error) {
        // Guests in production receive expected 401; stay silent without polluting library error for guests unless explicitly authed.
        if (!controller.signal.aborted && scope !== "guest") {
          libraryError(scope, (error as Error).message);
        }
        delay = 30000;
      } finally {
        busy = false;
        if (!controller.signal.aborted) {
          timer = setTimeout(() => void poll(), retrySoon ? 1000 : delay);
          retrySoon = false;
        }
      }
    }

    const wake = () => {
      void poll();
    };
    const visible = () => {
      if (!document.hidden) wake();
    };
    window.addEventListener("scholar:lamtube-jobs", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", visible);
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener("scholar:lamtube-jobs", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [scope]);
  return null;
}
