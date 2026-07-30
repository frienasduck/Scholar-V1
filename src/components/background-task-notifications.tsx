"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Sparkles, X } from "lucide-react";
import {
  announceBackgroundTaskCompletion,
  completeBackgroundTask,
  markBackgroundTasksViewed,
  useBackgroundTasks,
  type ScholarBackgroundTask,
} from "@/lib/background-tasks";
import { cn } from "@/lib/utils";

export function BackgroundTaskNotifications({
  onNavigate,
}: {
  onNavigate: (viewId: string) => void;
}) {
  const tasks = useBackgroundTasks();
  const shown = useRef(new Set<string>());
  const [visible, setVisible] = useState<ScholarBackgroundTask | null>(null);

  useEffect(() => {
    const onExternalComplete = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; message?: string }>)
        .detail;
      if (detail?.id) completeBackgroundTask(detail.id, detail.message);
    };
    const onExternalFinished = (event: Event) => {
      const detail = (event as CustomEvent<{
        kind?: string;
        title?: string;
        message?: string;
        viewId?: string;
      }>).detail;
      if (!detail?.title || !detail.viewId) return;
      announceBackgroundTaskCompletion({
        kind: detail.kind || "generation",
        title: detail.title,
        message: detail.message || "Your background task is ready.",
        viewId: detail.viewId,
      });
    };
    window.addEventListener("scholar:background-task:complete", onExternalComplete);
    window.addEventListener("scholar:background-task:finished", onExternalFinished);
    return () => {
      window.removeEventListener(
        "scholar:background-task:complete",
        onExternalComplete,
      );
      window.removeEventListener(
        "scholar:background-task:finished",
        onExternalFinished,
      );
    };
  }, []);

  useEffect(() => {
    if (visible) return;
    const next = [...tasks]
      .reverse()
      .find(
        (task) =>
          task.status === "complete" &&
          !task.read &&
          !shown.current.has(task.id),
      );
    if (!next) return;
    shown.current.add(next.id);
    setVisible(next);
  }, [tasks, visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(null), 1700);
    return () => window.clearTimeout(timer);
  }, [visible]);

  const openResult = () => {
    if (!visible) return;
    if (visible.toolId) {
      try {
        sessionStorage.setItem("scholar-ai-tools-open", visible.toolId);
      } catch {
        // Navigation still works when storage is unavailable.
      }
    }
    markBackgroundTasksViewed(visible.viewId);
    onNavigate(visible.viewId);
    setVisible(null);
  };

  return (
    <div
      className="pointer-events-none z-[96] flex shrink-0 justify-center px-3 lg:justify-start lg:px-4"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key={visible.id}
            data-testid="background-task-notification"
            initial={{ opacity: 0, y: -14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cn(
              "pointer-events-auto relative my-2 w-full max-w-[25rem] overflow-hidden rounded-[1.4rem]",
              "border border-cyan-200/20 bg-slate-950/78 text-white shadow-[0_18px_55px_rgba(2,8,23,.4),0_0_24px_rgba(34,211,238,.12)]",
              "backdrop-blur-2xl supports-[backdrop-filter]:bg-slate-950/66",
            )}
          >
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent" />
            <button
              type="button"
              onClick={openResult}
              className="flex min-h-[4.35rem] w-full items-center gap-3 px-3.5 py-3 pr-11 text-left"
              aria-label={`Open ${visible.title}`}
            >
              <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10">
                <Sparkles className="h-4 w-4 text-cyan-200" />
                <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-400 text-slate-950">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold tracking-tight">
                  {visible.title}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-white/58">
                  {visible.message}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/45" />
            </button>
            <button
              type="button"
              onClick={() => setVisible(null)}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
