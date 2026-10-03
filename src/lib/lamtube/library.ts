"use client";
import { useSyncExternalStore } from "react";
import { videoRequest } from "./client";
import type { VideoState } from "./model";
export type VideoUsage = { used: number; limit: number | null; remaining: number | null; period: string; timezone: string };
type Library = { scope: string; videos: VideoState[]; usage: VideoUsage | null; error: string };
const empty: Library = { scope: "", videos: [], usage: null, error: "" };
let library = empty;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
export function libraryScope(scope: string) {
  if (library.scope === scope) return;
  library = { ...empty, scope };
  emit();
}
export function newestVideos(videos: VideoState[]) {
  return [...videos].sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
}
export function reconcileVideos(incoming: VideoState[], current: VideoState[]) {
  const byId = new Map(current.map((video) => [video.id, video]));
  return newestVideos(incoming.map((video) => {
    const saved = byId.get(video.id);
    return saved && saved.revision > video.revision ? saved : video;
  }));
}
export function retainLibraryVideo(scope: string, video: VideoState) {
  if (library.scope !== scope || video.id === "preview") return;
  const previous = library.videos.find((saved) => saved.id === video.id);
  if (previous && previous.revision > video.revision) return;
  library = { ...library, videos: newestVideos([video, ...library.videos.filter((v) => v.id !== video.id)]) };
  emit();
  // Watch-position and notes sync must not turn an idle shell into a fetch loop.
  if (video.status !== previous?.status && (video.status === "generating" || previous?.status === "generating"))
    window.dispatchEvent(new Event("scholar:lamtube-jobs"));
}
export async function refreshVideoLibrary(scope: string, signal?: AbortSignal) {
  const data = await videoRequest("/api/lamtube", undefined, signal);
  if (library.scope === scope && !signal?.aborted) {
    library = { scope, videos: reconcileVideos(data.videos, library.videos), usage: data.usage, error: "" };
    emit();
  }
  return data as { videos: VideoState[]; usage: VideoUsage };
}
export function libraryError(scope: string, error: string) {
  if (library.scope !== scope) return;
  library = { ...library, error };
  emit();
}
export function useVideoLibrary(scope: string) {
  const value = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => library,
    () => empty,
  );
  return value.scope === scope ? value : empty;
}
export function videoScope(authed: boolean, email: string, username: string) {
  return authed ? `account:${email || username}` : "guest";
}
