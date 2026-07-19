import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const MAX_BYTES = 10 * 1024 * 1024;
const allowed = new Set(["audio/webm", "audio/ogg", "audio/wav", "audio/mpeg", "audio/mp4", "video/webm"]);

export async function POST(request: NextRequest) {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return NextResponse.json({ ok: false, error: "Groq transcription is not configured." }, { status: 503 });
  const data = await request.formData().catch(() => null);
  const audio = data?.get("audio");
  if (!(audio instanceof File) || audio.size === 0 || audio.size > MAX_BYTES || !allowed.has(audio.type)) {
    return NextResponse.json({ ok: false, error: "Provide a supported audio recording smaller than 10 MB." }, { status: 400 });
  }
  const form = new FormData();
  form.set("file", audio, audio.name || "lam-recording.webm");
  form.set("model", process.env.GROQ_STT_MODEL?.trim() || "whisper-large-v3-turbo");
  form.set("response_format", "json");
  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: request.signal });
  if (!response.ok) return NextResponse.json({ ok: false, error: response.status === 429 ? "Transcription is busy. Try again shortly." : "The recording could not be transcribed." }, { status: response.status === 429 ? 429 : 502 });
  const result = await response.json() as { text?: string };
  if (!result.text?.trim()) return NextResponse.json({ ok: false, error: "No speech was detected." }, { status: 422 });
  return NextResponse.json({ ok: true, text: result.text.trim() });
}
