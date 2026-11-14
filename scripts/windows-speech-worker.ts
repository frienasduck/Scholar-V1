/**
 * Authenticated Windows Speech Worker for production Vercel deployments.
 *
 * Usage (on a Windows host with Microsoft Sonia / Hazel en-GB installed):
 *   LAMTUBE_SPEECH_WORKER_TOKEN=<secret> LAMTUBE_SPEECH_WORKER_PORT=4105 bun --preload ./scripts/mock-server-only.ts scripts/windows-speech-worker.ts
 */
import { timingSafeEqual } from "node:crypto";
import { synthesizeLocalMicrosoftBritishSpeech } from "../src/lib/lamtube/speech";
import type { VideoSettings } from "../src/lib/lamtube/model";

const port = Number(process.env.LAMTUBE_SPEECH_WORKER_PORT ?? 4105);
const requiredToken = process.env.LAMTUBE_SPEECH_WORKER_TOKEN?.trim() || "";
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 120;
const hits = new Map<string, { count: number; resetAt: number }>();

function authorized(req: Request): boolean {
  if (!requiredToken) return false;
  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const provided = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(requiredToken);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

function checkRate(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now >= entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX_REQUESTS) return false;
  entry.count += 1;
  return true;
}

if (!requiredToken) {
  console.error("LAMTUBE_SPEECH_WORKER_TOKEN is required to start the Windows speech worker.");
  process.exit(1);
}

const server = Bun.serve({
  port,
  async fetch(req, srv) {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, provider: "microsoft-speech", locale: "en-GB", gender: "Female" });
    }
    if (req.method !== "POST" || url.pathname !== "/synthesize") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (!authorized(req)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const ip = srv.requestIP(req)?.address ?? "unknown";
    if (!checkRate(ip)) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    let body: { text?: unknown; pace?: unknown };
    try {
      body = (await req.json()) as { text?: unknown; pace?: unknown };
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    const pace: VideoSettings["pace"] =
      body.pace === "calm" || body.pace === "brisk" ? body.pace : "normal";
    if (!text || text.length > 200) {
      return Response.json({ error: "text must be 1..200 characters" }, { status: 400 });
    }

    try {
      const result = await synthesizeLocalMicrosoftBritishSpeech(text, pace, AbortSignal.timeout(20_000));
      return new Response(new Uint8Array(result.wav), {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "no-store",
          "x-ms-voice-name": result.voiceName,
          "x-ms-voice-locale": result.locale,
          "x-ms-voice-gender": result.gender,
          "x-ms-speech-api": result.api,
        },
      });
    } catch (err) {
      const e = err as { status?: number; code?: string; message?: string };
      return Response.json(
        { error: e.message ?? "Speech synthesis failed", code: e.code ?? "MS_TTS_FAILED" },
        { status: e.status ?? 502 }
      );
    }
  },
});

console.log(`Microsoft British Speech Worker listening on http://127.0.0.1:${server.port}`);
