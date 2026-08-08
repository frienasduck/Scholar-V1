# Scholar V2 — Architecture Inventory & Platform Map

> Status: **P0 platform core batch** (feature flags, entitlement service surface, billing adapter boundary, idempotent usage ledger, shared TTS, ad orchestrator, LAM action framework, V2 schema).
> Generated from a full inspection of Scholar-V1. This document is the mandated repository map produced before V2 abstractions were introduced.

## 1. Stack inventory (verified in repo)

| Layer | Implementation | Location |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript | `package.json` |
| Runtime | Node + Bun 1.3 (bun.lock frozen) | `package.json`, `bun.lock` |
| ORM | Prisma 6 (PostgreSQL) | `prisma/schema.prisma` |
| DB | PostgreSQL (`DB_DATABASE_URL` / `DB_DATABASE_URL_UNPOOLED`) | `.env.example` |
| State | Zustand + localStorage persist (`neha-scholar-v5`) | `src/lib/store.ts` |
| Styling | Tailwind 4, shadcn/ui, framer-motion, liquid-glass system | `globals.css`, `tailwind.config.ts` |
| Auth | Custom cookie sessions (HMAC hashes, DB `Session` rows) | `src/lib/auth/session.ts` |
| Developer Mode | Server-side: `DEV_MODE_ENABLED` + `DEV_MODE_PASSWORD_HASH`, signed dev cookie, rate-limited login, audit | `src/app/api/developer/session/route.ts` |
| Payments | Manual UPI proof flow (payment requests → admin review → `ScholarSubscription`) | `src/lib/subscriptions/payment.ts`, `api/subscriptions/*` |
| AI | `/api/ai` Groq text route; LAM isolated; AISIG image routes | `src/lib/ai/`, `src/app/api/ai/` |
| PWA | `public/sw.js`, `public/manifest.json`, sw-register, install prompt | `public/`, `src/components/` |
| Tests | `bun test` units (`tests/*.test.ts`) + Playwright e2e (`tests/*.spec.ts`) | `tests/` |

## 2. Domain map — what V1 already has

- **Entitlements (server-authoritative):** `resolveUserEntitlements`, `hasEntitlement`, `requireEntitlement`; plans `FREE | PLUS | DEVELOPER | UNLOCKED`; 18 capability keys. `src/lib/subscriptions/entitlements.ts`
- **Generation quota (centralized, atomic):** `UsageCounter` (userId+key+day unique), pre-check + consume-after-success; failed generations never burn quota; timezone-aware day boundary. `src/lib/subscriptions/usage.ts`, `quota.ts`, `usage-day.ts`
- **Audit:** `recordAudit` with key redaction + IP hashing. `src/lib/subscriptions/audit.ts`
- **Ads (pre-roll):** pure state machine — 10s Plus promo, skip after countdown, Plus bypass, "checking" gate. `src/lib/subscriptions/nigtube-ad.ts`
- **Study Music promo + Tutor Plus card gating:** `src/lib/subscriptions/promo.ts`
- **TTS heuristics:** en-GB → Microsoft female → female → any → default in `src/lib/reminders/talk.ts`; plus `use-speech.ts`.
- **Reminders 2.0:** engine, scheduler, talk, custom commands (template-bound), lam-actions.
- **Security baseline:** `SecurityAttempt` rate limiting, CSRF-friendly cookies, audit, dev-mode throttling, postgres security tests.

## 3. Gap analysis (V1 → V2)

| V2 requirement | V1 status | V2 action in this batch |
|---|---|---|
| Feature flags | ❌ none | `src/lib/v2/flags.ts` + `FeatureFlag` table |
| Capability entitlement API (`entitlementService.resolve`) | ✅ exists (plan-based) | `src/lib/v2/entitlements.ts` capability mapping |
| Billing provider abstraction + webhook | ❌ manual UPI only | `src/lib/v2/billing/*` + `/api/v2/billing/webhook` (placeholder, never grants Plus) |
| Idempotent usage reservations | ⚠️ pre-check/consume, no idempotency keys | `src/lib/v2/usage/ledger.ts` + `UsageEvent` |
| Shared TTS service | ⚠️ duplicated heuristics in 3 places | `src/lib/v2/tts/*` (scoring per blueprint) |
| Ad orchestrator (placements, caps, mid-roll) | ⚠️ pre-roll only | `src/lib/v2/ads/orchestrator.ts` |
| LAM action framework (risk, budgets, allowlist) | ⚠️ lam-actions exist, no risk/budget layer | `src/lib/v2/lam/action-framework.ts` |
| V2 schema (Entitlement, UsageEvent, Ad*, Automation*, Push, Analytics, FeatureFlag) | ❌ | migration `20260809000000_v2_platform_core` |
| Durable workflows / sync / push / offline outbox | ❌ | deferred (P1, behind flags) |
| Developer Mode hardening | ✅ already server-secured | verified; no change needed |

## 4. Consolidation rules adopted

1. **Entitlements stay single-sourced.** V1 plan resolution remains the authority; the V2 capability layer is a typed view over it. `user.isPlus` / localStorage flags were not introduced.
2. **Quota stays on `UsageCounter`.** The ledger adds reservation/idempotency bookkeeping as `UsageEvent` rows over the *same* counter — one ledger, not two.
3. **Ads stay pure.** The orchestrator decides; the existing `nigtube-ad` machine still drives the countdown. Campaign durations/skip delays are data-driven.
4. **No new user/Plus system.** Everything maps to the existing `User` and `ScholarSubscription`.

## 5. Feature flags (all high-risk V2 subsystems)

`v2_entitlements`, `v2_usage_limits`, `v2_nigtube_ads`, `v2_nigtube_midroll`, `v2_study_music_promo`, `v2_lam_automation`, `v2_offline_sync`, `v2_push`, `v2_developer_mode`. Flags gate *rollout*, never authorization.

> Status: flags are defined, env/DB-overridable and unit-tested, but no V2 surface is gated yet — this batch is purely additive. They will gate the future subsystem rollouts (mid-roll, LAM automation, sync, push).

## 6. Migration status

- Migration SQL written (additive, `CREATE TABLE IF NOT EXISTS`), schema updated.
- `prisma validate` + `prisma generate` run locally. **`prisma migrate deploy` is a deploy-time step** — no local Postgres in this checkout (DB URLs injected via env at deploy).

## 7. What remains (roadmap, not this batch)

Entitlement backfill from V1 subscriptions, Nigtube V2 features, Study Music V2, durable workflows + queue adapter, Web Push, sync/offline outbox, external VAST/IMA adapter, native billing, Achievements/Mind Map/Concept Galaxy implementation.
