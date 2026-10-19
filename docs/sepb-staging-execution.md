# SEPB staging execution — October 8, 2026

Verdict: **NOT READY**. Staging is deployed; authenticated, provider and physical-device certification are not inferred from unit tests.

## Authority and preservation

The user explicitly approved the initial `sepb-rc` push, separate Vercel project and empty Neon Free resource. Later approvals cover existing local Groq/Gemini keys in staging, one video up to 45 seconds and up to five LAM text checks, and four controlled disposable staging accounts with generated private passwords, second-account Plus and fourth-account Developer/admin access. No main push, production configuration/data change, plan upgrade or real-user subscription mutation is approved. OAuth/sender setup guidance requested; no permission/key creation performed automatically.

Local branch: `sepb-rc`, based on `15904c7d2743c71578b537fef9728413b13f01e0`. Pushed and remote verified: `fd530f1505229c4fbfcdce718d87cccb9d6a1edd`. Remote main remains at the base SHA. The original production `.vercel/project.json` and root `.env.local` remain unchanged. Excluded: `NEW PROJECT/`, APK backup, stray filename, old untracked screenshots, `.sepb-staging/`, all env files/secrets. Only reviewed files staged individually.

## Provisioned resources (verified, not example identifiers)

- Team: `scholar-team`, `team_bwSp2TtAg4dJSB3TZFDwSBP2`, existing Hobby plan.
- New Vercel project: `scholar-staging`, `prj_qEKBWcZ7hIglNnAzTq5eEDCrxEzI`.
- Assigned and verified domain: https://scholar-staging.vercel.app. **READY**, deployment `dpl_B79wZQCJfCWivJk9TwSoX1xvpjfT`, source `sepb-rc` / `fd530f1`; immutable URL https://scholar-staging-dab3ouxst-scholar-team.vercel.app.
- New Neon resource: `scholar-staging-db`, `store_TFiUnWEoUMyWPdh2`, project `fancy-block-60401397`, Singapore `sin1`, `free_v3`, auth=false.
- Resource attached only to the new staging project, in its own production/preview/development environments. “Production” here is Vercel's target label in **the staging project**, not production Scholar.
- New staging pooled/direct credentials pulled only into ignored `.sepb-staging/.env.local`. Endpoint matches the new provider project, pooled/direct roles and databases agree; TLS required. Endpoint SHA-256: `387d29a1fa8b291d5c9ac0efc22f4a79489817eb81c1778a4dc1fb083a598bc2`.
- Existing production project/resource: `prj_iqaYcEZ8dM5exaqw3F7XtnyiY2sI` / `store_ODPDj9wEwSpUaJMP`, untouched.

## Guard and storage

Production project's current preview metadata shares DB/session variables with its production target. RC code now refuses a `sepb-rc` build in that project before migration. Staging builds/runtime pin the actual project, resource, Neon project, endpoint, TLS, direct migration connection, origin and non-placeholder session secret. Migration CLI refuses unconfigured local RC execution. Existing main behavior is preserved.

Private PDF bytes, custom E-Books, resource processing, generated AI narration/state and Group Study uploaded bytes are stored in PostgreSQL; the new database isolates them. Generic local files use owner-scoped IndexedDB, isolated by the new staging browser origin. No production file copy or additional paid object storage is needed for these existing paths. Live storage/persistence/owner-denial tests remain pending.

## Checkpoint

- Focused boundary/migration/origin tests: 14 passed, 0 failed.
- Core staging env, unique session/connector/audit/worker secrets: configured in the new project's production/preview/development targets. Hosted secret values entered via stdin, not process arguments/logs. Developer Mode disabled; billing remains the existing fail-closed placeholder; no payment destination configured.
- Database SQL identity/writable/empty proof: passed. Database/role matched provisioned direct URL, public-schema CREATE privilege true, read-only off, not a recovery replica, zero public tables before migration.
- Migration status: exactly 16 pending migrations on the empty stage; reviewed additive table/index/constraint chain, nullable-password change and LearningProfile backfill. Guarded migrate deploy applied all 16; afterward User/CustomEbook/GroupStudyRoom/AIVideo counts all zero. No reset/db push/data clone.
- Git connection to `frienasduck/Scholar-V1`: verified. Staging primary-environment tracking saved as `sepb-rc` in dashboard and confirmed in project metadata. Only staging settings changed.
- Google login/Drive: separate staging clients/callback setup pending; real callback not tested.
- Email: approved sender/service and delivery verification pending.
- Disposable controlled Free/Plus/second Free/Developer identities: user supplied four addresses and approved generated passwords in staging Development configuration and a fail-closed staging-only Plus/admin provisioning tool. No accounts created yet; no addresses/passwords copied into Git.
- AI provider tests: limited budget approved above. Existing local Groq/Gemini keys configured only in stage via stdin. Zero new provider calls; deployment rebuild to activate those newly added variables pending. No unrestricted retries or plan upgrade.
- Authenticated PDF/LAM/Plus/Group Study/music, mobile interactions and hardware certification: pending.

Current validation: **886 pass, 0 fail, 14 skip / 93 isolated files**, focused boundary/migration/origin **14/0**; initial candidate TypeScript, lint, production build and diff checks passed. Previously started anonymous deployed smoke **16/0** (public routes, staging noindex/canonical, private API denial/cache, empty guest exam sessions, pre-write guest/foreign-origin rejection). The new AI-env and staging-smoke helpers are local, not part of the initial pushed commit. No new paid/provider probe executed.

## Permission boundary and next action

User completed Vercel sign-in. Branch tracking screenshot: `test-artifacts/sepb/staging-branch-tracking.jpg` (no values revealed).

