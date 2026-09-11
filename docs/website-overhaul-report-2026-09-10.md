# Scholar website overhaul — reliability release, 10 September 2026

## Scope and status

Improved the existing website in place. Android is untouched. No database reset, credential extraction, new authentication/billing system, dependency upgrade, or replacement project. This release resolves evidenced defects; the full 105-section product mission is **not yet completely verified**. Inventory: `audit-features-2026-09-09.md`; security baseline: `audit-security-2026-09-09.md`; AI evidence: `audit-ai-2026-09-10.md`.

## A. Bugs

Fixed: reminder persistence notified synchronous listeners before updating memory, recursively invoking hydrate→persist→scheduler until `Maximum call stack size exceeded`; storage-event handling wrote changes back to the other tab. Partial saved profiles replaced default mastery/progress with undefined, crashing Dashboard and LAM. Session connection failures could look like logout. Account changes reused other accounts' local records. File bytes were not durably retained for larger uploads. Old persistence heuristics could delete legitimate study records. Unknown routes rendered the app instead of 404. Landing CTA mode changes did not move users to the form; “View Demo” did not open a demo.

Remaining: race-safe legacy storage/rate counters; cross-module persistence/export completeness; external media availability; incomplete preview features. Backups protect account switching, but browser-local data is not encrypted or cloud synchronized.

## B. Errors

Resolved the reproduced reminder RangeError and undefined-mastery TypeError. AI empty/truncated/interrupted responses are failures rather than success; JSON repair is bounded. Slideshow provider errors no longer disappear into a null fallback. Public error/recovery pages do not expose raw stack traces. Source lint passes with no errors, but this is not a zero-warning certification.

Chrome observed YouTube thumbnail HTTP 404s for `jfKfPfyJRdk`, `4Tr0otuiQUU`, `w5jA8G0kS6E`, and `mPZkdNFkNpr`; the existing artwork fallback remains. This does not establish whether every associated embedded video is playable. Runtime log queries did not provide representative authenticated production traffic; absence of logs is not proof of success.

## C. AI

Audited shared consumers: LAM, AI Tutor, study explanations/checkpoints, flashcards, quiz, mock exam, answer evaluation, revision, notes and file questions, planner, summaries, academic coach, daily briefing, homework, chapter builder, experiments, derivations/code explanations, slideshow, AISIG, OCR, and transcription. The inventory distinguishes code tracing from actual use.

Root causes repaired: undersized reasoning-inclusive JSON output budget; unvalidated finish reasons; nested retry deadlines exceeding client lifetime; silent JSON errors; mismatched mock-exam/evaluation schemas; separate LAM transport and unbounded waits; non-streaming Tutor; swallowed slideshow errors; OCR worker initialization/concurrency risk. The existing Groq adapter is shared, with compatible model fallback only before any streamed answer. Provider secrets remain server-side.

Live tests: Groq `openai/gpt-oss-120b` text, checkpoint, flashcards, planner, mock exam, evaluation and stream; NVIDIA FLUX.2 Klein square/landscape image bytes. First streamed text 392ms on a short prompt; Groq totals 0.52–1.62s; images 1.55–2.14s. These are sample timings, not SLAs. Configured `openai/gpt-oss-20b` fallback was not forced in these probes. Dormant Gemini adapter was not switched on or claimed tested. Real local eBook OCR: 2,008 characters, confidence 81, 4.72s.

Browser Tutor tests use synthetic server sessions and provider envelopes: render/save/reload, provider failure exits loading, Stop discards late output. LAM cancellation and EOF integrity have code/unit coverage, not a real authenticated production conversation. Real speech transcription and protected Homework Scanner flow remain unverified.

Quota status: declared quiz requests reserve against the existing ledger, commit once after validation, release on failure. Ownership/atomic commit checks improved. **Not fully non-bypassable:** generic AI usage is optional; slideshow quota orchestration remains client-side. Fixing this properly needs a server-owned generation workflow with reservation references, not merely another optional flag. Real database concurrency and payment tests were not possible locally.

## D. UX

Mobile settings now use a bounded grid instead of a clipping multirow pill. Header flex constraints, minimum control sizes, accessible auth labels/autocomplete, skip link, genuine guest exploration, and signup scrolling improve navigation. Search includes real stored notes/files and opens those records. Removed excessive NEW labels and hid unfinished preview destinations. Existing mobile bottom navigation and desktop sidebar are retained.

Widths checked: 320, 360, 375, 390, 412, 430, 480, 600, 768, 820, 1024, 1280, 1440, 1920 on landing/settings. Seventeen routes checked at 390 and 1440. These are page-overflow/crash checks, not proof that every dialog, keyboard, player or tool is perfect at every width.

## E. Design

Preserved the existing glass, editorial typography, LAM and live-background identity; no wholesale redesign. More consistent mobile settings and footer. LAM/Tutor updates are batched; Tutor has Stop. Shared background video pauses out of view/hidden and avoids nonessential playback for reduced motion. Not every raw video/animation in the repository has been migrated or measured for GPU cost.

## F. Performance

