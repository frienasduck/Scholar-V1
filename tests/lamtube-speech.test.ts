import { afterEach, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
const {
  generateMicrosoftSpeechWithMeta,
  generateSpeech,
  isMicrosoftBritishFemaleVoice,
  selectPreferredBritishVoice,
  speechConfiguration,
  speechError,
} = await import("../src/lib/lamtube/speech");

const originalFetch = globalThis.fetch;
const originalWorkerUrl = process.env.LAMTUBE_SPEECH_WORKER_URL;
const originalWorkerToken = process.env.LAMTUBE_SPEECH_WORKER_TOKEN;
const originalWorkerTimeout = process.env.LAMTUBE_SPEECH_WORKER_TIMEOUT_MS;

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of [
    ["LAMTUBE_SPEECH_WORKER_URL", originalWorkerUrl],
    ["LAMTUBE_SPEECH_WORKER_TOKEN", originalWorkerToken],
    ["LAMTUBE_SPEECH_WORKER_TIMEOUT_MS", originalWorkerTimeout],
  ]) {
    if (value === undefined) delete process.env[key!];
    else process.env[key!] = value;
  }
});

function wav() {
  const bytes = Buffer.alloc(48044);
  bytes.write("RIFF");
  bytes.writeUInt32LE(48036, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(24000, 24);
  bytes.writeUInt32LE(48000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(48000, 40);
  return bytes;
}

test("voice selection strictly enforces Microsoft en-GB female priority and rejects Zira/male/en-US", () => {
  const zira = { name: "Microsoft Zira Desktop", language: "en-US", gender: "Female" };
  const david = { name: "Microsoft David Desktop", language: "en-US", gender: "Male" };
  const george = { name: "Microsoft George", language: "en-GB", gender: "Male" };
  const hazel = { name: "Microsoft Hazel Desktop", language: "en-GB", gender: "Female" };
  const sonia = { name: "Microsoft Sonia", language: "en-GB", gender: "Female" };
  const susan = { name: "Microsoft Susan", language: "en-GB", gender: "Female" };

  expect(isMicrosoftBritishFemaleVoice(zira)).toBe(false);
  expect(isMicrosoftBritishFemaleVoice(david)).toBe(false);
  expect(isMicrosoftBritishFemaleVoice(george)).toBe(false);
  expect(isMicrosoftBritishFemaleVoice(hazel)).toBe(true);
  expect(isMicrosoftBritishFemaleVoice(sonia)).toBe(true);

  expect(selectPreferredBritishVoice([zira, david, george, hazel, sonia])?.name).toBe("Microsoft Sonia");
  expect(selectPreferredBritishVoice([zira, david, george, hazel, susan])?.name).toBe("Microsoft Hazel Desktop");
  expect(selectPreferredBritishVoice([zira, david, george, susan])?.name).toBe("Microsoft Susan");
  expect(selectPreferredBritishVoice([zira, david, george])).toBeNull();
});

test("speechConfiguration is locked to Microsoft British English female speech", () => {
  const cfg = speechConfiguration();
  expect(cfg.provider).toBe("microsoft-speech");
  expect(cfg.locale).toBe("en-GB");
  expect(cfg.gender).toBe("Female");
  expect(cfg.voicePriority).toEqual(["Microsoft Sonia", "Microsoft Hazel"]);
});

test("authenticated Windows speech worker returns validated en-GB female WAV", async () => {
  process.env.LAMTUBE_SPEECH_WORKER_URL = "https://speech.example.test/synthesize";
  process.env.LAMTUBE_SPEECH_WORKER_TOKEN = "worker-secret-token";

  globalThis.fetch = mock(async (url: RequestInfo | URL, init?: RequestInit) => {
    expect(String(url)).toBe("https://speech.example.test/synthesize");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer worker-secret-token");
    const body = JSON.parse(String(init?.body));
    expect(body.locale).toBe("en-GB");
    expect(body.gender).toBe("Female");
    expect(body.voicePriority).toEqual(["Microsoft Sonia", "Microsoft Hazel"]);
    return new Response(wav(), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "x-ms-voice-name": "Microsoft Sonia",
        "x-ms-voice-locale": "en-GB",
        "x-ms-voice-gender": "Female",
      },
    });
  }) as unknown as typeof fetch;

  const result = await generateMicrosoftSpeechWithMeta(
    "Net force equals mass times acceleration.",
    { voice: "autumn", pace: "normal" },
    new AbortController().signal
  );
  expect(result.wav).toEqual(wav());
  expect(result.voiceName).toBe("Microsoft Sonia");
  expect(result.locale).toBe("en-GB");
  expect(result.gender).toBe("Female");
  expect(
    await generateSpeech("Net force equals mass times acceleration.", { voice: "autumn", pace: "normal" }, new AbortController().signal)
  ).toEqual(wav());
});

test("worker returning non-British or Zira voice is rejected with MS_TTS_VOICE_MISMATCH", async () => {
  process.env.LAMTUBE_SPEECH_WORKER_URL = "https://speech.example.test/synthesize";
  globalThis.fetch = mock(async () =>
    new Response(wav(), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "x-ms-voice-name": "Microsoft Zira Desktop",
        "x-ms-voice-locale": "en-US",
        "x-ms-voice-gender": "Female",
      },
    })
  ) as unknown as typeof fetch;

  await expect(
    generateSpeech("Test phrase", { voice: "autumn", pace: "calm" }, new AbortController().signal)
  ).rejects.toMatchObject({ code: "MS_TTS_VOICE_MISMATCH" });
});

test("invalid input, worker errors, and secret redaction fail cleanly without Gemini/Groq fallback", async () => {
  await expect(
    generateSpeech("   ", { voice: "autumn", pace: "normal" }, new AbortController().signal)
  ).rejects.toMatchObject({ code: "MS_TTS_INVALID_INPUT" });

  await expect(
    generateSpeech("x".repeat(201), { voice: "autumn", pace: "normal" }, new AbortController().signal)
  ).rejects.toMatchObject({ code: "MS_TTS_INVALID_INPUT" });

  expect(speechError({ status: 403, message: "Bearer secret-key-123" }).message).not.toContain("secret-key-123");
  expect(speechError({ status: 429 }).code).toBe("MS_TTS_RATE_LIMITED");
  expect(speechError({ name: "TimeoutError" }).code).toBe("MS_TTS_TIMEOUT");
});
