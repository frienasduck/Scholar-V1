"use client";

export type TransitionAudioSource =
  | { type: "youtube"; videoId: string; start: number; end: number }
  | { type: "local"; src: string; start?: number; end?: number };

export type TransitionAudioStatus = "loading" | "playing" | "blocked" | "failed" | "stopped";

export type PlayTransitionAudioOptions = {
  source: TransitionAudioSource;
  volume?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  onStatus?: (status: TransitionAudioStatus) => void;
};

type YouTubePlayer = {
  loadVideoById: (options: { videoId: string; startSeconds: number; endSeconds: number }) => void;
  playVideo: () => void;
  stopVideo: () => void;
  destroy: () => void;
  getCurrentTime: () => number;
  setVolume: (volume: number) => void;
};

type YouTubeWindow = Window & {
  YT?: {
    Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer;
    PlayerState: { PLAYING: number };
  };
  onYouTubeIframeAPIReady?: () => void;
};

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube requires a browser"));
  const browserWindow = window as YouTubeWindow;
  if (browserWindow.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<void>((resolve, reject) => {
    const previousReady = browserWindow.onYouTubeIframeAPIReady;
    browserWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("The YouTube player API could not load"));
      document.head.appendChild(script);
    }

    window.setTimeout(() => {
      if (browserWindow.YT?.Player) resolve();
      else reject(new Error("The YouTube player API timed out"));
    }, 8_000);
  }).catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });

  return youtubeApiPromise;
}

class CinematicAudioController {
  private player: YouTubePlayer | null = null;
  private localAudio: HTMLAudioElement | null = null;
  private host: HTMLDivElement | null = null;
  private monitor: number | null = null;
  private fadeTimer: number | null = null;
  private startWatchdog: number | null = null;
  private visibilityHandler: (() => void) | null = null;
  private lifecycleHandler: (() => void) | null = null;
  private playToken = 0;
  private lastOptions: PlayTransitionAudioOptions | null = null;

  async play(options: PlayTransitionAudioOptions): Promise<void> {
    this.stop(0);
    const token = ++this.playToken;
    this.lastOptions = options;
    options.onStatus?.("loading");

    this.visibilityHandler = () => {
      if (document.hidden) this.stop(0);
    };
    this.lifecycleHandler = () => this.stop(0);
    document.addEventListener("visibilitychange", this.visibilityHandler);
    window.addEventListener("pagehide", this.lifecycleHandler, { once: true });
    window.addEventListener("popstate", this.lifecycleHandler, { once: true });

    try {
      if (options.source.type === "local") await this.playLocal(options, token);
      else await this.playYouTube(options, token);
    } catch {
      if (token === this.playToken) {
        options.onStatus?.("failed");
        this.stop(0);
      }
    }
  }

  retryAfterGesture(): void {
    if (!this.lastOptions) return;
    void this.play(this.lastOptions);
  }

  setVolume(volume: number): void {
    const safeVolume = Math.max(0, Math.min(100, volume));
    try { this.player?.setVolume(safeVolume); } catch { /* player may already be gone */ }
    if (this.localAudio) this.localAudio.volume = safeVolume / 100;
  }