Heavy view modules now load dynamically instead of joining the initial app-shell dependency tree. Noncritical fonts are not preloaded. Artificial login/class transition delays reduced to 1.2s. Shared AI has a 50s total budget, streaming startup/idle limits and bounded repair; OCR includes initialization in its timeout. File upload no longer waits on ignored AI tagging. Production build passes. No controlled Lighthouse/bundle-size-before-after or database latency benchmark was performed; no invented percentage speedup.

## G. Features

Improved auth recovery, Tutor/LAM transport, AI contracts, reminders, persistence, Files, settings, search and public routes. Merged duplicate Groq implementations through a compatibility export. Achievements, Mind Map, Concept Galaxy, Community, Friends and Store previews remain in code but are hidden from ordinary navigation and guarded as previews. Removed only proved-dead file-dialog markup and misleading demo data for newly created workspaces. Existing saved records are preserved, not reclassified/deleted based on words such as photosynthesis.

## H. Monetization

Existing Plus system retained. Global popup waits longer, respects a per-session cap and seven-day dismissal cooldown. Promos wait for resolved access and avoid Plus/developer/unlocked/error states. First-party promotion no longer pretends to be paid sponsor inventory. Removed unfinished Store benefit copy. Existing in-context promos remain. No real payment/proof/admin approval was executed, and no new durable monetization analytics backend was added.

## I. Professionalization

Added coherent footer groups plus public Help, Privacy, Terms and What's New. Privacy explains local files, browser workspace backups, AI context and external media. Replaced hardcoded personal branding where touched. Unknown routes have real 404 behavior and private routes are not in the sitemap. Legal copy is informational, not a jurisdiction-specific legal review.

## J. Security/data

Existing session cookies, password hashing, subscription resolution and independent developer access preserved. AI/LAM routes require authenticated access, bounded context and server rate checks. Intelligence mutations now scope identity to the current user; ingestion shape matches its client wrapper. New file bytes are account-ID keyed in IndexedDB. Local workspace separation is not an authorization/encryption mechanism; backend authorization remains authoritative. Developer attempts are checked before expensive verification. Remaining: atomic rate/storage limiting, optional AI quota bypass, full real-DB ownership/concurrency tests, and deep dependency/security audit.

## K. Validation

- TypeScript and production build: PASS on repaired source; final release build rechecked before push.
- Source lint: PASS (no errors). Existing warning cleanup is not complete.
- Unit/policy/source tests: 177 pass, 9 live tests intentionally skipped (11 September follow-up). Some legacy security tests assert source structure; they are not database integration tests.
- Separate live provider suite: 9 pass, 0 fail.
- Chrome browser suite: 6 pass. Guest flow, error recovery, synthetic-session restoration, old note preservation, durable real IndexedDB file upload/reload/preview, Tutor completion/failure/cancel, public links/404 and route layouts.
- Production-mode local build: the five website-overhaul browser tests also pass against `next start`, including the 17-route pass; this checks built chunks rather than relying only on the development server.
- Routes: dashboard, study, notes, files, settings, ai-tutor, ai-tools, quiz, flashcards, planner, focus, nigtube, music, lab, reminders, intelligence, plus. Page rendering does not certify every feature workflow.
- OCR: local and production PASS on a bundled page. Production release `9af00d7` returned `504 OCR_TIMEOUT` after 46.9s; runtime logs identified `Cannot find module '..'` in `/var/task/node_modules/tesseract.js/src/worker-script/node/index.js`. The serverless trace omitted its parent worker implementation. Fix `37ad8ad` externalizes Tesseract and adds route-scoped worker/runtime file tracing. Deployed READY as `dpl_AdFx7zuecxvT4CH6Azh2xz8vHzdr`; identical production request returns HTTP 200, 2,008 characters, confidence 81, in 7.14s on 11 September. Authenticated Homework Scanner remains unverified.
- Post-deploy public browser check: PASS across all 14 widths, including footer/privacy and unknown-route behavior, against `https://scholar-v1.vercel.app` on the OCR fix deployment.
- Other browsers/physical devices/accessibility audit: not performed.

## L. Remaining and next priorities

1. Supply a dedicated test account via browser sign-in and a properly configured development database. Missing local variables: `DB_DATABASE_URL`, `DB_DATABASE_URL_UNPOOLED`; production-mode local auth additionally requires `AUTH_SESSION_SECRET`. Never put secret values in this report. Do not infer missing production configuration from local gaps.
2. Verify real registration/login/logout, expired sessions, Free/Plus/developer entitlement transitions, quota concurrency, payment proof/admin approval, and cross-account server records.
3. Move multi-step generation/quotas to an existing server-owned workflow and cover omission/replay/abort/commit cases against PostgreSQL. Do not claim optional client usage tags are secure metering.
4. Exercise every AI tool's real create→review→save→export journey, including long slide decks, image history and speech. Preserve partial output and honest fallback labels.
5. Repair unavailable external media after checking actual playback, complete cross-browser/physical-device keyboard/dialog tests, measure bundle/Lighthouse/GPU changes, and extend account-scoped export/recovery across every local module.

Git/Vercel release identifiers and post-deploy evidence are recorded in the delivery response after the exact commit becomes ready. A READY build is not an end-to-end product certification.
