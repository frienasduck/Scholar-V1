import { z } from "zod";

export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export function parseYouTubeUrl(input: string): { id: string; url: string } {
  if (input.length > 2048) throw new Error("That link is too long.");
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error("Paste a complete YouTube link."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("Use a secure YouTube link.");
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1);
  else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (/^\/(shorts|embed)\//.test(url.pathname)) id = url.pathname.split("/")[2];
  }
  if (!id || !VIDEO_ID.test(id)) throw new Error("Use a YouTube video link, not a playlist-only or channel link.");
  return { id, url: `https://www.youtube.com/watch?v=${id}` };
}

export function thumbnailCandidates(id: string, thumbnail?: string): string[] {
  if (!VIDEO_ID.test(id)) return [];
  const safe = thumbnail && /^https:\/\/(i\.ytimg\.com|img\.youtube\.com)\/vi\/[A-Za-z0-9_-]{11}\/(hqdefault|mqdefault|default)\.jpg$/.test(thumbnail) ? thumbnail : null;
  return [...new Set([safe, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, `https://i.ytimg.com/vi/${id}/default.jpg`].filter(Boolean) as string[])];
}

export const NATIVE_TEXTURES = ["rain", "brown", "white", "ocean"] as const;
export type NativeTexture = typeof NATIVE_TEXTURES[number];
const trackFields = z.object({
  title: z.string().trim().min(1).max(240), artist: z.string().trim().min(1).max(160),
  category: z.string().max(40), thumbnail: z.string().max(300).default(""),
  durationSeconds: z.number().int().min(0).max(604800).nullable().optional(),
  source: z.enum(["catalog", "imported", "native"]).optional(), tags: z.array(z.string().max(40)).max(12).optional(),
  displayTitle: z.string().trim().max(160).optional(), addedAt: z.number().finite().optional(),
}).strip();
// Legacy libraries remain valid; restored YouTube tracks gain their source type.
export const trackSchema = z.union([
  trackFields.extend({ id: z.string().regex(VIDEO_ID), mediaSource: z.literal("YOUTUBE_VIDEO_SOURCE").default("YOUTUBE_VIDEO_SOURCE") }),
  trackFields.extend({ id: z.enum(["audio:rain", "audio:brown", "audio:white", "audio:ocean"]), mediaSource: z.literal("AUDIO_SOURCE"), texture: z.enum(NATIVE_TEXTURES), provenance: z.literal("scholar-synthesized") })
    .refine(track => track.id === `audio:${track.texture}`, "Native audio identity must match its texture."),
]);
export type MusicTrack = z.infer<typeof trackSchema>;
const trackIdSchema = z.string().refine(id => VIDEO_ID.test(id) || /^audio:(rain|brown|white|ocean)$/.test(id), "Unknown media identity.");
export const playlistSchema = z.object({ id: z.string().max(80), name: z.string().trim().min(1).max(80), trackIds: z.array(trackIdSchema).max(200) }).strip();
export type MusicPlaylist = z.infer<typeof playlistSchema>;
export const librarySchema = z.object({
  songs: z.array(trackSchema).max(400), playlists: z.array(playlistSchema).max(40),
  favorites: z.array(trackIdSchema).max(400),
  history: z.array(z.object({ id: trackIdSchema, at: z.number().finite() })).max(30),
}).strip().superRefine((value, ctx) => {
  if (new Set(value.songs.map(s => s.id)).size !== value.songs.length || new Set(value.playlists.map(p => p.id)).size !== value.playlists.length)
    ctx.addIssue({ code: "custom", message: "Duplicate library entries." });
});
export type MusicLibrary = z.infer<typeof librarySchema>;
export const emptyLibrary = (): MusicLibrary => ({ songs: [], playlists: [], favorites: [], history: [] });
export function cleanTrack(track: unknown): MusicTrack {
  const parsed = trackSchema.parse(track);
  return { ...parsed, thumbnail: parsed.mediaSource === "AUDIO_SOURCE" ? "" : thumbnailCandidates(parsed.id, parsed.thumbnail)[0] ?? "" };
}
export function mergeLibraries(remote: MusicLibrary, local: MusicLibrary): MusicLibrary {
  const byId = new Map(remote.songs.map(t => [t.id, t]));
  local.songs.forEach(t => byId.set(t.id, t));
  return librarySchema.parse({
    songs: [...byId.values()].slice(0, 400),
    playlists: [...new Map([...remote.playlists, ...local.playlists].map(p => [p.id, p])).values()].slice(0, 40),
    favorites: [...new Set([...remote.favorites, ...local.favorites])].slice(0, 400),
    history: [...new Map([...local.history, ...remote.history].sort((a, b) => a.at - b.at).map(h => [h.id, h])).values()].sort((a, b) => b.at - a.at).slice(0, 30),
  });
}
export const trackName = (track: MusicTrack) => track.displayTitle || track.title;
export const formatTime = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, "0")}`;
