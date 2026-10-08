import { describe, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
// Explicit opt-in, synthetic study phrase only. Uses normal provider quota,
// no Scholar account/upload/video credit, and never prints keys or audio data.
describe.skipIf(process.env.SCHOLAR_LIVE_TTS !== "1")("configured live video narration", () => {
  test("returns real validated WAV instead of a silent or invented fallback", async () => {
    const { generateSpeech, speechConfiguration } = await import("../src/lib/lamtube/speech");
    const { wavInfo } = await import("../src/lib/lamtube/wav");
    const started = performance.now();
    const bytes = await generateSpeech("Net force equals mass times acceleration.", { voice: "autumn", pace: "normal" }, AbortSignal.timeout(30000));
    const info = wavInfo(bytes);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(info.duration).toBeGreaterThan(0.5);
    console.info(JSON.stringify({ capability: "video-narration", provider: speechConfiguration().provider, bytes: bytes.length, elapsedMs: Math.round(performance.now() - started), status: "passed" }));
  }, 35000);
});