The first browser navigation to https://scholar-staging.vercel.app was explicitly rejected because permission for that domain was denied. No alternate browser, raw CDP, indirect page access or other workaround attempted. The previously authorized, already-running env setup/smoke completed; API checks are not substituted for browser journeys. Further full-flow certification is paused until the user allows this domain in Codex. Other setup responses are now received; do not ask for those approvals again.

## Secure OAuth/email setup guide

1. In Google Cloud's Credentials / Google Auth Platform, select an appropriate user-owned project and create a **separate staging Web OAuth client**. Preserve production client settings. Exact JavaScript origin: `https://scholar-staging.vercel.app`. Sign-in redirect: `https://scholar-staging.vercel.app/api/auth/google/callback`.
2. A separate Drive staging client uses redirect `https://scholar-staging.vercel.app/api/connections/google-drive/callback`; enable Drive API and keep the existing narrow `https://www.googleapis.com/auth/drive.file` permission. Configure approved Google test users if the consent app is in testing. User completes client creation and consent in the secure service interface; no tokens copied from another app/browser.
3. Enter GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET and GOOGLE_DRIVE_CLIENT_ID/GOOGLE_DRIVE_CLIENT_SECRET in **scholar-staging**, not scholar-v1. Hosted secrets should be Secret type, scoped to staging project's Production/Preview; distinct Development configuration supports local staging QA. Do not paste credentials in chat.
4. In Resend, use a verified sender/domain the user controls (ownership/DNS verification requires user action). Configure a staging-scoped RESEND_API_KEY and RESEND_FROM_EMAIL in the same staging project. Never spoof a Gmail sender or silently purchase a plan.
5. Redeploy staging after configuration, verify presence through redacted metadata/public auth status, then test actual Google/Drive callback/cancel/replay, verification delivery and reset expiry/single-use/session revocation. Config presence or mocks alone cannot pass these gates.

## Configuration audit

| Category | Current status |
|---|---|
| Core/authentication | Stage identity/origin pins, AUTH_BASE_URL and unique AUTH_SESSION_SECRET set; native secure host-scoped cookies preserved; controlled accounts not yet created |
| DB/storage | DB_DATABASE_URL, DB_DATABASE_URL_UNPOOLED and DB_NEON_PROJECT_ID set; 16 migrations applied; 49 public tables afterward |
| AI | GROQ_API_KEY/GEMINI_API_KEY configured after first deploy, bounded budget approved; rebuild and real calls pending |
| Background jobs | RESOURCE_WORKER_SECRET/LAMTUBE_WORKER_SECRET independent; dispatch/leases/recovery still need real hosted evidence |
| Connectors/audit | CONNECTOR_TOKEN_SECRET/AUDIT_LOG_SALT independent; Google clients still absent |
| Email | Actual hosted auth config reports recovery/verification unavailable; sender/key setup and actual delivery pending |
| Media/Group Study | Existing DB-backed room/media paths preserved; optional TURN configuration only if necessary/approved; no mic/camera permission activated |
| Billing/Developer | Existing placeholder billing, no payment destination; Developer Mode disabled until approved staging test setup; no real purchase/subscription mutation |

## Certification snapshot — required deliverables

| Gate | Evidence / remaining status |
|---|---|
| Staging URL/deployment/candidate | Actual URLs, READY deployment and pushed SHA above; `sepb-rc` tracking verified |
| Database isolation | Separate resource/project/endpoint pinned; SQL identity/write/empty proof; 16 migrations; no production credentials/data accessed |
| Storage isolation | New PostgreSQL for private bytes; distinct-origin owner-keyed local stores; real durability/access-denial test pending |
| Google login / Drive / email | Setup + real consent/callback/delivery/expiry/replay/revocation unverified |
| Accounts / Plus / Developer | Four controlled addresses and staging-only provisioning approved; not yet created/granted; no fabricated access state |
| Full new-student journey | Not run: browser permission denied at first staging navigation |
| PDF / E-Book / LAM | Parser/OCR/security regression evidence retained; full authenticated hosted grounding, persistence and cross-account denial unverified |
| Group Study | Migrated; genuinely separate-client synchronization/permissions/reconnect/media unverified |
| AI Video | Keys configured, zero hosted generations; background/timeline/playback/captions/quota/recovery unverified |
| Study Music | Existing audio-first/visible YouTube compliance/Plus gate preserved; real Plus library/playback journey unverified |
| Mobile / Android WebView | Prior 92 local emulated observations are historical, not new staging/hardware evidence; native shell unchanged; physical keyboard/picker/OAuth/media/back/lifecycle pending |
| Security / failure recovery | Boundary negatives and 16 anonymous deployed checks pass; real cross-user/Plus/OAuth/Drive/rate/failure paths pending |
| Exact checks | 886 pass/0 fail/14 opt-in skip across 93 files; focused 14/0; initial TS/lint/build/diff passed; deployed anonymous smoke 16/0; no new AI calls |
| Modified files | Initial commit: 21 reviewed guard/config/source/test/report/Settings-log files. Pending local AI-env helper, staging-smoke helper/results, report checkpoint and branch screenshot. No unrelated artifact added |
| Outstanding user actions | Allow staging-domain browser access; secure Google client and verified Resend setup per guide; later complete consent and physical-device tests. Previously approved accounts/AI budget need no repeat approval |
| Final verdict | **NOT READY**. Deployment success is not certification; essential authenticated/provider/OAuth/multiplayer/device gaps remain |

Vercel CLI/Env/Storage/Deployments/Bootstrap and provider Neon/Postgres skills guided explicit project targeting, Free-only provisioning, pooled/direct separation, secret stdin handling and fail-closed isolation. No skill-driven UI replatforming or production mutation occurred.
