import "server-only";
import { db } from "@/lib/db";

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Too many attempts. Please wait and try again.");
  }
}
export async function enforceRateLimit(key: string, action: string, maximum: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  const count = await db.securityAttempt.count({ where: { key, action, createdAt: { gte: since } } });
  if (count >= maximum) throw new RateLimitError(Math.ceil(windowMs / 1000));
  await db.securityAttempt.create({ data: { key, action } });
  if (Math.random() < 0.02) void db.securityAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } });
}
