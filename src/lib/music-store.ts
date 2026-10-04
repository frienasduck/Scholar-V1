import { create } from "zustand";
import { cleanTrack, emptyLibrary, type MusicLibrary, type MusicTrack } from "./study-music/model";
import { advanceFocus, toggleFocusPause, type FocusSession } from "./study-music/focus";
import type { Position } from "./study-music/position";
export type { MusicTrack } from "./study-music/model";
export type Ambience = "rain" | "brown" | "white" | "ocean";
export type FocusSummary = { id: string; seconds: number; breakSeconds: number; goal: string; subject: string; chapter: string; music: string; at: number };
export interface MusicState {
  owner: string; hydrated: boolean; library: MusicLibrary; libraryVersion: number;
  syncStatus: "local" | "loading" | "synced" | "unavailable" | "conflict"; cloudRevision: number;
  queue: MusicTrack[]; queueIndex: number; currentTrack: MusicTrack | null;
  isPlaying: boolean; currentTime: number; duration: number; volume: number; muted: boolean;
  repeatMode: "off" | "all" | "one"; shuffle: boolean; playedIndices: number[]; buffering: boolean; error: string | null;
  seekRequest: { time: number; nonce: number }; playNonce: number;
  widgetVisible: boolean; widgetMinimized: boolean; widgetExpanded: boolean; widgetPosition: Position;
  drawer: "queue" | "mixer" | "quick" | null;
  ambience: Record<Ambience, number>; ambienceEnabled: boolean;
  focus: FocusSession | null; focusHistory: FocusSummary[];
  playTrack: (track: MusicTrack, queue?: MusicTrack[]) => void;
  togglePlay: () => void; setPlaying: (playing: boolean) => void; setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void; setVolume: (vol: number) => void; toggleMute: () => void;
  next: (ended?: boolean) => void; prev: () => void; stop: () => void; closeWidget: () => void;
  setWidgetVisible: (v: boolean) => void; toggleMinimize: () => void; toggleExpand: () => void; setWidgetPosition: (pos: Position) => void;
  setRepeatMode: (mode: "off" | "all" | "one") => void; toggleShuffle: () => void;
  setBuffering: (value: boolean) => void; setError: (error: string | null) => void; seekTo: (time: number) => void;
  addToQueue: (track: MusicTrack, next?: boolean) => void; removeQueue: (index: number) => void; moveQueue: (index: number, direction: number) => void; clearQueue: () => void;
  addSong: (track: MusicTrack) => boolean; removeSong: (id: string) => void; moveSong: (index: number, direction: number) => void; renameSong: (id: string, title: string) => void;
  favorite: (id: string) => void; createPlaylist: (name: string, ids: string[]) => void; updatePlaylist: (id: string, name: string, ids: string[]) => void; removePlaylist: (id: string) => void; playlistAdd: (id: string, trackId: string) => void; playlistRemove: (id: string, trackId: string) => void;
  setDrawer: (drawer: MusicState["drawer"]) => void; setAmbience: (key: Ambience, value: number) => void; toggleAmbience: () => void;
  startFocus: (minutes: number, breakMinutes: number, context?: Partial<Pick<FocusSession, "goal" | "subject" | "chapter" | "pauseMusicOnBreak">>) => void;
  pauseFocus: () => void; cancelFocus: () => void; tickFocus: () => void; recordFocus: () => FocusSummary | null;
}

