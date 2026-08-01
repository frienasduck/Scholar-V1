"use client";

import { useEffect, useRef } from "react";
import {
  announceBackgroundTaskCompletion,
  completeBackgroundTask,
  markBackgroundTasksViewed,
  useBackgroundTasks,
  type ScholarBackgroundTask,
} from "@/lib/background-tasks";
import { notify } from "@/lib/notifications/notification-api";

export function BackgroundTaskNotifications({
  onNavigate,
}: {
  onNavigate: (viewId: string) => void;
}) {
  const tasks = useBackgroundTasks();
  const shown = useRef(new Set<string>());
  const navigate = useRef(onNavigate);

  useEffect(() => {
    navigate.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    const onExternalComplete = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; message?: string }>).detail;
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
      window.removeEventListener("scholar:background-task:complete", onExternalComplete);
      window.removeEventListener("scholar:background-task:finished", onExternalFinished);
    };
  }, []);

  useEffect(() => {
    const finished = tasks.filter(
      (task) => task.status !== "running" && !shown.current.has(task.id),
    );
    for (const task of finished) {
      shown.current.add(task.id);
      const openResult = () => {
        if (task.toolId) {
          try {
            sessionStorage.setItem("scholar-ai-tools-open", task.toolId);
          } catch {
            // Navigation remains available when storage is restricted.
          }
        }
        markBackgroundTasksViewed(task.viewId);
        navigate.current(task.viewId);
      };
      const options = {
        description: task.message,
        duration: 5_000,
        action: { label: "Open", onClick: openResult },
      };
      if (task.status === "failed") notify.error(task.title, options);
      else notify.success(task.title, options);
    }
  }, [tasks]);

  return null;
}

export type { ScholarBackgroundTask };
