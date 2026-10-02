/** Bounded queue drain for an external scheduler; never logs the bearer secret. */
const secret = process.env.RESOURCE_WORKER_SECRET;
const configuredUrl = process.env.RESOURCE_WORKER_URL;
if (!secret || secret.length < 32 || !configuredUrl) throw new Error("Set RESOURCE_WORKER_SECRET (32+ characters) and RESOURCE_WORKER_URL.");
const url = new URL(configuredUrl);
if (url.pathname !== "/api/resources/process" || url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("Use the trusted deployment's HTTPS /api/resources/process URL (localhost HTTP is allowed).");
const batch = Number(process.env.RESOURCE_WORKER_BATCH ?? "1");
if (!Number.isInteger(batch) || batch < 1 || batch > 20) throw new Error("RESOURCE_WORKER_BATCH must be 1–20.");
let processed = 0;
for (let i = 0; i < batch; i++) {
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` }, redirect: "error", signal: AbortSignal.timeout(65_000) });
  if (!response.ok) throw new Error(`Resource worker returned HTTP ${response.status}; check deployment logs.`);
  const result = await response.json() as { processed: boolean };
  if (!result.processed) break;
  processed++;
}
console.info(`Resource worker completed ${processed} bounded job(s).`);
export {};
