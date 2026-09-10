# Scholar website security, account, and data audit — 2026-09-09

This is an initial **read-only product audit**, not a certification that the flows work in production. Product code, users, payment records, migrations, and Android were not changed. The only written file for this audit is this report. No credentials or environment values are included.

## Inventory

| Area | Existing implementation | Scope and current confidence |
| --- | --- | --- |
| Database | Prisma 6 / PostgreSQL, four dated migrations, `DB_DATABASE_URL` and `DB_DATABASE_URL_UNPOOLED` | Schema and migration coverage inspected; no connection, migration, reset, or data mutation attempted. |
| Accounts | `User`, role enum USER/ADMIN, scrypt password hashes, normalized email, register/login/session/logout API routes | Static design has the expected hash, session, and role boundaries. Real account round trip not tested by this audit. |
| Sessions | Random 32-byte token, HMAC hash in `Session`, seven-day expiry, HTTP-only Secure-in-production SameSite=Lax cookie, database revocation | Logout clears auth and developer cookies in a finally block. Developer sessions are independently signed, eight hours, bound to user and sessionVersion. |
| Plans | Central legacy resolver distinguishes FREE / PLUS / DEVELOPER / UNLOCKED; active nonexpired subscription rows; premium APIs use server guards | Plus and developer have separate sources and lifecycles. Developer currently deliberately receives all premium capabilities; client dev flags alone do not authorize the server. |
| Billing | Manual UPI checkout, proof submission, protected admin review, unique transaction references, unique activation bonus ledger | A real online billing adapter is absent. V2 placeholder webhook rejects rather than granting Plus. Payment/approval was not executed. |
| Usage | Legacy UsageCounter with quiz/slideshow daily counters; separate V2 UsageEvent reservation ledger | Current `/api/ai` uses legacy quota check/consume, not V2 reservation ledger. See confirmed concurrency and optional-field issues below. |
| Files | `/api/files/quota` stores metadata per user/clientId; UI keeps actual bytes as local base64 | No working hosted file store is implemented by this path. Metadata authorization exists but does not mean files are safely persisted or synchronized. |
| Intelligence | PracticeAttempt, MistakeRecord, MasteryRecord, RevisionItem; events/revision/state APIs | Authenticated APIs and pure algorithms exist, but nonempty ingestion is presently broken and write ownership is incomplete. |
| Feature flags | Typed defaults, env evaluation, FeatureFlag DB table with 30-second cache | DB rollout percentages are stored but not applied. Public endpoint deliberately returns code defaults. |
| Analytics | AnalyticsEvent model and client `scholar:plus-cta` event hook | No AnalyticsEvent writer or persisted analytics ingestion found under `src`; monetization measurement is only partially wired. |
| Other V2 models | Entitlement, AdCampaign/AdImpression, AutomationWorkflow/Action, DevicePushSubscription | Presence in schema does not establish live end-to-end integration. Riskier feature defaults are disabled. |

## Confirmed defects and priorities

### P1 — Session outages incorrectly become logout

`src/components/subscriptions/subscription-provider.tsx` parses `/api/auth/session` JSON without checking `response.ok`. The route returns a 503 JSON object on a database outage, with no `authenticated: true`. The provider treats it as a legitimate unauthenticated response; `src/components/app-content.tsx` can then clear local auth. The provider also has no fetch deadline, so boot hydration can remain pending indefinitely on a hung connection.

Repair: reject non-2xx/invalid responses, retain the last authenticated identity during temporary refresh failure, clear privileges while account switching, and provide bounded/recoverable initial hydration. Test 503, malformed responses, network rejection, and out-of-order refresh completion.

### P1 — Intelligence ingestion always rejects nonempty batches

`src/app/api/v2/intelligence/events/route.ts` calls `ingestEventsSchema.safeParse(payload.events)` and the equivalent mistakes call. Both schemas expect a wrapper object, `{ events: [...] }` or `{ mistakes: [...] }`, not the array itself. The client sends the proper request wrapper, but the handler unwraps it before validation. Every populated batch is rejected; an empty sync can misleadingly succeed.

