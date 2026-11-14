import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AIProviderError } from "../ai/errors";
import { readBoundedBytes } from "../security/request-body";
import type { VideoSettings } from "./model";
import { normalizeForSpeech } from "./narration-normalize";
import { wavInfo } from "./wav";

export const MS_BRITISH_VOICE_PRIORITY = [
  "Microsoft Sonia",
  "Microsoft Hazel",
] as const;

export const MS_SPEECH_MODEL_ID = "ms-en-gb-female-v1";
export const TTS_MODEL = MS_SPEECH_MODEL_ID;
export const MS_SPEECH_LOCALE = "en-GB";
export const MS_SPEECH_GENDER = "Female";

const MAX_TTS_TEXT_CHARS = 200;
const MAX_WAV_BYTES = 8_000_000;
const DEFAULT_WORKER_TIMEOUT_MS = 20_000;

export type MicrosoftSpeechResult = {
  wav: Buffer;
  voiceName: string;
  locale: string;
  gender: string;
  api: "winrt" | "sapi" | "worker";
  offline: boolean;
};

type LocalVoiceMetadata = {
  api: "winrt" | "sapi";
  name: string;
  language: string;
  gender: string;
  id: string;
  offline: boolean;
};

function sanitizeErrorMessage(raw: string): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s)]+/gi, "[worker-url]")
    .slice(0, 220);
}

function getWorkerConfig(): {
  url: string | null;
  token: string | null;
  timeoutMs: number;
} {
  const url = process.env.LAMTUBE_SPEECH_WORKER_URL?.trim() || null;
  const token = process.env.LAMTUBE_SPEECH_WORKER_TOKEN?.trim() || null;
  const parsedTimeout = Number(process.env.LAMTUBE_SPEECH_WORKER_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(parsedTimeout)
    ? Math.max(2000, Math.min(60_000, Math.round(parsedTimeout)))
    : DEFAULT_WORKER_TIMEOUT_MS;
  return { url, token, timeoutMs };
}

export function isMicrosoftBritishFemaleVoice(voice: {
  name: string;
  language: string;
  gender: string;
}): boolean {
  const name = voice.name.trim().toLowerCase();
  const lang = voice.language.trim().toLowerCase();
  const gender = voice.gender.trim().toLowerCase();
  if (!name.includes("microsoft")) return false;
  if (name.includes("zira") || name.includes("david") || name.includes("mark")) {
    return false;
  }
  if (lang !== "en-gb") return false;
  if (gender !== "female") return false;
  return true;
}

export function selectPreferredBritishVoice<
  T extends { name: string; language: string; gender: string },
>(voices: T[]): T | null {
  const eligible = voices.filter(isMicrosoftBritishFemaleVoice);
  if (!eligible.length) return null;

  const sonia = eligible.find((v) =>
    v.name.toLowerCase().includes("microsoft sonia")
  );
  if (sonia) return sonia;

  const hazel = eligible.find((v) =>
    v.name.toLowerCase().includes("microsoft hazel")
  );
  if (hazel) return hazel;

  return eligible[0] ?? null;
}

export function speechConfiguration() {
  const worker = getWorkerConfig();
  const isWindows = process.platform === "win32";
  return {
    provider: "microsoft-speech" as const,
    model: MS_SPEECH_MODEL_ID,
    locale: MS_SPEECH_LOCALE,
    gender: MS_SPEECH_GENDER,
    voicePriority: [...MS_BRITISH_VOICE_PRIORITY],
    mode: worker.url ? ("worker" as const) : isWindows ? ("local-windows" as const) : ("unconfigured" as const),
    available: Boolean(worker.url) || isWindows,
  };
}

export function speechError(error: unknown): AIProviderError {
  if (error instanceof AIProviderError) return error;
  const e = error as { status?: number; code?: string; name?: string; message?: string };
  if (e.name === "AbortError" || e.name === "TimeoutError" || e.code === "ETIMEDOUT") {
    return new AIProviderError(
      "Microsoft British speech synthesis timed out.",
      504,
      "MS_TTS_TIMEOUT"
    );
  }
  if (e.status === 401 || e.status === 403) {
    return new AIProviderError(
      "Microsoft speech worker authentication failed.",
      e.status,
      "MS_TTS_AUTH_FAILED"
    );
  }
  if (e.status === 429) {
    return new AIProviderError(
      "Microsoft speech worker rate limit reached.",
      429,
      "MS_TTS_RATE_LIMITED"
    );
  }
  const msg = e.message ? sanitizeErrorMessage(e.message) : "Microsoft speech synthesis failed.";
  return new AIProviderError(msg, e.status ?? 502, e.code || "MS_TTS_FAILED");
}

function paceToWinRtRate(pace: VideoSettings["pace"]): number {
  if (pace === "calm") return 0.9;
  if (pace === "brisk") return 1.1;
  return 1.0;
}

function paceToSapiRate(pace: VideoSettings["pace"]): number {
  if (pace === "calm") return -2;
  if (pace === "brisk") return 2;
  return 0;
}

function runPowerShellScript(
  script: string,
  env: Record<string, string>,
  signal?: AbortSignal
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: { ...process.env, ...env },
      }
    );

    let stdout = "";
    let stderr = "";
    const onAbort = () => {
      try {
        child.kill();
      } catch {}
      reject(new AIProviderError("Microsoft speech synthesis aborted or timed out.", 504, "MS_TTS_TIMEOUT"));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      signal?.removeEventListener("abort", onAbort);
      reject(
        new AIProviderError(
          `Unable to launch Windows speech synthesizer: ${sanitizeErrorMessage(err.message)}`,
          503,
          "MS_TTS_HOST_ERROR"
        )
      );
    });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new AIProviderError(
            sanitizeErrorMessage(stderr || stdout || `PowerShell exited with code ${code}`),
            502,
            "MS_TTS_FAILED"
          )
        );
      }
    });
  });
}

