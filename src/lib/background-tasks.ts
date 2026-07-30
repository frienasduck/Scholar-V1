"use client";

import { useSyncExternalStore } from "react";

export type BackgroundTaskStatus = "running" | "complete" | "failed";

export type ScholarBackgroundTask = {
  id: string;
  kind: string;
  title: string;
  message: string;
  viewId: string;
  toolId?: string;
  status: BackgroundTaskStatus;
  createdAt: number;
  finishedAt?: number;
  read: boolean;
};

type StartTaskInput = Pick<
  ScholarBackgroundTask,
  "kind" | "title" | "message" | "viewId" | "toolId"
>;

const listeners = new Set<() => void>();
let tasks: ScholarBackgroundTask[] = [];

function emit() {
  listeners.forEach((listener) => listener());
}

function updateTask(
  id: string,
  update: Partial<ScholarBackgroundTask>,
): ScholarBackgroundTask | undefined {
  let changed: ScholarBackgroundTask | undefined;
  tasks = tasks.map((task) => {
    if (task.id !== id) return task;
    changed = { ...task, ...update };
    return changed;
  });
  if (changed) emit();
  return changed;
}

export function beginBackgroundTask(input: StartTaskInput): string {
  const id = `${input.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  tasks = [
    ...tasks.slice(-39),
    {
      ...input,
      id,
      status: "running",
      createdAt: Date.now(),
      read: false,
    },
  ];
  emit();
  return id;
}

export function announceBackgroundTaskCompletion(
  input: StartTaskInput,
): string {
  const id = beginBackgroundTask(input);
  completeBackgroundTask(id, input.message);
  return id;
}

export function updateBackgroundTask(
  id: string,
  message: string,
): ScholarBackgroundTask | undefined {
  return updateTask(id, { message });
}

export function completeBackgroundTask(
  id: string,
  message?: string,
): ScholarBackgroundTask | undefined {
  return updateTask(id, {
    status: "complete",
    finishedAt: Date.now(),
    ...(message ? { message } : {}),
  });
}

export function failBackgroundTask(
  id: string,
  message?: string,
): ScholarBackgroundTask | undefined {
  return updateTask(id, {
    status: "failed",
    finishedAt: Date.now(),
    ...(message ? { message } : {}),
  });
}

export function markBackgroundTasksViewed(viewId: string) {
  const hasUnread = tasks.some(
    (task) => task.viewId === viewId && task.status === "complete" && !task.read,
  );
  if (!hasUnread) return;
  tasks = tasks.map((task) =>
    task.viewId === viewId && task.status === "complete"
      ? { ...task, read: true }
      : task,
  );
  emit();
}

export function useBackgroundTasks(): ScholarBackgroundTask[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => tasks,
    () => [],
  );
}
