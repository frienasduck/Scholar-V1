import { afterEach, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
const { generateSpeech, speechConfiguration, speechError } = await import("../src/lib/lamtube/speech");
const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY;
const originalProvider = process.env.LAMTUBE_TTS_PROVIDER;
const originalModel = process.env.GEMINI_TTS_MODEL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of [["GEMINI_API_KEY", originalKey], ["LAMTUBE_TTS_PROVIDER", originalProvider], ["GEMINI_TTS_MODEL", originalModel]]) {
    if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  }
});
function wav() {
  const bytes = Buffer.alloc(48044);
  bytes.write("RIFF"); bytes.writeUInt32LE(48036, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(24000, 24); bytes.writeUInt32LE(48000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(48000, 40);
  return bytes;
}
test("configured Gemini produces validated WAV from the real speech response contract", async () => {
  process.env.GEMINI_API_KEY = "test-not-a-real-key";
  delete process.env.LAMTUBE_TTS_PROVIDER; delete process.env.GEMINI_TTS_MODEL;
  expect(speechConfiguration().provider).toBe("gemini");
  globalThis.fetch = mock(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body));
    expect(request.response_format.type).toBe("audio");
    expect(request.generation_config.speech_config[0].voice).toBe("Kore");
    return Response.json({ steps: [{ type: "model_output", content: [{ type: "audio", mime_type: "audio/wav", data: wav().toString("base64") }] }] });
  }) as unknown as typeof fetch;
  expect(await generateSpeech("Net force equals mass times acceleration.", { voice: "autumn", pace: "normal" }, new AbortController().signal)).toEqual(wav());
});
test("missing or invalid generated audio never becomes a successful video clip", async () => {
  process.env.GEMINI_API_KEY = "test-not-a-real-key"; delete process.env.LAMTUBE_TTS_PROVIDER;
  globalThis.fetch = mock(async () => Response.json({ steps: [] })) as unknown as typeof fetch;
  await expect(generateSpeech("Test phrase", { voice: "autumn", pace: "calm" }, new AbortController().signal)).rejects.toMatchObject({ code: "TTS_FAILED" });
});
test("Groq terms and provider access failures have actionable, non-secret errors", () => {
  expect(speechError({ code: "model_terms_required", status: 400 }).code).toBe("TTS_MODEL_TERMS_REQUIRED");
  expect(speechError({ status: 403, message: "secret-key" }).message).not.toContain("secret-key");
  expect(speechError({ status: 429 }).code).toBe("TTS_RATE_LIMITED");
});
