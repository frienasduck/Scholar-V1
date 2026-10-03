import type { MusicTrack } from "./model";

// Official YouTube oEmbed verified 2026-10-03. Durations are unknown unless the
// source description specifies one; runtime obtains the actual player duration.
const entry = (id: string, title: string, artist: string, category: string, tags: string[], durationSeconds: number | null = null): MusicTrack => ({ id, title, artist, category, tags, durationSeconds, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, source: "catalog" });
export const MUSIC_CATALOG: MusicTrack[] = [
  entry("jfKfPfyJRdk", "lofi hip hop radio · beats to relax/study to", "Lofi Girl", "Lo-fi", ["focus", "no lyrics", "radio"]),
  entry("7NOSDKb0HlU", "lofi hip hop radio · beats to study/relax to", "Chillhop Music", "Lo-fi", ["focus", "no lyrics", "radio"]),
  entry("MVPTGNGiI-4", "synthwave radio · beats to chill/game to", "Lofi Girl", "Deep focus", ["energetic", "no lyrics", "radio"]),
  entry("rUxyKA_-grg", "lofi hip hop radio · beats to sleep/chill to", "Lofi Girl", "Late night", ["calm", "no lyrics", "radio"]),
  entry("DWcJFNfaw9c", "lofi hip hop radio · beats to sleep/chill to", "Lofi Girl", "Late night", ["calm", "no lyrics"]),
  entry("lCOF9LN_Zxs", "Beautiful Piano Music, Vol. 1", "Soothing Relaxation", "Piano", ["calm", "no lyrics", "reading"]),
  entry("jgpJVI3tDbY", "The Best of Classical Music · Mozart, Beethoven, Bach, Chopin, Vivaldi", "Just Instrumental Music", "Classical", ["instrumental", "no lyrics", "reading"]),
  entry("eKFTSSKCzWA", "Relaxing Nature Sounds · Forest Waterfall", "johnnielawson", "Nature", ["calm", "no lyrics", "nature"]),
  entry("q76bMs-NwRk", "3 Hours of Gentle Night Rain", "The Relaxed Guy", "Rain", ["calm", "no lyrics", "rain"], 10800),
  entry("1ZYbU82GVz4", "Flying · Relaxing Music", "Soothing Relaxation", "Ambient", ["calm", "no lyrics", "ambient"]),
  entry("2OEL4P1Rz04", "The Hidden Valley · Ambient Relaxing Music", "Soothing Relaxation", "Ambient", ["calm", "no lyrics", "ambient"]),
  entry("VMAPTo7RVCo", "Cozy Fall Coffee Shop · Jazz & Rain", "Calmed By Nature", "Café", ["jazz", "no lyrics", "reading"], 28800),
  entry("K1881OmmQCE", "Vintage Fall Coffee Shop · Soft Jazz & Rain", "Calmed By Nature", "Café", ["jazz", "no lyrics", "reading"]),
  entry("4xDzrJKXOOY", "synthwave radio · beats to chill/game to", "Lofi Girl", "Instrumental", ["energetic", "no lyrics"]),
  entry("5qap5aO4i9A", "lofi hip hop radio · beats to relax/study to", "Lofi Girl", "Lo-fi", ["focus", "no lyrics"]),
  entry("zAiIgYOH4Ys", "KALYANI (Remix)", "ARJN - Topic", "Scholar picks", ["energetic", "vocals"], null),
];
export const CATEGORIES = ["All", ...new Set(MUSIC_CATALOG.map(t => t.category))];
export const LEGACY_TRACK_IDS: Record<string, string> = { "kalyani-remix": "zAiIgYOH4Ys", lofi: "jfKfPfyJRdk", classical: "jgpJVI3tDbY", nature: "eKFTSSKCzWA", ambient: "4xDzrJKXOOY", piano: "lCOF9LN_Zxs", rain: "q76bMs-NwRk", "deep-focus": "5qap5aO4i9A", "study-focus": "jfKfPfyJRdk" };
export function buildSoundtrack(tracks: MusicTrack[], mood: string, favorites: string[], limit = 8): MusicTrack[] {
  return tracks.map((track, index) => ({ track, score: (track.tags?.includes(mood) ? 4 : 0) + (favorites.includes(track.id) ? 2 : 0) + (track.tags?.includes("no lyrics") ? 1 : 0), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map(v => v.track);
}
