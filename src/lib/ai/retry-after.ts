/** Provider header metadata only; no sleeps, credentials or quota rotation. */
export function retryAfterSeconds(error: unknown, now = Date.now()): number | undefined {
  if (!error || typeof error !== "object" || !("headers" in error)) return undefined;
  const headers = error.headers;
  const raw = headers instanceof Headers ? headers.get("retry-after") : headers && typeof headers === "object" ? Object.entries(headers).find(([key]) => key.toLowerCase() === "retry-after")?.[1] : undefined;
  if (typeof raw !== "string" || raw.length > 100) return undefined;
  const seconds = /^\d+(?:\.\d+)?$/.test(raw.trim()) ? Number(raw) : (Date.parse(raw) - now) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 2147483647 ? Math.max(1, Math.ceil(seconds)) : undefined;
}
