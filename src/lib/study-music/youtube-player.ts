import { VIDEO_ID } from "./model";
export function youtubeVideoRequest(videoId: string, seconds = 0) {
  if (!VIDEO_ID.test(videoId)) throw new Error("A valid YouTube video is required.");
  return { videoId, startSeconds: Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0 };
}
export interface YouTubePlayer {
  playVideo(): void; pauseVideo(): void; cueVideoById(data: { videoId: string; startSeconds?: number }): void;
  loadVideoById(data: { videoId: string; startSeconds?: number }): void; seekTo(time: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void; mute(): void; unMute(): void;
  getCurrentTime(): number; getDuration(): number; destroy(): void;
}
export interface YouTubeWindow extends Window {
  YT?: { Player: new (host: HTMLElement, config: { videoId: string; width: string; height: string; playerVars: Record<string, string | number>; events: { onReady: (event: { target: YouTubePlayer }) => void; onStateChange: (event: { data: number }) => void; onError: (event: { data: number }) => void; onAutoplayBlocked?: () => void } }) => YouTubePlayer };
  onYouTubeIframeAPIReady?: () => void;
}
let loading: Promise<void> | null = null;
export function loadYouTubeAPI(): Promise<void> {
  const w = window as YouTubeWindow;
  if (w.YT?.Player) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const previous = w.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => { loading = null; reject(new Error("YouTube took too long to load. Check your connection and retry.")); }, 15000);
    w.onYouTubeIframeAPIReady = () => { try { previous?.(); } finally { clearTimeout(timeout); resolve(); } };
    let script = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (!script) { script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; script.async = true; document.head.appendChild(script); }
    script.addEventListener("error", () => { clearTimeout(timeout); loading = null; script?.remove(); reject(new Error("YouTube could not be loaded. Check your connection.")); }, { once: true });
  });
  return loading;
}
