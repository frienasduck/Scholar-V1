/** Anonymous staging only; no provider calls, user writes, cookies or privileged tokens. */
import { writeFile } from "node:fs/promises";
import { STAGING_ORIGIN } from "../src/lib/staging/environment";
const results: { path: string; status: number; passed: boolean; check: string }[] = [];
for (const path of ["/", "/login", "/help", "/privacy", "/terms", "/updates", "/sitemap.xml"]) {
  const r = await fetch(STAGING_ORIGIN + path, { signal: AbortSignal.timeout(25_000) });
  const body = await r.text();
  results.push({ path, status: r.status, passed: r.status === 200 && body.length > 20 && (path !== "/" || /noindex/.test(body)) && (path !== "/sitemap.xml" || body.includes(STAGING_ORIGIN) && !body.includes("scholarofficial.vercel.app")), check: "public response; stage noindex/canonical" });
}
for (const path of ["/api/ebooks", "/api/lamtube", "/api/connections", "/api/files/quota", "/api/study-music/library", "/api/v2/intelligence/state"]) {
  const r = await fetch(STAGING_ORIGIN + path, { signal: AbortSignal.timeout(25_000) });
  const cache = r.headers.get("cache-control") || "";
  results.push({ path, status: r.status, passed: [401, 403].includes(r.status) && cache.includes("private") && cache.includes("no-store"), check: "unauthenticated denial, private/no-store" });
}
const exam = await fetch(STAGING_ORIGIN + "/api/exam-ready", { signal: AbortSignal.timeout(25_000) });
const policy = await exam.json();
results.push({ path: "/api/exam-ready", status: exam.status, passed: exam.status === 200 && Array.isArray(policy.sessions) && policy.sessions.length === 0, check: "guest policy contains no private sessions" });
for (const [path, origin, expected] of [["/api/exam-ready", STAGING_ORIGIN, 401], ["/api/ebooks", "https://untrusted.example", 403]] as const) {
  const r = await fetch(STAGING_ORIGIN + path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "Sec-Fetch-Site": origin === STAGING_ORIGIN ? "same-origin" : "cross-site" }, body: "{}", signal: AbortSignal.timeout(25_000) });
  results.push({ path: `POST ${path} ${expected === 403 ? "foreign-origin" : "guest"}`, status: r.status, passed: r.status === expected, check: "rejected before any write" });
}
const report = { origin: STAGING_ORIGIN, scope: "anonymous deployed checks only; no authenticated/physical/provider certification", passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results };
await writeFile("test-artifacts/sepb/staging-http-smoke.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
process.exitCode = report.failed ? 1 : 0;
