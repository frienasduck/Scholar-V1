import { z } from "zod";
import { librarySchema, trackSchema, emptyLibrary } from "./model";
import { focusSchema } from "./focus";
import { musicDefaults, type MusicState } from "../music-store";
const summarySchema = z.object({ id: z.string(), seconds: z.number().min(60).max(10800), breakSeconds: z.number().min(0).max(3600), goal: z.string().max(180), subject: z.string().max(80), chapter: z.string().max(120), music: z.string().max(240), at: z.number().finite() });
const snapshotSchema = z.object({
  library: librarySchema, cloudRevision: z.number().int().nonnegative().default(0), dirty: z.boolean().default(false),
  queue: z.array(trackSchema).max(200), queueIndex: z.number().int().nonnegative(), currentTime: z.number().finite().transform(value => Math.max(0, Math.min(604800, value))),
  volume: z.number().min(0).max(100), muted: z.boolean(), repeatMode: z.enum(["off", "all", "one"]), shuffle: z.boolean(),
  widgetClosed: z.boolean().default(false),
  widgetPosition: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  focus: focusSchema.nullable(), focusHistory: z.array(summarySchema).max(30),
  ambience: z.object({ rain: z.number().min(0).max(100), brown: z.number().min(0).max(100), white: z.number().min(0).max(100), ocean: z.number().min(0).max(100) }),
});
export const musicStorageKey = (owner: string) => `scholar:study-music:v2:${owner}`;
export function restoreMusic(owner: string): Partial<MusicState> {
  const fresh = { ...musicDefaults(), library: emptyLibrary(), owner, hydrated: true, libraryVersion: 0, cloudRevision: 0 };
  try {
    const raw = localStorage.getItem(musicStorageKey(owner));
    if (!raw || raw.length > 1024 * 1024) return fresh;
    const saved = snapshotSchema.parse(JSON.parse(raw)), queueIndex = Math.min(saved.queueIndex, Math.max(0, saved.queue.length - 1));
    return { ...fresh, ...saved, queueIndex, currentTrack: saved.widgetClosed ? null : saved.queue[queueIndex] ?? null, isPlaying: false, ambienceEnabled: false, widgetVisible: !saved.widgetClosed && !!saved.queue.length, widgetMinimized: true, libraryVersion: saved.dirty ? 1 : 0, seekRequest: { time: saved.currentTime, nonce: 1 } };
  } catch { return fresh; }
}
export function persistMusic(state: MusicState, syncedVersion: number): boolean {
  if (!state.hydrated || !state.owner) return true;
  try {
    const snapshot = { library: state.library, cloudRevision: state.cloudRevision, dirty: state.libraryVersion > syncedVersion, widgetClosed: !state.widgetVisible, queue: state.queue, queueIndex: state.queueIndex, currentTime: state.currentTime, volume: state.volume, muted: state.muted, repeatMode: state.repeatMode, shuffle: state.shuffle, widgetPosition: state.widgetPosition, focus: state.focus, focusHistory: state.focusHistory, ambience: state.ambience };
    localStorage.setItem(musicStorageKey(state.owner), JSON.stringify(snapshot)); return true;
  } catch { return false; }
}
