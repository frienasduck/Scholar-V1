// Global music store — shared between Study Music view and floating widget.
// Only ONE YouTube player instance exists, mounted in the FloatingMusicWidget.

import { create } from "zustand";

export interface MusicTrack {
  id: string;       // YouTube video ID
  title: string;
  artist: string;
  category: string;
  thumbnail: string;
}

interface MusicState {
  // Queue
  queue: MusicTrack[];
  queueIndex: number;
  currentTrack: MusicTrack | null;

  // Playback
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeatMode: "off" | "all" | "one";
  shuffle: boolean;
  buffering: boolean;
  error: string | null;

  // Widget UI
  widgetVisible: boolean;
  widgetMinimized: boolean;
  widgetExpanded: boolean;
  widgetPosition: { x: number; y: number };

  // Actions
  playTrack: (track: MusicTrack, queue?: MusicTrack[]) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  closeWidget: () => void;
  setWidgetVisible: (v: boolean) => void;
  toggleMinimize: () => void;
  toggleExpand: () => void;
  setWidgetPosition: (pos: { x: number; y: number }) => void;
  setRepeatMode: (mode: "off" | "all" | "one") => void;
  toggleShuffle: () => void;
  setBuffering: (b: boolean) => void;
  setError: (e: string | null) => void;
  seekTo: (time: number) => void;
}

export const useMusicStore = create<MusicState>((set, get) => ({
  queue: [],
  queueIndex: 0,
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 70,
  muted: false,
  repeatMode: "off",
  shuffle: false,
  buffering: false,
  error: null,
  widgetVisible: false,
  widgetMinimized: false,
  widgetExpanded: false,
  widgetPosition: { x: -1, y: -1 }, // -1 = default position

  playTrack: (track, queue) => {
    const q = queue && queue.length > 0 ? queue : [track];
    const idx = q.findIndex((t) => t.id === track.id);
    set({
      currentTrack: track,
      queue: q,
      queueIndex: idx >= 0 ? idx : 0,
      isPlaying: true,
      widgetVisible: true,
      widgetMinimized: false,
      error: null,
      currentTime: 0,
    });
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (vol) => set({ volume: vol, muted: vol === 0 ? true : false }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),

  next: () => {
    const { queue, queueIndex, repeatMode, shuffle } = get();
    if (queue.length === 0) return;
    if (repeatMode === "one") {
      // Replay same track
      set({ currentTime: 0, isPlaying: true });
      return;
    }
    let nextIdx;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = queueIndex + 1;
      if (nextIdx >= queue.length) {
        if (repeatMode === "all") nextIdx = 0;
        else { set({ isPlaying: false }); return; }
      }
    }
    set({ queueIndex: nextIdx, currentTrack: queue[nextIdx], currentTime: 0, isPlaying: true, error: null });
  },

  prev: () => {
    const { queue, queueIndex, currentTime } = get();
    if (queue.length === 0) return;
    if (currentTime > 3) {
      // Restart current track if more than 3 seconds in
      set({ currentTime: 0 });
      return;
    }
    const prevIdx = queueIndex - 1 < 0 ? queue.length - 1 : queueIndex - 1;
    set({ queueIndex: prevIdx, currentTrack: queue[prevIdx], currentTime: 0, isPlaying: true, error: null });
  },

  stop: () => set({ isPlaying: false, currentTime: 0 }),
  closeWidget: () => set({ isPlaying: false, widgetVisible: false, widgetMinimized: false, widgetExpanded: false, currentTrack: null }),

  setWidgetVisible: (v) => set({ widgetVisible: v }),
  toggleMinimize: () => set((s) => ({ widgetMinimized: !s.widgetMinimized, widgetExpanded: false })),
  toggleExpand: () => set((s) => ({ widgetExpanded: !s.widgetExpanded, widgetMinimized: false })),
  setWidgetPosition: (pos) => set({ widgetPosition: pos }),
  setRepeatMode: (mode) => set({ repeatMode: mode }),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  setBuffering: (b) => set({ buffering: b }),
  setError: (e) => set({ error: e, isPlaying: false }),
  seekTo: (time) => set({ currentTime: time }),
}));
