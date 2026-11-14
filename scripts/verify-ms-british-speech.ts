/**
 * Verification script for Microsoft British English Female Voice Lockdown.
 * Run: bun --preload ./scripts/mock-server-only.ts scripts/verify-ms-british-speech.ts
 */
import {
  generateSpeech,
  inspectLocalMicrosoftVoices,
  selectPreferredBritishVoice,
  speechConfiguration,
} from "../src/lib/lamtube/speech";

async function main() {
  console.log("=== 1. Speech Configuration ===");
  console.log(JSON.stringify(speechConfiguration(), null, 2));

  console.log("\n=== 2. Installed Windows Voices (WinRT + SAPI) ===");
  const voices = await inspectLocalMicrosoftVoices();
  for (const v of voices) {
    console.log(`- [${v.api}] ${v.name} | locale=${v.language} | gender=${v.gender} | offline=${v.offline}`);
  }
  const preferred = selectPreferredBritishVoice(voices);
  console.log("Selected en-GB female voice:", preferred ? `${preferred.name} (${preferred.language})` : "NONE");

  console.log("\n=== 3. Real Unmocked Synthesis Attempt (No Gemini/Groq/Zira Fallback) ===");
  try {
    await generateSpeech(
      "In projectile motion, horizontal velocity remains constant.",
      { voice: "autumn", pace: "normal" },
      new AbortController().signal
    );
    console.log("UNEXPECTED: synthesis succeeded without en-GB voice");
    process.exitCode = 1;
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    console.log(`EXPECTED FAILURE: code=${e.code} status=${e.status} message=${e.message}`);
    if (e.code !== "MS_TTS_VOICE_UNAVAILABLE") {
      process.exitCode = 1;
    }
  }

  console.log("\n=== 4. Worker Offline Failure Check ===");
  process.env.LAMTUBE_SPEECH_WORKER_URL = "http://127.0.0.1:59999/synthesize";
  process.env.LAMTUBE_SPEECH_WORKER_TIMEOUT_MS = "2000";
  try {
    await generateSpeech("Worker offline test.", { voice: "autumn", pace: "normal" }, new AbortController().signal);
    console.log("UNEXPECTED: offline worker succeeded");
    process.exitCode = 1;
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    console.log(`EXPECTED WORKER FAILURE: code=${e.code} status=${e.status} message=${e.message}`);
  } finally {
    delete process.env.LAMTUBE_SPEECH_WORKER_URL;
    delete process.env.LAMTUBE_SPEECH_WORKER_TIMEOUT_MS;
  }
}

await main();
