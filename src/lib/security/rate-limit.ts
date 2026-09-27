import "server-only";
import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Too many attempts. Please wait and try again.");
  }
}

function rateLimitSecret() {
  const configured = process.env.AUTH_SESSION_SECRET || process.env.DEV_MODE_SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV !== "production") return "scholar-local-rate-limit-pseudonym-key-only";
  throw new Error("AUTH_SESSION_SECRET is not configured securely");
}

/** Stable, server-pseudonymized limiter key; never persist raw email/IP data. */
export function opaqueRateLimitKey(namespace: string, value: string) {
  const digest = createHmac("sha256", rateLimitSecret()).update(value).digest("hex").slice(0, 32);
  return `${namespace}:${digest}`;
}

export function requestRateLimitKey(request: Request, namespace: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
  return opaqueRateLimitKey(namespace, ip);
}
export async function checkRateLimit(key: string, action: string, maximum: number, windowMs: number) {
  const count = await db.securityAttempt.count({ where: { key, action, createdAt: { gte: new Date(Date.now() - windowMs) } } });
  if (count >= maximum) throw new RateLimitError(Math.ceil(windowMs / 1000));
}

export async function enforceRateLimit(key: string, action: string, maximum: number, windowMs: number) {
  const retryAfterSeconds = Math.ceil(windowMs / 1000);
  await db.$transaction(async (tx) => {
    // Serialize the check-and-record sequence for this exact limiter bucket.
    // Without the advisory lock, concurrent requests can all observe the same
    // count and exceed the configured ceiling before any insert commits.
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${action}\u001f${key}`}, 0)
      )
    `;
    const since = new Date(Date.now() - windowMs);
    const count = await tx.securityAttempt.count({ where: { key, action, createdAt: { gte: since } } });
    if (count >= maximum) throw new RateLimitError(retryAfterSeconds);
    await tx.securityAttempt.create({ data: { key, action } });
  });
  if (Math.random() < 0.02) void db.securityAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } }).catch(() => console.warn("[Scholar security] attempt cleanup deferred"));
}
