# SEPB staging execution — October 8, 2026

Verdict: **NOT READY**. Infrastructure setup is in progress; authenticated and physical-device certification are not inferred from unit tests.

## Authority and preservation

The user explicitly approved the initial `sepb-rc` push to `frienasduck/Scholar-V1`, creation of `scholar-staging`, and an empty Neon resource on the confirmed Free plan. No main push, production configuration/data change, plan upgrade, real-user subscription mutation, or billable AI test is approved.

Local branch: `sepb-rc`, based on `15904c7d2743c71578b537fef9728413b13f01e0`. Candidate commit/push pending. The original production `.vercel/project.json` and root `.env.local` remain unchanged. Excluded: `NEW PROJECT/`, APK backup, stray filename, old untracked screenshots, `.sepb-staging/`, all env files/secrets. Only reviewed files are staged individually.

## Provisioned resources (verified, not example identifiers)

- Team: `scholar-team`, `team_bwSp2TtAg4dJSB3TZFDwSBP2`, existing Hobby plan.
- New Vercel project: `scholar-staging`, `prj_qEKBWcZ7hIglNnAzTq5eEDCrxEzI`.
- Assigned and verified domain: https://scholar-staging.vercel.app. Not deployed yet.
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
- Git connection to `sepb-rc`, staging build/deployment: pending.
- Google login/Drive: separate staging clients/callback setup pending; real callback not tested.
- Email: approved sender/service and delivery verification pending.
- Disposable controlled Free/Plus/second Free/Developer identities: approval/setup pending. No production users borrowed.
- AI provider tests: no new billable calls; a bounded generation budget still needs explicit approval.
- Authenticated PDF/LAM/Plus/Group Study/music, mobile interactions and hardware certification: pending.

Current local validation: 886 pass, 0 fail, 14 skip / 93 isolated files; production compilation/build passed; final lint/TypeScript recheck underway. Vercel browser dashboard is signed out; secure user sign-in requested. CLI project/env provisioning remains available. Controlled email identities requested; no addresses invented or users created.

Vercel CLI/Env/Storage/Deployments/Bootstrap and provider Neon/Postgres skills guided explicit project targeting, Free-only provisioning, pooled/direct separation, secret stdin handling and fail-closed isolation. No skill-driven UI replatforming or production mutation occurred.
