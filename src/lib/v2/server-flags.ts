import "server-only";
import { db } from "@/lib/db";
import { isFlagEnabled, type FlagOverrides, type V2FlagKey } from "@/lib/v2/flags";

/**
 * Server-only DB-backed flag overrides (FeatureFlag table). Read with a short
 * TTL cache so the hot path stays cheap. Failure is silent and degrades to
 * env/default evaluation — flags must never fail open into less safety.
 */

const TTL_MS = 30_000;

let cache: { rows: FlagOverrides; at: number } | null = null;

export async function serverFlagOverrides(): Promise<FlagOverrides> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.rows;
  try {
    const rows = await db.featureFlag.findMany();
    const overrides: FlagOverrides = {};
    for (const row of rows) overrides[row.key as V2FlagKey] = row.enabled;
    cache = { rows: overrides, at: now };
    return overrides;
  } catch (error) {
    console.error("[Scholar v2 flags] DB override lookup failed", error instanceof Error ? error.message : "unknown");
    return {};
  }
}

export async function isServerFlagEnabled(key: V2FlagKey, userId?: string | null): Promise<boolean> {
  const overrides = await serverFlagOverrides();
  return isFlagEnabled(key, { userId, overrides });
}

export async function setServerFlag(key: V2FlagKey, enabled: boolean, rolloutPct = 100): Promise<void> {
  await db.featureFlag.upsert({
    where: { key },
    create: { key, enabled, rolloutPct },
    update: { enabled, rolloutPct },
  });
  cache = null;
}
