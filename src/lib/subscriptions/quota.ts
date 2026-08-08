/**
 * Pure generation-quota evaluation. A negative limit means unlimited (Plus
 * defaults); otherwise a single daily counter in the user's timezone is
 * compared against the limit. Kept free of server-only imports so the math
 * is unit-testable — the DB-backed callers in usage.ts are the only place
 * the counter is actually read or written.
 */
export type QuotaStatus =
  | { kind: "unlimited"; remaining: -1 }
  | { kind: "ok"; used: number; limit: number; remaining: number }
  | { kind: "exhausted"; used: number; limit: number };

export function evaluateQuota(limit: number, used: number): QuotaStatus {
  if (limit < 0) return { kind: "unlimited", remaining: -1 };
  if (used >= limit) return { kind: "exhausted", used, limit };
  return { kind: "ok", used, limit, remaining: limit - used };
}

/** True when the configured limit means "no daily cap" (Plus default). */
export function isUnlimited(limit: number): boolean {
  return limit < 0;
}