  stop(fadeOutMs = 250): void {
    ++this.playToken;
    const finish = () => {
      if (this.monitor !== null) window.clearInterval(this.monitor);
      if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
      if (this.startWatchdog !== null) window.clearTimeout(this.startWatchdog);
      this.monitor = this.fadeTimer = this.startWatchdog = null;
      try { this.player?.stopVideo(); } catch { /* already unavailable */ }
      try { this.player?.destroy(); } catch { /* already unavailable */ }
      this.player = null;
      if (this.localAudio) {
        this.localAudio.pause();
        this.localAudio.src = "";
      }
      this.localAudio = null;
      this.host?.remove();
      this.host = null;
      if (this.visibilityHandler) document.removeEventListener("visibilitychange", this.visibilityHandler);
      if (this.lifecycleHandler) {
        window.removeEventListener("pagehide", this.lifecycleHandler);
        window.removeEventListener("popstate", this.lifecycleHandler);
      }
      this.visibilityHandler = this.lifecycleHandler = null;
    };

    if (typeof window === "undefined" || fadeOutMs <= 0 || (!this.player && !this.localAudio)) {
      finish();
      return;
    }

    const started = performance.now();
    const startVolume = this.localAudio ? this.localAudio.volume * 100 : 65;
    if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
    this.fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / fadeOutMs);
      this.setVolume(startVolume * (1 - progress));
      if (progress >= 1) finish();
    }, 40);
  }

  private async playYouTube(options: PlayTransitionAudioOptions, token: number): Promise<void> {
    await loadYouTubeApi();
    if (token !== this.playToken || options.source.type !== "youtube") return;
    const browserWindow = window as YouTubeWindow;
    if (!browserWindow.YT?.Player) throw new Error("YouTube player unavailable");

    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, {
      position: "fixed", width: "200px", height: "200px", left: "-10000px", top: "0",
      opacity: "0", pointerEvents: "none", overflow: "hidden",
    });
    document.body.appendChild(host);
    this.host = host;

    const source = options.source;
    const targetVolume = Math.max(0, Math.min(100, options.volume ?? 65));
    let playbackConfirmed = false;
    this.player = new browserWindow.YT.Player(host, {
      width: 200,
      height: 200,
      videoId: source.videoId,
      playerVars: {
        autoplay: 1, controls: 0, disablekb: 1, playsinline: 1, rel: 0,
        start: source.start, end: source.end, origin: window.location.origin,
      },
      events: {
        onReady: () => {
          if (token !== this.playToken || !this.player) return;
          this.player.setVolume(0);
          this.player.loadVideoById({ videoId: source.videoId, startSeconds: source.start, endSeconds: source.end });
          this.player.playVideo();
        },
        onStateChange: (event: { data: number }) => {
          if (token !== this.playToken || !this.player || event.data !== browserWindow.YT?.PlayerState.PLAYING) return;
          playbackConfirmed = true;
          options.onStatus?.("playing");
          this.fadeTo(targetVolume, options.fadeInMs ?? 700, token);
        },
        onError: () => {
          if (token === this.playToken) {
            options.onStatus?.("failed");
            this.stop(0);
          }
        },
      },
    });

    this.startWatchdog = window.setTimeout(() => {
      if (token === this.playToken && !playbackConfirmed) {
        options.onStatus?.("blocked");
        this.stop(0);
      }
    }, 2_000);

    this.monitor = window.setInterval(() => {
      if (token !== this.playToken || !this.player) return;
      let currentTime = 0;
      try { currentTime = this.player.getCurrentTime() || 0; } catch { return; }
      const fadeOutSeconds = (options.fadeOutMs ?? 1_000) / 1_000;
      if (currentTime >= source.end) {
        options.onStatus?.("stopped");
        this.stop(0);
      } else if (currentTime >= source.end - fadeOutSeconds) {
        const remainingRatio = Math.max(0, (source.end - currentTime) / fadeOutSeconds);
        this.setVolume(targetVolume * remainingRatio);
      }
    }, 100);
  }

  private async playLocal(options: PlayTransitionAudioOptions, token: number): Promise<void> {
    if (options.source.type !== "local") return;
    const audio = new Audio(options.source.src);
    this.localAudio = audio;
    audio.preload = "auto";
    audio.volume = 0;
    audio.currentTime = options.source.start ?? 0;
    await audio.play();
    if (token !== this.playToken) return;
    options.onStatus?.("playing");
    const targetVolume = Math.max(0, Math.min(100, options.volume ?? 65));
    this.fadeTo(targetVolume, options.fadeInMs ?? 700, token);
    const end = options.source.end;
    if (end !== undefined) {
      this.monitor = window.setInterval(() => {
        if (!this.localAudio || token !== this.playToken) return;
        const fadeOutSeconds = (options.fadeOutMs ?? 1_000) / 1_000;
        if (this.localAudio.currentTime >= end) this.stop(0);
        else if (this.localAudio.currentTime >= end - fadeOutSeconds) {
          this.setVolume(targetVolume * Math.max(0, (end - this.localAudio.currentTime) / fadeOutSeconds));
        }
      }, 100);
    }
  }

  private fadeTo(target: number, durationMs: number, token: number): void {
    const started = performance.now();
    if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
    this.fadeTimer = window.setInterval(() => {
      if (token !== this.playToken) return;
      const progress = Math.min(1, (performance.now() - started) / durationMs);
      this.setVolume(target * progress);
      if (progress >= 1 && this.fadeTimer !== null) {
        window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
    }, 40);
  }
}

export const transitionAudio = new CinematicAudioController();