A local, non-network schema probe reproduced this: the route's array input returned `success: false`, while `{events: [sameEvent]}` returned `success: true`.

Repair: validate the actual bounded request object; reject malformed or null payloads; add a route contract test with nonempty events and mistakes.

### P1 — Intelligence upserts do not enforce ownership

`src/lib/v2/intelligence/server.ts` uses `upsert({ where: { id: event.id }, ... })` and `where: { id: mistake.id }` for client-provided IDs. The create branch sets userId, but the update branch does not constrain userId. A supplied ID belonging to another account can update that account's correctness/score or mistake resolution state. This is currently behind the ingestion bug above; fixing ingestion alone would expose the defective mutation path.

Repair together with ingestion: make existing-record lookups/updates account-bound, reject conflicts without disclosing another user's record, and test owner vs foreign-ID writes. `revision` currently does owner-constrained reads and updateMany for manual ordering, which is the safer pattern.

### P1 — Developer lockout is checked after password evaluation

`src/app/api/developer/session/route.ts` runs `verifyPassword` before checking the failed-attempt rate limit, and only runs the limiter on a wrong result. An account already over its attempt limit still evaluates every password; a correct guess bypasses the lock entirely. Login/register do check their limiter before password work, although their limiter has concurrency limitations below.

Repair: check lockout before password derivation, record failed attempts separately, and clear or expire failure state according to policy. Successful logins should not use failed-attempt capacity, but they must respect an existing lockout.

### P1 — Browser data is not account-isolated

The main store uses the global `neha-scholar-v5` key, profile helpers use `scholar:class9:*` / `scholar:class11:*`, and LAM uses `scholar-lam-v1-class-9` / `scholar-lam-v1-class-11`. These keys contain notes, tasks, files, conversations, and progress but no server account identifier. `setAuthed(false)` does not clear or replace those datasets. Normal account switching can therefore expose the previous local profile to the next account on the same browser. Guest startup resets main in-memory state, but class-scoped modules remain independently persisted.

Repair requires care: introduce account namespaces and a non-destructive one-time migration or explicit local-data import choice. Do not silently erase existing user work or attribute ambiguous legacy data to a different person. Also stop schema/version and heuristic cleanup from deleting real notes without recovery: current `loadPersistedState` removes old-version keys and resets data based on phrases such as “photosynthesis.”

### P1 — File “upload” can lose the file while reporting success

`src/components/views/files.tsx` reserves metadata/quota first, then only reads bytes when `file.size <= 20 MB`. Files above 20 MB are still added and reported uploaded with no bytes or URL. Smaller files use base64 inside the main localStorage state; `savePersistedState` silently ignores quota errors, so a file can appear in memory and vanish after reload. FileReader has no `onerror` rejection, network errors can leave `uploading` true, and sequential AI auto-tagging is awaited despite being labelled non-blocking. Generated tags are not assigned to the file.

Repair: verify durable storage before success; use a suitable local binary store or real authorized storage path, handle read/persist errors, release reservations on failure, and retain delete confirmation/undo. Do not promise cross-device file availability for the current local-only architecture.

### P1/P2 — Legacy quotas are client-optional and race-prone

`/api/ai` only checks and consumes daily usage when optional `body.usage` is supplied. Thus the caller controls whether a quota-limited generation is classified as such. The legacy `consumeGeneration` reads count and upserts within a default transaction without locking the count before checking; concurrent requests can both pass and exceed the limit. It also checks before the provider then consumes after success, so several provider calls can run before the finite quota is reserved.

Repair: derive quota policy from an explicit validated feature/mode on the server and reserve quota before calling the provider; release it on failure. Preserve intended free features rather than blanket-blocking them. This is coordinated with the AI audit.

### P2 — V2 reservation ledger ownership/idempotency is incomplete

`src/lib/v2/usage/ledger.ts` looks up globally unique idempotencyKey and returns replayed state without checking the existing event's userId, feature, or day. `commitGeneration` reads reserved status and then increments UsageCounter without atomically claiming the event, so two overlapping commits can increment twice. Unlimited requests are not serialized during reservation; same-key races can return raw unique-constraint errors rather than a consistent replay result. Current AI route does not use this ledger, so these are defects in the available next path, not proof of a current production overcharge.

