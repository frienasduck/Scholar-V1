import "server-only";
import { parseYouTubeUrl, cleanTrack, type MusicTrack } from "./model";
import { readBoundedBytes } from "@/lib/security/request-body";

const cache = new Map<string, { expires: number; track: MusicTrack }>();
const pending = new Map<string, Promise<MusicTrack>>();
export async function resolveMusicMetadata(input: string): Promise<MusicTrack> {
  const { id, url } = parseYouTubeUrl(input);
  const cached = cache.get(id);
  if (cached && cached.expires > Date.now()) return cached.track;
  if (pending.has(id)) return pending.get(id)!;
  if (pending.size >= 12) throw new Error("YouTube lookup is busy. Try again shortly.");
  const promise = (async () => {
    // Never fetch the supplied URL. Only the official fixed endpoint with a
    // locally constructed video URL; redirects cannot become an SSRF pivot.
    const endpoint = new URL("https://www.youtube.com/oembed");
    endpoint.searchParams.set("url", url); endpoint.searchParams.set("format", "json");
    const response = await fetch(endpoint, { redirect: "error", signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok) throw new Error("This video is unavailable, private, or cannot be embedded. Try another link.");
    const bytes = await readBoundedBytes(new Request("https://www.youtube.com/oembed", { method: "POST", body: response.body, duplex: "half" } as RequestInit), 32000);
    const data = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (typeof data.title !== "string" || typeof data.author_name !== "string") throw new Error("YouTube did not return usable metadata.");
    const track = cleanTrack({ id, title: data.title.slice(0, 240), artist: data.author_name.slice(0, 160), category: "My Songs", thumbnail: typeof data.thumbnail_url === "string" ? data.thumbnail_url : "", durationSeconds: null, source: "imported", addedAt: Date.now() });
    if (cache.size >= 500) cache.delete(cache.keys().next().value!);
    cache.set(id, { track, expires: Date.now() + 6 * 3600_000 });
    return track;
  })().finally(() => pending.delete(id));
  pending.set(id, promise);
  return promise;
}