export const musicDefaults = () => ({ queue: [] as MusicTrack[], queueIndex: 0, currentTrack: null as MusicTrack | null, isPlaying: false, currentTime: 0, duration: 0, volume: 70, muted: false, repeatMode: "off" as const, shuffle: false, playedIndices: [] as number[], buffering: false, error: null as string | null, seekRequest: { time: 0, nonce: 0 }, playNonce: 0, widgetVisible: false, widgetMinimized: false, widgetExpanded: false, widgetPosition: { x: 1, y: 1 }, drawer: null, ambience: { rain: 0, brown: 0, white: 0, ocean: 0 }, ambienceEnabled: false, focus: null as FocusSession | null, focusHistory: [] as FocusSummary[] });
export const useMusicStore = create<MusicState>((set, get) => {
  const editLibrary = (fn: (lib: MusicLibrary) => MusicLibrary) => set(s => ({ library: fn(s.library), libraryVersion: s.libraryVersion + 1 }));
  const history = (track: MusicTrack) => editLibrary(lib => ({ ...lib, history: [{ id: track.id, at: Date.now() }, ...lib.history.filter(h => h.id !== track.id)].slice(0, 30) }));
  const selectIndex = (index: number) => {
    const s = get(), track = s.queue[index]; if (!track) return;
    set({ queueIndex: index, currentTrack: track, currentTime: 0, duration: 0, seekRequest: { time: 0, nonce: 0 }, isPlaying: true, widgetMinimized: false, widgetExpanded: false, widgetVisible: true, error: null, buffering: false, playNonce: s.playNonce + 1 }); history(track);
  };
  return {
    ...musicDefaults(), owner: "", hydrated: false, library: emptyLibrary(), libraryVersion: 0, syncStatus: "local", cloudRevision: 0,
    playTrack(track, supplied) {
      track = cleanTrack(track);
      const queue = (supplied?.length ? supplied : [track]).slice(0, 200).map(cleanTrack);
      if (!queue.some(t => t.id === track.id)) { queue.unshift(track); queue.length = Math.min(queue.length, 200); }
      set({ queue, queueIndex: queue.findIndex(t => t.id === track.id), currentTrack: track, currentTime: 0, duration: 0, seekRequest: { time: 0, nonce: 0 }, isPlaying: true, widgetVisible: true, widgetMinimized: false, widgetExpanded: false, error: null, buffering: false, playedIndices: [], playNonce: get().playNonce + 1 }); history(track);
    },
    togglePlay: () => set(s => ({ isPlaying: !!s.currentTrack && !s.isPlaying, widgetVisible: !!s.currentTrack, playNonce: s.playNonce + 1 })),
    setPlaying: isPlaying => set({ isPlaying }), setCurrentTime: currentTime => set({ currentTime: Number.isFinite(currentTime) ? Math.max(0, Math.min(604800, currentTime)) : 0 }), setDuration: duration => set({ duration: Number.isFinite(duration) && duration > 0 && duration <= 604800 ? duration : 0 }),
    setVolume: volume => set({ volume: Math.min(100, Math.max(0, volume)), muted: volume <= 0 }), toggleMute: () => set(s => ({ muted: !s.muted })),
    next(ended = false) {
      const s = get(); if (!s.queue.length) return;
      if (ended && s.repeatMode === "one") { s.seekTo(0); set({ isPlaying: true }); return; }
      let index = s.queueIndex + 1;
      if (s.shuffle) {
        let available = s.queue.map((_, i) => i).filter(i => s.queue[i].id !== s.currentTrack?.id && !s.playedIndices.includes(i));
        if (!available.length && s.repeatMode === "all") { available = s.queue.map((_, i) => i).filter(i => s.queue[i].id !== s.currentTrack?.id); set({ playedIndices: [] }); }
        if (!available.length) { if (s.queue.length === 1 && s.repeatMode === "all") { s.seekTo(0); set({ isPlaying: true }); return; } set({ isPlaying: false }); return; }
        index = available[Math.floor(Math.random() * available.length)]; set(state => ({ playedIndices: [...state.playedIndices, s.queueIndex] }));
      } else if (index >= s.queue.length) { if (s.repeatMode === "all") index = 0; else { set({ isPlaying: false }); return; } }
      selectIndex(index);
    },
    prev() { const s = get(); if (s.currentTime > 3) { s.seekTo(0); return; } if (s.queue.length) selectIndex(Math.max(0, s.queueIndex - 1)); },
    stop() { get().seekTo(0); set({ isPlaying: false }); },
    closeWidget: () => set({ isPlaying: false, widgetVisible: false, currentTrack: null, widgetMinimized: false, widgetExpanded: false }),
    setWidgetVisible: widgetVisible => set({ widgetVisible, ...(!widgetVisible ? { isPlaying: false } : {}) }),
    toggleMinimize: () => set(s => ({ widgetMinimized: !s.widgetMinimized, widgetExpanded: false })),
    toggleExpand: () => set(s => ({ widgetExpanded: !s.widgetExpanded, widgetMinimized: false })), setWidgetPosition: widgetPosition => set({ widgetPosition }),
    setRepeatMode: repeatMode => set({ repeatMode }), toggleShuffle: () => set(s => ({ shuffle: !s.shuffle, playedIndices: [] })),
    setBuffering: buffering => set({ buffering }), setError: error => set({ error, ...(error ? { isPlaying: false, buffering: false } : {}) }),
    seekTo(time) { const s = get(); const safe = Math.max(0, Math.min(s.duration || Number.MAX_SAFE_INTEGER, time)); set({ currentTime: safe, seekRequest: { time: safe, nonce: s.seekRequest.nonce + 1 } }); },
    addToQueue(track, next = false) {
      const s = get(); track = cleanTrack(track);
      if (!s.currentTrack) { set({ queue: [track], currentTrack: track, queueIndex: 0, currentTime: 0, duration: 0, seekRequest: { time: 0, nonce: 0 }, widgetMinimized: false, widgetVisible: true }); return; }
      if (s.queue.length >= 200) return;
      const queue = [...s.queue]; queue.splice(next ? s.queueIndex + 1 : queue.length, 0, track); set({ queue, playedIndices: [] });
    },
    removeQueue(index) {
      const s = get(); if (index === s.queueIndex) return;
      set({ queue: s.queue.filter((_, i) => i !== index), queueIndex: index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex, playedIndices: [] });
    },
    moveQueue(index, direction) {
      const s = get(), target = index + direction;
      if (target < 0 || target >= s.queue.length) return;
      const queue = [...s.queue]; [queue[index], queue[target]] = [queue[target], queue[index]];
      const queueIndex = s.queueIndex === index ? target : s.queueIndex === target ? index : s.queueIndex;
      set({ queue, queueIndex, playedIndices: [] });
    },
    clearQueue() { const t = get().currentTrack; set({ queue: t ? [t] : [], queueIndex: 0, playedIndices: [] }); },
    addSong(track) { const s = get(); if (s.library.songs.some(t => t.id === track.id) || s.library.songs.length >= 400) return false; editLibrary(lib => ({ ...lib, songs: [...lib.songs, cleanTrack(track)] })); return true; },
    removeSong: id => editLibrary(lib => ({ ...lib, songs: lib.songs.filter(t => t.id !== id), favorites: lib.favorites.filter(i => i !== id), playlists: lib.playlists.map(p => ({ ...p, trackIds: p.trackIds.filter(i => i !== id) })) })),
    moveSong(index, direction) { const songs = [...get().library.songs], target = index + direction; if (target < 0 || target >= songs.length) return; [songs[index], songs[target]] = [songs[target], songs[index]]; editLibrary(lib => ({ ...lib, songs })); },
    renameSong: (id, title) => editLibrary(lib => ({ ...lib, songs: lib.songs.map(t => t.id === id ? { ...t, displayTitle: title.trim().slice(0, 160) } : t) })),
    favorite: id => editLibrary(lib => ({ ...lib, favorites: lib.favorites.includes(id) ? lib.favorites.filter(v => v !== id) : [...lib.favorites, id].slice(0, 400) })),
    createPlaylist: (name, trackIds) => { if (name.trim() && get().library.playlists.length < 40) editLibrary(lib => ({ ...lib, playlists: [...lib.playlists, { id: crypto.randomUUID(), name: name.trim().slice(0, 80), trackIds: trackIds.slice(0, 200) }] })); },
    updatePlaylist: (id, name, trackIds) => { if (name.trim()) editLibrary(lib => ({ ...lib, playlists: lib.playlists.map(p => p.id === id ? { ...p, name: name.trim().slice(0, 80), trackIds: trackIds.slice(0, 200) } : p) })); },
    removePlaylist: id => editLibrary(lib => ({ ...lib, playlists: lib.playlists.filter(p => p.id !== id) })),
    playlistAdd: (id, trackId) => editLibrary(lib => ({ ...lib, playlists: lib.playlists.map(p => p.id === id && !p.trackIds.includes(trackId) ? { ...p, trackIds: [...p.trackIds, trackId].slice(0, 200) } : p) })),
    playlistRemove: (id, trackId) => editLibrary(lib => ({ ...lib, playlists: lib.playlists.map(p => p.id === id ? { ...p, trackIds: p.trackIds.filter(t => t !== trackId) } : p) })),
    setDrawer: drawer => set(s => ({ drawer, ...(drawer && s.currentTrack?.mediaSource === "YOUTUBE_VIDEO_SOURCE" ? { isPlaying: false } : {}) })), setAmbience: (key, value) => set(s => ({ ambience: { ...s.ambience, [key]: Math.max(0, Math.min(100, value)) } })), toggleAmbience: () => set(s => ({ ambienceEnabled: !s.ambienceEnabled })),
    startFocus(minutes, breakMinutes, context = {}) {
      const now = Date.now(), studySeconds = Math.max(60, Math.min(10800, Math.round(minutes * 60))), breakSeconds = Math.max(0, Math.min(3600, Math.round(breakMinutes * 60)));
      set({ focus: { id: crypto.randomUUID(), goal: (context.goal ?? "Focused study").slice(0, 180), subject: (context.subject ?? "").slice(0, 80), chapter: (context.chapter ?? "").slice(0, 120), studySeconds, breakSeconds, phase: "study", deadline: now + studySeconds * 1000, remaining: studySeconds, paused: false, startedAt: now, music: get().currentTrack?.title ?? "Native ambience / silence", pauseMusicOnBreak: !!context.pauseMusicOnBreak, recorded: false } });
    },
    pauseFocus() { const s = get().focus; if (s) set({ focus: toggleFocusPause(s, Date.now()) }); }, cancelFocus: () => set({ focus: null }),
    tickFocus() { const s = get().focus; if (!s) return; const focus = advanceFocus(s, Date.now()); if (focus !== s) set({ focus, ...(focus.phase === "break" && focus.pauseMusicOnBreak ? { isPlaying: false } : {}) }); },
    recordFocus() {
      const s = get(), f = s.focus; if (!f || f.recorded || f.phase === "study") return null;
      const summary: FocusSummary = { id: f.id, seconds: f.studySeconds, breakSeconds: f.breakSeconds, goal: f.goal, subject: f.subject, chapter: f.chapter, music: f.music, at: Date.now() };
      set({ focus: { ...f, recorded: true }, focusHistory: [summary, ...s.focusHistory].slice(0, 30) }); return summary;
    },
  };
});
