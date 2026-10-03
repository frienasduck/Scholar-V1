# LAMTube mobile and background generation repair — 3 October 2026

## Outcome

Implemented generation-flow fixes, a clearer progress screen, mobile adaptations, and owned AI lessons at the start of LAMTube's video grid. Live database-backed generation is **not verified**: the local configuration supplies a legacy SQLite `file:` URL, while Scholar's schema and LAMTube tables require PostgreSQL. No credentials were changed, no migration was applied, and nothing was staged, committed, pushed or deployed.

## Causes found

- Generation previously depended on a `retry`/`step` loop owned by the AI Video workspace. Leaving that screen aborted the loop, so saved stages stopped advancing.
- Fast generation could exhaust the shared AI burst limit and incorrectly turn a recoverable cooldown into a failed lesson.
- Generated lessons lived in a separate AI library, not the main LAMTube video grid.
- Phone layouts had narrow two-column form/library layouts, cramped subject filters, icon-only tabs and undersized playback targets. The AI Video tab was at the far end of the mobile rail.
- Locally, `DB_DATABASE_URL` is absent and the standard `DATABASE_URL` has the SQLite `file:` protocol. A standard PostgreSQL URL is now accepted as a fallback, but a SQLite URL cannot satisfy the PostgreSQL schema. `bun run scripts/lamtube-readiness.ts` reports `postgresConfigured:false` without printing credentials.

## Processing and safety

`start` and explicit `retry` save the job and return HTTP 202 before provider work. Next.js `after()` runs a bounded 45-second server batch within the route's 60-second limit. The global Scholar shell observes owned jobs and resumes saved stages independently of which study section is open. Polling observes progress every ten seconds during generation but does not repeatedly dispatch the same active batch.

Existing ownership, origin checks, class entitlements, database leases, revision fencing, private audio and success-only monthly accounting remain intact. Passive heartbeats do not restart failed or cancelled jobs. Local shared-AI cooldowns persist a retry time instead of failing/refunding completed work. Near-deadline batches leave provider stages for a fresh batch. Stale client responses cannot rewind newer lesson revisions; account changes clear the visible library scope.

This is background processing **while using Scholar**, not a newly provisioned always-on queue. Already-dispatched work can finish after leaving a screen. If Scholar is fully closed, unfinished stages resume on return; uninterrupted closed-browser processing still requires the separately configured worker/scheduler. No workflow dependency or scheduling service was added.

## Presentation

- Five named creation stages, gentle transform/opacity motion, real saved-stage progress, saved scene/phrase counts, explicit errors, cancellation/retry and “Continue in background.”
- Newest created AI lessons lead the existing video grid; generating cards reopen progress. Grade, subject, search, saved and history filters apply. Lessons remain private rather than being published to everyone.
- Readable horizontal navigation with AI Video second, non-shrinking subject pills, one-column phone settings/library, larger touch controls, clearer captions and a larger phone scene viewport. The mini-player avoids the bottom menu/safe area.
- Removed heavy glass backdrop filtering around embedded playback. Reduced-motion behavior remains available.
- Corrected the existing LAMTube hero/tutor prompts to use the selected class rather than hardcoded Class 9.
- Settings → Update logs includes this repair dated 3 October 2026.

## Validation

- 70 focused tests across six isolated LAMTube files pass: pipeline/background batching (11), background API route (4), feed/progress rendering (7), timeline/WAV/schema/access (29), quota (9), security/private audio (10).
- TypeScript no-emit and focused ESLint pass. Production build passes. Git diff whitespace check passes.
- Actual browser checks at 320×740, 390×844, 768×1024 and 1366×768: no horizontal document overflow or framework error overlay. Preview playback, chapter seeking, captions, speed selection and navigation verified; browser error logs were empty. This authored silent preview is not evidence of live AI/TTS generation.
- The development server hit a Turbopack hot-reload panic during QA. Only the agent-started Scholar dev process was restarted; the final LAMTube load was verified cleanly. No dependency changes or cache deletions were used for recovery.
- `lamtube-readiness` intentionally fails the PostgreSQL prerequisite locally. Table/migration presence, live AI narration storage, real completion/account billing and production behavior remain unverified until PostgreSQL is configured and existing migrations are applied through the approved deployment process.

## Files

Updated: `src/lib/db.ts`, `scripts/lamtube-readiness.ts`, `src/app/api/lamtube/[id]/route.ts`, `src/lib/lamtube/{actions,generate,model,store}.ts`, `src/components/app-shell.tsx`, `src/components/lamtube/{workspace.tsx,lamtube.css}`, `src/components/views/{nigtube,settings}.tsx`, `tests/lamtube-pipeline.test.ts`.

Added: `src/lib/lamtube/{jobs,library,feed}.ts`, `src/components/lamtube/{background-jobs,generation-progress,feed-card}.tsx`, `tests/lamtube-background-route.test.ts`, `tests/lamtube-feed.test.tsx`, this report.

Unrelated working-tree files and Android artifacts were preserved untouched.
