import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

// Deliberately separate from the zero-cost default RC suite. The caller opts
// into small synthetic provider requests; no account/database is accessed.
if (process.env.SCHOLAR_RUN_LIVE_PROBES !== "1") throw new Error("Set SCHOLAR_RUN_LIVE_PROBES=1 only when live provider quota use is intended.");
const jobs = [
  { file: "tests/ai-live.test.ts", flag: "SCHOLAR_LIVE_AI", key: "GROQ_API_KEY" },
  { file: "tests/lamtube-speech-live.test.ts", flag: "SCHOLAR_LIVE_TTS", key: "GEMINI_API_KEY" },
  { file: "tests/live-tutor-providers-live.test.ts", flag: "SCHOLAR_LIVE_LAM_PROVIDERS", key: "GROQ_API_KEY" },
];
const results = await Promise.all(jobs.map(async job => {
  if (!process.env[job.key]?.trim()) return { file: job.file, status: "not_configured", passed: 0, failed: 0, skipped: 0 };
  return new Promise<Record<string, unknown>>(resolve => {
    const child = spawn("bun", ["test", job.file], { windowsHide: true, env: { ...process.env, [job.flag]: "1" }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", timedOut = false;
    child.stdout.on("data", value => output += value); child.stderr.on("data", value => output += value);
    const deadline = setTimeout(() => { timedOut = true; child.kill(); }, 180000);
    child.on("close", exit => {
      clearTimeout(deadline);
      const count = (kind: string) => Number(output.match(new RegExp(`(?:^|\\n)\\s*(\\d+) ${kind}\\b`))?.[1] ?? 0);
      // Print/store only test labels, capability metadata and counts, never
      // provider output, credentials, stack traces or arbitrary error bodies.
      const evidence = output.split("\n").filter(line => /^\{"(?:capability|provider)":/.test(line) || /^\(fail\)/.test(line));
      const result = { file: job.file, status: exit === 0 ? "passed" : "failed", exit, timedOut, passed: count("pass"), failed: count("fail"), skipped: count("skip"), evidence };
      console.log(JSON.stringify(result)); resolve(result);
    });
  });
}));
await mkdir("test-artifacts/sepb", { recursive: true });
await writeFile("test-artifacts/sepb/live-provider-probes.json", JSON.stringify({ scope: "local configured providers only; not a hosted authenticated workflow", results }, null, 2));
process.exitCode = results.some(result => result.status !== "passed") ? 1 : 0;