Repair before integrating: scope replay keys to the requesting owner/feature, atomically claim transition, bind commit/release to the owner, and test competing calls on an isolated database or concurrency-capable mock.

### P2 — Rate and storage limit check-then-write races

`src/lib/security/rate-limit.ts` counts and creates SecurityAttempt in separate statements. Concurrent requests can exceed the stated maximum. `/api/files/quota` checks aggregate usage and creates different file rows in a transaction without locking a shared per-user resource; parallel uploads can exceed storage capacity. The upload endpoint also trusts browser-provided size metadata, which is insufficient for a future real file store.

Repair: serialize per limit bucket/user or enforce atomic conditional writes; validate actual bytes for hosted uploads. Do not deploy untested database changes into real user data.

### P2 — Incomplete entitlement failures can alter stored class

`/api/auth/session` may get `entitlementsLoaded: false`, then treats absence of class_9_access as a reason to persist Class 11 to the user. A temporary privilege lookup failure should not change the user's saved academic choice. The resolver comment says any failed lookup becomes FREE, but `plan` can still resolve PLUS/DEVELOPER from another fulfilled result; `requireEntitlement` correctly checks entitlementsLoaded, while not all downstream callers do.

Repair: do not persist class changes during failed/partial entitlement reads, and keep privilege consumers consistently fail-closed without destroying preferences.

### P2 — Feature flag rollout percentages do nothing

`setServerFlag` persists rolloutPct but `serverFlagOverrides` retains only row.enabled and `isServerFlagEnabled` supplies no rollout value. A 0% or 10% enabled DB flag becomes enabled for every account. The public flag endpoint returns defaults; UI consumers must not assume they are resolved rollout truth. Flags are not authorization.

### P2 — Checkout depends on unbounded email requests

`sendScholarEmail` has no timeout. Checkout/proof/admin routes await it after saving state, so a provider hang can make a completed database mutation appear stalled or failed. Admin review email interpolates `parsed.data.reason` unescaped, unlike the escaped helper templates. Proof PATCH catches every database update error as “transaction reference already linked,” hiding actual database failures.

Repair: bound email calls and preserve mutation success independently; escape text; classify unique-constraint errors narrowly. Receipt delivery itself requires configured email service and an authorized test recipient.

### P2 — Payment proof validation trusts declared content type

Proof upload accepts PNG/JPEG/WebP/PDF by `File.type` and 5 MB size but does not inspect file signatures. Retrieval is owner/admin scoped, private/no-store, has `nosniff`, and sanitizes the filename. Strengthen MIME/signature checks and serve potentially active documents as download or safely sandboxed preview. No malicious upload was sent during this audit.

### P2 — Store is authorization-only

`/api/store/purchase` checks sign-in and Plus for protected items, then returns `{ authorized: true }`. It does not debit coins or persist ownership on the server. The local store includes purchases/coins. This is not a complete transaction system and should remain restricted or explicitly local until implemented atomically. Do not present this as verified commerce.

## Existing strengths retained

- Password hashes are not selected into session payloads; email identity is normalized and login failures are generic.
- Admin role is read from the database. Register/login never promote a configured email into ADMIN; grant is an explicit script.
- Developer access needs a signed cookie tied to the account and sessionVersion, not localStorage.
- Manual payment proof and review routes scope records to owner or authenticated ADMIN. Viewing an emailed link never approves payment.
- Database uniqueness constrains transaction references, approved payment subscriptions, and the one-time Plus coin bonus.
- Plus capability guards reject unknown sessions and unresolved entitlements; subscription enforcement defaults on.
- Billing placeholder deliberately never grants an entitlement.
- Revision APIs bind reads and ordering writes to session user, and generation schemas bound prompt/message sizes.
- Pure mastery calculations have real evidence thresholds and return UNKNOWN/null without adequate evidence.

## Environment name inventory (values deliberately omitted)

Required account/database names in source/example: `DB_DATABASE_URL`, `DB_DATABASE_URL_UNPOOLED`, `AUTH_SESSION_SECRET`; optional developer names: `DEV_MODE_ENABLED`, `DEV_MODE_PASSWORD_HASH`, `DEV_MODE_SESSION_SECRET`.