export async function inspectLocalMicrosoftVoices(
  signal?: AbortSignal
): Promise<LocalVoiceMetadata[]> {
  if (process.platform !== "win32") return [];
  const ps = [
    "$ErrorActionPreference = 'Stop'",
    "$results = @()",
    "try {",
    "  Add-Type -AssemblyName System.Runtime.WindowsRuntime",
    "  $null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime]",
    "  foreach ($v in [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices) {",
    "    $results += [pscustomobject]@{ api = 'winrt'; name = [string]$v.DisplayName; language = [string]$v.Language; gender = [string]$v.Gender; id = [string]$v.Id; offline = $true }",
    "  }",
    "} catch {}",
    "try {",
    "  Add-Type -AssemblyName System.Speech",
    "  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "  foreach ($iv in $s.GetInstalledVoices()) {",
    "    if (-not $iv.Enabled) { continue }",
    "    $vi = $iv.VoiceInfo",
    "    $results += [pscustomobject]@{ api = 'sapi'; name = [string]$vi.Name; language = [string]$vi.Culture.Name; gender = [string]$vi.Gender; id = [string]$vi.Id; offline = $true }",
    "  }",
    "  $s.Dispose()",
    "} catch {}",
    "$results | ConvertTo-Json -Compress",
  ].join("\n");

  const { stdout } = await runPowerShellScript(ps, {}, signal);
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed) as LocalVoiceMetadata | LocalVoiceMetadata[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

export async function synthesizeLocalMicrosoftBritishSpeech(
  spoken: string,
  pace: VideoSettings["pace"],
  signal?: AbortSignal
): Promise<MicrosoftSpeechResult> {
  if (process.platform !== "win32") {
    throw new AIProviderError(
      "Local Microsoft Windows speech is only available on Windows hosts.",
      503,
      "MS_TTS_UNSUPPORTED_PLATFORM"
    );
  }

  const voices = await inspectLocalMicrosoftVoices(signal);
  // Prefer WinRT first (supports Sonia / OneCore voices), then SAPI (supports Hazel Desktop).
  const winrtVoice = selectPreferredBritishVoice(voices.filter((v) => v.api === "winrt"));
  const sapiVoice = selectPreferredBritishVoice(voices.filter((v) => v.api === "sapi"));
  const selected = winrtVoice ?? sapiVoice;

  if (!selected) {
    const installedSummary = voices.length
      ? voices.map((v) => `${v.name} (${v.language}, ${v.gender}, ${v.api})`).join("; ")
      : "none";
    throw new AIProviderError(
      `No Microsoft British English (en-GB) female speech voice (Microsoft Sonia or Microsoft Hazel) is installed on this Windows host. Installed voices: ${installedSummary}. Install English (United Kingdom) speech in Windows Settings -> Time & language -> Speech, or configure LAMTUBE_SPEECH_WORKER_URL.`,
      503,
      "MS_TTS_VOICE_UNAVAILABLE"
    );
  }

  const dir = await mkdtemp(join(tmpdir(), "lamtube-ms-tts-"));
  const outPath = join(dir, "narration.wav");

  try {
    if (selected.api === "winrt") {
      const ps = [
        "$ErrorActionPreference = 'Stop'",
        "Add-Type -AssemblyName System.Runtime.WindowsRuntime",
        "$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType=WindowsRuntime]",
        "$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime]",
        "$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]",
        "function Await-WinRt($op, [Type]$resultType) {",
        "  $m = $asTaskGeneric.MakeGenericMethod($resultType)",
        "  $task = $m.Invoke($null, @($op))",
        "  $task.Wait()",
        "  return $task.Result",
        "}",
        "$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer",
        "$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Id -eq $env:MS_TTS_VOICE_ID } | Select-Object -First 1",
        "if (-not $voice) { throw 'Selected en-GB WinRT voice is unavailable.' }",
        "$synth.Voice = $voice",
        "$synth.Options.SpeakingRate = [double]$env:MS_TTS_WINRT_RATE",
        "$stream = Await-WinRt ($synth.SynthesizeTextToStreamAsync($env:MS_TTS_TEXT)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])",
        "$size = [uint32]$stream.Size",
        "if ($size -le 44) { throw 'Synthesized WinRT stream was empty.' }",
        "$input = $stream.GetInputStreamAt(0)",
        "$reader = New-Object Windows.Storage.Streams.DataReader($input)",
        "$loaded = Await-WinRt ($reader.LoadAsync($size)) ([uint32])",
        "$bytes = New-Object byte[] $loaded",
        "$reader.ReadBytes($bytes)",
        "[System.IO.File]::WriteAllBytes($env:MS_TTS_OUT, $bytes)",
        "$reader.Dispose()",
        "$stream.Dispose()",
        "$synth.Dispose()",
      ].join("\n");

      await runPowerShellScript(
        ps,
        {
          MS_TTS_VOICE_ID: selected.id,
          MS_TTS_WINRT_RATE: String(paceToWinRtRate(pace)),
          MS_TTS_TEXT: spoken,
          MS_TTS_OUT: outPath,
        },
        signal
      );
    } else {
      const ps = [
        "$ErrorActionPreference = 'Stop'",
        "Add-Type -AssemblyName System.Speech",
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
        "$s.SelectVoice($env:MS_TTS_VOICE_NAME)",
        "$s.Rate = [int]$env:MS_TTS_SAPI_RATE",
        "$s.SetOutputToWaveFile($env:MS_TTS_OUT)",
        "$s.Speak($env:MS_TTS_TEXT)",
        "$s.SetOutputToNull()",
        "$s.Dispose()",
      ].join("\n");

      await runPowerShellScript(
        ps,
        {
          MS_TTS_VOICE_NAME: selected.name,
          MS_TTS_SAPI_RATE: String(paceToSapiRate(pace)),
          MS_TTS_TEXT: spoken,
          MS_TTS_OUT: outPath,
        },
        signal
      );
    }

    const wav = await readFile(outPath);
    if (wav.byteLength > MAX_WAV_BYTES) {
      throw new AIProviderError(
        "Synthesized Microsoft speech WAV exceeded maximum size limit.",
        502,
        "MS_TTS_FAILED"
      );
    }
    // Validate RIFF/WAVE PCM header and duration bounds.
    wavInfo(wav);

    return {
      wav,
      voiceName: selected.name,
      locale: selected.language,
      gender: selected.gender,
      api: selected.api,
      offline: selected.offline,
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function synthesizeViaWorker(
  spoken: string,
  pace: VideoSettings["pace"],
  signal: AbortSignal
): Promise<MicrosoftSpeechResult> {
  const { url, token, timeoutMs } = getWorkerConfig();
  if (!url) {
    throw new AIProviderError(
      "Microsoft British speech worker URL is not configured.",
      503,
      "MS_TTS_WORKER_UNCONFIGURED"
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new AIProviderError(
      "Microsoft speech worker URL is invalid.",
      500,
      "MS_TTS_WORKER_INVALID_URL"
    );
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new AIProviderError(
      "Microsoft speech worker URL must use http or https.",
      500,
      "MS_TTS_WORKER_INVALID_URL"
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "audio/wav",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

  let response: Response;
  try {
    response = await fetch(parsedUrl.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: spoken,
        pace,
        locale: MS_SPEECH_LOCALE,
        gender: MS_SPEECH_GENDER,
        voicePriority: [...MS_BRITISH_VOICE_PRIORITY],
      }),
      signal: combinedSignal,
    });
  } catch (err) {
    throw speechError(err);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AIProviderError(
        "Microsoft speech worker rejected authentication.",
        response.status,
        "MS_TTS_AUTH_FAILED"
      );
    }
    if (response.status === 429) {
      throw new AIProviderError(
        "Microsoft speech worker rate limit reached.",
        429,
        "MS_TTS_RATE_LIMITED"
      );
    }
    throw new AIProviderError(
      `Microsoft speech worker returned HTTP ${response.status}.`,
      response.status >= 500 ? 503 : response.status,
      response.status === 503 ? "MS_TTS_VOICE_UNAVAILABLE" : "MS_TTS_WORKER_ERROR"
    );
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("audio/wav") && !contentType.includes("audio/wave") && !contentType.includes("audio/x-wav")) {
    throw new AIProviderError(
      "Microsoft speech worker returned an unexpected content type.",
      502,
      "MS_TTS_FAILED"
    );
  }

  const voiceName = response.headers.get("x-ms-voice-name")?.trim() || "Microsoft British Female";
  const locale = response.headers.get("x-ms-voice-locale")?.trim() || MS_SPEECH_LOCALE;
  const gender = response.headers.get("x-ms-voice-gender")?.trim() || MS_SPEECH_GENDER;

  if (
    locale.toLowerCase() !== "en-gb" ||
    gender.toLowerCase() !== "female" ||
    voiceName.toLowerCase().includes("zira")
  ) {
    throw new AIProviderError(
      "Microsoft speech worker did not return a verified en-GB female Microsoft voice.",
      502,
      "MS_TTS_VOICE_MISMATCH"
    );
  }

  const raw = await readBoundedBytes(response as unknown as Request, MAX_WAV_BYTES);
  const wav = Buffer.from(raw);
  wavInfo(wav);

  return {
    wav,
    voiceName,
    locale,
    gender,
    api: "worker",
    offline: false,
  };
}

export async function generateMicrosoftSpeechWithMeta(
  text: string,
  settings: Pick<VideoSettings, "voice" | "pace"> & { language?: VideoSettings["language"] },
  signal: AbortSignal
): Promise<MicrosoftSpeechResult> {
  if (!text.trim() || text.trim().length > MAX_TTS_TEXT_CHARS) {
    throw new AIProviderError(
      `Narration phrase must be 1 to ${MAX_TTS_TEXT_CHARS} characters.`,
      400,
      "MS_TTS_INVALID_INPUT"
    );
  }

  const spoken = normalizeForSpeech(text);
  if (!spoken || spoken.length > MAX_TTS_TEXT_CHARS) {
    throw new AIProviderError(
      `Normalized narration phrase must be 1 to ${MAX_TTS_TEXT_CHARS} characters.`,
      400,
      "MS_TTS_INVALID_INPUT"
    );
  }

  const worker = getWorkerConfig();
  if (worker.url) {
    return synthesizeViaWorker(spoken, settings.pace, signal);
  }

  if (process.platform === "win32") {
    return synthesizeLocalMicrosoftBritishSpeech(spoken, settings.pace, signal);
  }

  throw new AIProviderError(
    "Microsoft British English speech requires a Windows host or LAMTUBE_SPEECH_WORKER_URL.",
    503,
    "MS_TTS_WORKER_UNCONFIGURED"
  );
}

export async function generateSpeech(
  text: string,
  settings: Pick<VideoSettings, "voice" | "pace"> & { language?: VideoSettings["language"] },
  signal: AbortSignal
): Promise<Buffer> {
  const result = await generateMicrosoftSpeechWithMeta(text, settings, signal);
  return result.wav;
}
