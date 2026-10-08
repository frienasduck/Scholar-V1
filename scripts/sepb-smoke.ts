import { mkdir, writeFile } from "node:fs/promises";

// Non-mutating localhost smoke: no cookies, accounts, uploads, provider calls,
// migrations, production writes or fabricated signed-in state.
const origin = new URL(process.argv[2] || "http://localhost:3003");
if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw new Error("This smoke runner is local-only; live journeys need explicit disposable test accounts.");
const results: { path: string; status: number; expected: string; passed: boolean; cache?: string | null }[] = [];
for (const path of ["/", "/login", "/help", "/privacy", "/terms", "/updates", "/sitemap.xml"]) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  results.push({ path, status: response.status, expected: "200 + nonempty public response", passed: response.status === 200 && text.length > 20 });
}
for (const path of ["/api/ebooks", "/api/lamtube", "/api/connections", "/api/files/quota", "/api/study-music/library", "/api/v2/intelligence/state"]) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000) });
  const cache = response.headers.get("cache-control");
  results.push({ path, status: response.status, cache, expected: "401/403 + private,no-store; unauthenticated access denied", passed: [401, 403].includes(response.status) && Boolean(cache?.includes("private") && cache.includes("no-store")) });
}
// Exam Ready intentionally exposes the early-beta access policy to guests,
// but never another account's sessions. Source contract: exam-ready/route.ts
// and exam-ready-security.test.ts. A generic 401 expectation was incorrect.
const exam = await fetch(new URL("/api/exam-ready", origin), { signal: AbortSignal.timeout(15000) });
const examValue = await exam.json();
results.push({ path: "/api/exam-ready guest policy", status: exam.status, expected: "200 with exactly zero private sessions", passed: exam.status === 200 && Array.isArray(examValue.sessions) && examValue.sessions.length === 0 });
const guestCreate = await fetch(new URL("/api/exam-ready", origin), { method: "POST", headers: { Origin: origin.origin, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(15000) });
results.push({ path: "POST /api/exam-ready guest", status: guestCreate.status, expected: "401 before creation", passed: guestCreate.status === 401 });
// Cross-origin request is rejected before authentication, body parsing or writes.
const rejected = await fetch(new URL("/api/ebooks", origin), { method: "POST", headers: { Origin: "https://untrusted.example", "Sec-Fetch-Site": "cross-site" }, signal: AbortSignal.timeout(15000) });
results.push({ path: "POST /api/ebooks foreign origin", status: rejected.status, expected: "403 before any write", passed: rejected.status === 403 });
const report = { scope: "anonymous HTTP smoke only, not authenticated persistence/device/provider certification", passed: results.filter(row => row.passed).length, failed: results.filter(row => !row.passed).length, results };
await mkdir("test-artifacts/sepb", { recursive: true });
await writeFile("test-artifacts/sepb/http-smoke.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.failed ? 1 : 0;