Provider names: `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_FALLBACK_MODEL`, `GROQ_STT_MODEL`, `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`, `AISIG_NVIDIA_API_KEY`, `AISIG_NVIDIA_ENDPOINT`.

Subscription/billing names: `SUBSCRIPTIONS_ENABLED`, `SCHOLAR_PLUS_REGULAR_PRICE_INR`, `SCHOLAR_PLUS_OFFER_PRICE_INR`, `SCHOLAR_PLUS_OFFER_ENABLED`, `SCHOLAR_PLUS_OFFER_LABEL`, `SCHOLAR_PLUS_OFFER_END_AT`, `SCHOLAR_PLUS_BILLING_INTERVAL`, `SCHOLAR_PLUS_DURATION_DAYS`, `FREE_STORAGE_LIMIT_MB`, `PLUS_STORAGE_LIMIT_MB`, `FREE_DAILY_QUIZ_GENERATIONS`, `FREE_DAILY_SLIDESHOW_GENERATIONS`, `PLUS_DAILY_QUIZ_GENERATIONS`, `PLUS_DAILY_SLIDESHOW_GENERATIONS`, `SCHOLAR_UPI_QR_ASSET`, `SCHOLAR_UPI_ID`, `SCHOLAR_UPI_PHONE`, `SCHOLAR_PAYMENT_RECIPIENT_NAME`, `SCHOLAR_ADMIN_PAYMENT_EMAIL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUBSCRIPTION_PROMPT_OPEN_FREQUENCY`, `INSTALL_PROMPT_DISMISS_DAYS`, `BILLING_PROVIDER`.

Flag names: `V2_FLAG_ENTITLEMENTS`, `V2_FLAG_USAGE_LIMITS`, `V2_FLAG_NIGTUBE_ADS`, `V2_FLAG_NIGTUBE_MIDROLL`, `V2_FLAG_STUDY_MUSIC_PROMO`, `V2_FLAG_LAM_AUTOMATION`, `V2_FLAG_OFFLINE_SYNC`, `V2_FLAG_PUSH`, `V2_FLAG_DEVELOPER_MODE`. Source also uses `AUDIT_LOG_SALT` (not listed in the checked example).

The checked `.env.local` declares legacy `DATABASE_URL`, but not the two Prisma `DB_DATABASE_URL*` names, and lacks account-session/developer variable declarations. It also declares legacy NVIDIA text names. This establishes a file-level configuration mismatch only: process-injected and Vercel values were not inspected and must not be assumed absent. No attempt was made to extract or reuse credentials.

## Actual validation

Command:

```text
bun test tests/postgres-auth-security.test.ts tests/guest-mode-security.test.ts tests/subscription-security.test.ts tests/postgres-migration-coverage.test.ts tests/monetization.test.ts tests/v2-platform.test.ts tests/v2-intelligence.test.ts
```

Result: **137 pass, 0 fail, 444 assertions** (Bun 1.3.14). These include pure algorithm tests and many source-string assertions. Passing them does not verify database transactions, browser identity isolation, provider calls, or actual account access.

Additional direct local schema check: populated intelligence array rejected; correct wrapper object accepted. No network call or data write was involved.

Not performed by this audit: real login/logout/account registration; Plus activation; admin/developer password attempts; real upload/payment; production authorization probes; database concurrency; Vercel environment validation. Do not label those verified until an appropriate runtime flow passes.

## Recommended repair sequence

1. Fix session response handling and intelligence input/ownership together; add behavior-focused regression tests.
2. Correct developer lockout ordering and atomic rate/usage transitions before integrating the V2 ledger into AI.
3. Address durable file persistence and account-local isolation with recoverable legacy handling.
4. Preserve entitlements/class on partial lookup failures; bound notification side effects; correct payment input/error handling.
5. Wire resolved feature rollout and useful consent-aware event collection, keeping private prompts/notes out of analytics.
6. Validate separate signed-out, guest, free, Plus, and developer cases using isolated authorized test accounts; then validate production deployment without mutating real users.
