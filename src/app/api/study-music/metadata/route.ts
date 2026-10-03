import { NextResponse } from "next/server";
import { resolveMusicMetadata } from "@/lib/study-music/metadata";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { assertAuthMutation } from "@/lib/auth/request-security";

export const runtime = "nodejs";
const windows = new Map<string, { count: number; reset: number }>();
export async function POST(request: Request) {
  try {
    assertAuthMutation(request);
    // Ephemeral abuse guard also works for guests without a database. Global
    // in-flight and cache caps live in the resolver; no arbitrary outbound URLs.
    const key = request.headers.get("x-forwarded-for")?.split(",")[0].trim().slice(0, 80) ?? "local";
    const now = Date.now();
    if (windows.size > 2000) for (const [k, v] of windows) if (v.reset < now) windows.delete(k);
    const window = windows.get(key);
    if (!window && windows.size >= 2000) return NextResponse.json({ message: "YouTube lookup is busy. Try again shortly." }, { status: 429, headers: { "Retry-After": "60" } });
    if (window && window.reset > now && window.count >= 20) return NextResponse.json({ message: "Too many lookups. Try again in a minute." }, { status: 429, headers: { "Retry-After": "60" } });
    if (!window || window.reset <= now) windows.set(key, { count: 1, reset: now + 60_000 }); else window.count++;
    const data = await readBoundedJson(request, 4096) as { url?: unknown };
    if (!data || typeof data.url !== "string") return NextResponse.json({ message: "Paste a YouTube video link." }, { status: 400 });
    const track = await resolveMusicMetadata(data.url);
    return NextResponse.json({ track }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof RequestBodyError ? error.message : error instanceof Error ? error.message : "YouTube lookup failed. Try again." }, { status: error instanceof RequestBodyError ? error.status : 422 });
  }
}
