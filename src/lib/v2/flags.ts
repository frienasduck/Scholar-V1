/**
 * Scholar V2 feature-flag service (provider-neutral, zero deps).
 *
 * Flags gate ROLLOUT of high-risk subsystems — they are never the
 * authorization mechanism. Every protected action still performs its own
 * server-side authorization, independent of flag state.
 *
 * Evaluation order:
 *   1. explicit per-request overrides (tests / preview cohorts)
 *   2. environment override (V2_FLAG_*)
 *   3. DB-backed FeatureFlag row (via src/lib/v2/server-flags.ts)
 *   4. deterministic per-user rollout hash
 *   5. configured default
 *
 * Safe to import from client code: env lookup is guarded, so the client
 * snapshot always falls back to defaults (client can never unlock a flag).
 */

export const V2_FLAG_DEFS = {
  v2_entitlements: {
    default: true,
    env: "V2_FLAG_ENTITLEMENTS",
    description: "Capability-oriented entitlement resolution and API surface",
  },
  v2_usage_limits: {
    default: true,
    env: "V2_FLAG_USAGE_LIMITS",
    description: "Centralized idempotent usage ledger with reservations",
  },
  v2_nigtube_ads: {
    default: true,
    env: "V2_FLAG_NIGTUBE_ADS",
    description: "First-party Scholar Plus house ads on Nigtube",
  },
  v2_nigtube_midroll: {
    default: false,
    env: "V2_FLAG_NIGTUBE_MIDROLL",
    description: "Mid-roll ad architecture (frequency-capped, never in short content)",
  },
  v2_study_music_promo: {
    default: true,
    env: "V2_FLAG_STUDY_MUSIC_PROMO",
    description: "Spoken Plus promotion before Study Music for eligible Free users",
  },
  v2_lam_automation: {
    default: false,
    env: "V2_FLAG_LAM_AUTOMATION",
    description: "LAM/FICA agentic action pipeline (whitelisted, confirmed, audited)",
  },
  v2_offline_sync: {
    default: false,
    env: "V2_FLAG_OFFLINE_SYNC",
    description: "Offline outbox and cross-device sync",
  },
  v2_push: {
    default: false,
    env: "V2_FLAG_PUSH",
    description: "Web Push notification delivery",
  },
  v2_developer_mode: {
    default: true,
    env: "V2_FLAG_DEVELOPER_MODE",
    description: "Server-secured Developer Mode",
  },
} as const;

export type V2FlagKey = keyof typeof V2_FLAG_DEFS;
export const V2_FLAG_KEYS = Object.keys(V2_FLAG_DEFS) as V2FlagKey[];

export type FlagOverrides = Partial<Record<V2FlagKey, boolean>>;

export interface FlagEvalContext {
  /** Used for deterministic rollout bucketing. */
  userId?: string | null;
  /** Explicit overrides (tests, preview cohorts). */
  overrides?: FlagOverrides;
  /** Percentage bucket the user must fall into (0–100). */
  rolloutPct?: number;
}

function envBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["false", "0", "off", "no"].includes(normalized)) return false;
  if (["true", "1", "on", "yes"].includes(normalized)) return true;
  return fallback;
}

/** Deterministic stable bucket 0..99 for (flag, user). */
function bucketFor(key: V2FlagKey, userId: string): number {
  let hash = 2166136261;
  const input = `${key}:${userId}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function isFlagEnabled(key: V2FlagKey, context: FlagEvalContext = {}): boolean {
  const def = V2_FLAG_DEFS[key];

  if (context.overrides && key in context.overrides && context.overrides[key] !== undefined) {
    return context.overrides[key]!;
  }

  // Guarded env access: statically-replaced client bundles evaluate to
  // undefined here, so a client can never read server-side flag config.
  if (typeof process !== "undefined" && typeof process.env === "object" && process.env) {
    const env = process.env[def.env];
    if (env != null && env !== "") return envBoolean(env, def.default);
  }

  const rollout = context.rolloutPct ?? 100;
  if (rollout <= 0) return false;
  if (rollout >= 100) return def.default; // full rollout = plain default
  // Partial rollout only targets identifiable users; anonymous contexts keep
  // the default (a client can never unlock a flag this way).
  if (context.userId) return bucketFor(key, context.userId) < rollout;
  return def.default;
}

/** Client-safe snapshot: always the code defaults (never env/DB truth). */
export function publicV2Flags(): Record<V2FlagKey, boolean> {
  return Object.fromEntries(V2_FLAG_KEYS.map((key) => [key, V2_FLAG_DEFS[key].default])) as Record<V2FlagKey, boolean>;
}

/** Human-readable registry for tooling / admin surfaces. */
export function flagRegistry() {
  return V2_FLAG_KEYS.map((key) => ({
    key,
    default: V2_FLAG_DEFS[key].default,
    env: V2_FLAG_DEFS[key].env,
    description: V2_FLAG_DEFS[key].description,
  }));
}
