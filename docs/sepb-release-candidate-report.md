# SCHOLAR SEPB RELEASE CANDIDATE REPORT

Publication note — October 8, 2026: the user subsequently authorized committing and pushing the recorded changes. The audit below describes the October 6 hardening session; its historical no-push/no-deployment statements and NOT READY assessment are retained. Git publication does not close the outstanding certification gates or claim a successful production deployment.

## Release verdict

**SEPB STATUS: NOT READY**

The local hardening pass and final browser rechecks are complete. Public-beta certification is not complete: required real authenticated/private-data, multiplayer and physical-device journeys lack evidence. All changes remain local; nothing was committed, pushed, deployed or applied to production configuration/database migrations.

Baseline: `5bab406`. The 37-system [release matrix](sepb-release-matrix.md) was created before application edits. The [issue register](sepb-issue-register.md) records reproduction, cause, repair, verification and outstanding gates.

## Blockers

- RC-005: no isolated PostgreSQL/staging environment with disposable Free/Plus accounts. The local URL uses SQLite protocol and a configured session secret is absent. The supplied URL is the production site, not isolated staging.
- Complete real PDF upload → durable processing → normal reader → search/OCR → actual LAM grounding/questions → refresh/logout/login → second-account denial remains unverified against this candidate.
- Real two-client Group Study and authenticated Free/Plus/developer/account-switch browser journeys remain unverified. Database doubles do not certify them.

## High priority

- Production Drive visibly says Not configured; requires Drive OAuth client/redirect and least-privilege per-file consent setup.
- Production reset/verification flags are false; requires a verified sender and real delivered recovery/verification journey.
- Hosted AI-video background completion, persistence, seek/playback and refresh proof remain outstanding despite successful real local narration/provider probes.
- Real Android/WebView and iOS virtual keyboard, file picker, media permission, back-navigation and lifecycle tests remain outstanding.

## Medium priority

Complete authenticated editor/modal/persistence and Plus media interaction coverage, long-session/network degradation checks and preview-database isolation remain incomplete. Base DB variables target both production and preview; an isolated preview was not established.

## Low priority

Notes/Canvas landing headings and broader screen-reader/contrast coverage need review. Ordinary guest Notes remain session-only by existing policy, now explicitly disclosed with export guidance.

## Post-beta

Only optional polish/expanded historical/load coverage may be deferred. Critical authenticated/private-data gates must not be relabeled post-beta to justify launch.

## Tests

- Default isolated unit suite: **880 passed, 0 failed, 14 skipped across 92 files**. Artifact: `test-artifacts/sepb-unit-results.json`.
- Explicit local live-provider suite: **12 passed, 0 failed, 2 skipped**. Seven Groq generation/schema/stream cases, four tutor providers (explicit Groq/Gemini/NVIDIA resolve to themselves; Auto resolves to Groq), one real Gemini WAV narration. The two NVIDIA image cases were not opted into. Artifact: `test-artifacts/sepb/live-provider-probes.json`.
- These live checks exercise twelve of the default skips. Do not double-count them or count unavailable browser journeys as passed.
- Distinct Bun cases across default/live runs: **892 passed, 0 failed, 2 not run**. These totals do not include HTTP smoke or unrun browser journeys.
- Built-server anonymous HTTP smoke: **16 passed, 0 failed**; public pages, private API denial/cache, guest Exam Ready policy/creation denial and foreign-origin upload denial. `test-artifacts/sepb/http-smoke.json`.
- All three original PDF failures were reproduced and repaired, not waived. Actual PDF parser/resume/rasterization/OCR tests pass.
- Initial live Gemini/NVIDIA probes failed. RC-017 records truncation at an 80-token override and a 40-second timeout; production-budget/internal-deadline probes then passed. Completion checks were not relaxed.

Repeat: `bun run test:rc`; `bun run test:rc:smoke` against local port 3003; `bun run test:rc:config` (read-only; currently correctly reports local blockers). Provider quota opt-in: `SCHOLAR_RUN_LIVE_PROBES=1` with `bun run scripts/run-live-rc-probes.ts`. Default tests never create an account or use production database credentials. Existing browser `.spec.ts` suites were not executed; manual CUA observations are separate evidence.

## TypeScript

`bunx tsc --noEmit` passed after repairs. The initial live speech probe's wrong duration property was corrected to the actual adapter contract, not left as a red check. Final rebuild rechecks the last edits.

## Lint

`bun run lint` passed after the final edits.

## Build

Final production Next.js build passed, including all routes and static generation; the rebuilt server was restarted and visually checked. No Vercel deployment triggered.

## Git diff check

Final `git diff --check` passed. CRLF notices are not whitespace failures. Existing prototypes, APK backup and prior QA artifacts were preserved. Nothing staged or committed. Separate concurrent Your Scholar visibility edits in `learning-profile-settings.tsx`, `scholar-today.tsx` and the corresponding store option were preserved, not implemented or attributed to this hardening pass.

## Authentication

Auth/session/reset/developer/rate-limit contracts pass. Explicit switches, sign-out and unresolved errors now remove the old private shell synchronously; abort/sequence fences reject stale responses. Nonce-only invalidation reaches other tabs without transmitting identity or privileges. Real signup/login/expiry/logout/recovery needs disposable accounts.

## Google OAuth

Live production reports Google configured. PKCE/state/nonce/browser/session/replay and identity ownership tests pass; source canonical origin is repaired. Encrypted production override value and Google Console callback allowlist were not read/changed. Full consent/cancel/callback remains unverified.

## Google Drive

Production UI says Not configured and Connect is disabled; metadata lacks Drive-specific client keys. Account/provider-bound token crypto/ownership/revocation/race tests pass. Existing AUTH_SESSION_SECRET is a supported encryption fallback. No tokens exposed or new scopes granted; live consent/import/reconnect requires setup.

## Guest Mode

Real local entry/navigation/gates exercised. Preference-only storage does not grant server privileges or retain ordinary account files/chats/coins/Notes. Fixed schema mismatch that reset fresh mobile LAM mode on refresh. Built-in reader annotations and Exam Ready use separate local stores; actual reader bookmark/note survived refresh. Ordinary guest Notes are clearly session-only/export-before-leaving.

## Scholar Plus

Entitlement/payment/storage/usage contracts pass, including Free/guest denial and unavailable-plan fail-closed behavior. Real anonymous Music/intelligence APIs are denied; Music direct guest route shows the gold Plus preview. No local flag/payment proof granted access. Actual paid/expired/developer browser proof remains outstanding.

## LAM

Twelve real local adapter checks passed. No fake answers/silent narration fallback or raw credentials/output logging. Probe token budget was corrected to production behavior; [Google documents that thinking consumes output budget](https://ai.google.dev/gemini-api/docs/generate-content/thinking). Full hosted book-grounded conversation, microphone and cross-account history journey remain unverified.

## LAM Living Identity

Identity/behavior/panel/performance cases pass. Original artwork, variants, narrow subscriptions, reduced motion and visibility handling retained. Phone-landscape/tablet layout now shares AppShell's 1024 px dock breakpoint rather than using an undocked desktop capsule over header controls. Compact preference survived an actual reload. Closed-capsule/header geometry showed zero control overlaps at 390, 844, 820 and 1366 px. Physical devices untested.

## Dashboard

Guest screens captured at every specified phone width and selected landscape/tablet/desktop sizes. Actual 320 px search overlap was reproduced and fixed, with 44 px menu/search/notification targets. Existing design retained.

## Scholar Today

Reminder/store/engine contracts pass. Real-user rollover/time-zone/notification and multi-device flow not completed.

## Chapter Command Centre

Workspace rendered across the requested width families. Flow-plan contracts pass. Exact authenticated chapter/section handoff and missing-material grounded-LAM fallback still need a complete journey.

## Exam Ready

Real 320 px local flow: beta notice → Laws of Motion → manual 30-minute budget → automatic mode → deadline 24h→1h changes budget 120→60 → build → Resume opens Calibrate → wrong answer yields readable feedback without verified readiness gain → Finish opens a distinct Repair lesson. Order/security/persistence contracts pass. This is explicitly offline guidance, not live AI proof.

## Practice

320 px screen, question/evaluation schemas and real Groq scoreable-output probes pass. Actual account attempt persistence across refresh is unverified.

## Notes

Mobile layout rendered. Guest session-only limit/export instruction and status label repaired without changing storage boundaries. Authenticated Notes remain account-isolated browser-local, not claimed cross-device sync. Full authenticated create/edit/version/export/reload flow outstanding.

## Resources

Local catalog settled to 126 sources with original interface. Intake/indexing/leases/ownership/SSRF/partial-PDF contracts pass; link-only material remains labeled not indexed text. Full private live import and all external-source availability unverified.

## E-Books

Opened real scanned Physics reader at 320 px; one synthetic page note and bookmark survived actual refresh. Icon/page controls now named; chapter cards support Enter/Space. Enter was exercised against the rebuilt chapter card and opened the reader with named zoom/rotation/bookmark/note/OCR/page controls. Actual parser/rasterization/OCR cases pass; uploaded live parity remains RC-005.

## PDF Upload

Original bytes, private resource/job, actual byte charge, bonus/monthly allocation, replay, rollback, owner denial, transfer-copy preservation, invalid/active/encrypted/large/mixed/scanned PDFs and OCR packaging pass locally. Bonus job starts from the transaction's resource ID instead of a post-commit optional lookup. Real database/account durability is not certified by doubles.

## Mock Exam

Planner/quota/security contracts and real Groq scoreable schema pass; mobile entry renders. Complete timed authenticated attempt→submit→mark→review→reload outstanding.

## Study Music

Model/presentation/server gates pass and direct guest route shows Plus preview. YouTube integration/compliant visible player rules retained; no hidden/background-only YouTube workaround introduced. Actual Plus mobile playback/queue/mini-player/native audio lifecycle unverified.

## LAMTube

Responsive feed and chosen-avatar watching surface render at all tested width families; timeline/feed/ownership contracts pass. Screenshots do not prove full actual playback/fullscreen/media-permission flow.

## LAMTube AI Video

Real Gemini generated validated WAV; pipeline/quota/background/recovery/edit-lease cases pass. No production video/credit was created in the user's account. Hosted create→background completion→first feed item→narration/seek→refresh/retry remains unverified.

## Group Study

320 px public join/host landing renders; host repair/policy/schema/notes/order tests pass. No real two-client room created. Host transfer/approval/participant denial/reconnect/material/media proof requires disposable room/accounts.

## AI Tools

320 px existing landing renders; actual Groq text/JSON/schema checks pass. Full signed-in tool storage/export and image generation not certified.

## Canvas

Same design, viewport height and fixed-menu clearance repaired. Short landscape zoom clipping was found and repaired; short layouts place zoom and scrollable drawing controls side by side. Final rebuilt checks at 320×700, 390×844 and 844×390, including Compact LAM's extra header row: zoom and drawing rail are inside the stage, do not overlap each other or the fixed menu. No stylus/physical keyboard claim.

## Plugins

Connector crypto/browser/Drive ownership/redaction tests pass. Production configuration incomplete. No copied browser cookie, exported token or broad scope used to manufacture a connection.

## Feedback

Mobile drawer Feedback→nested dialog→close→Study tested. Guest sign-in requirement explicit. No production feedback submitted; authenticated attachment/delivery needs disposable scope.

## Security

- Cross-user: account-scoped PDF/resource/Exam Ready/connector/room API doubles pass; real second-user test outstanding.
- Plus bypass: Free/guest/unavailable plans denied in tests and real anonymous Music/intelligence endpoints; authenticated forgery/expired plan browser gate pending.
- Direct gates: Files/Plus/private tutors show guest gates; Music/Assignments show Plus previews.
- File/plugin ownership: server-derived owner, private job scope and account/provider-bound crypto retained. Payload identity does not grant ownership in covered cases.
- OAuth: PKCE/state/nonce/session/browser/replay pass; real consent/deployed callback unverified.
- XSS: renderer/static style/structured-output boundaries reviewed. Not a full penetration test or a guarantee against all XSS variants.
- Upload: bounded body/bytes/pages/decompressed text, active-content rejection, SSRF, rollback and privacy-cache tests pass.
- Prompt injection: ownership/permissions/schema remain authoritative; no fabricated link-only grounding. Full malicious-upload/tool-action red-team not performed.
- Secrets: metadata/presence/protocol only; no plaintext key/token/password printed, saved to artifacts or committed. No security weakening or new credential provisioning.
- Caching: all API responses private/no-store; service worker caches explicit public static assets only.

## Data persistence

Atomic DB-backed job/upload contracts and real built-in local annotation refresh passed. Guest schema corrected. Ordinary guest Notes session-only with honest warning; authenticated local Notes not claimed cross-device. Real DB durability/logout/login/crash/reconnect still requires staging.

## Cross-account isolation

Recoverable vault tests preserve old work, avoid incoming inheritance and protect failed backups. Explicit switch/sign-out/error shell now fails closed; nonce-only cross-tab invalidation and request fences pass. Actual A→B→A and two-tab logout/foreign-file denial remain gates.

## Desktop QA

1366×768, 1440×900, 1920×1080: Dashboard, CCC, E-Book entry, Exam Ready and LAMTube guest layouts captured. Not a full authenticated interaction matrix for all 37 systems.

## Tablet QA

768×1024, 820×1180, 1024×768: same five guest layouts captured against the final candidate without document-wide overflow. LAM breakpoint geometry rechecked. Physical touch/keyboard/media not tested.

## Mobile QA

**320×700, 360×800, 375×812, 390×844, 393×873, 412×915, 430×932; landscape 844×390.** Core Dashboard/CCC/E-Book/Exam Ready/LAMTube across widths; at 320 additionally Study, Practice, Notes, Resources, Planner, AI Tools, Canvas, Lab, Settings, Plus/Files/Assignments/private-tutor gates, Quiz, Mock Exam, Group Study and Reminders.

Inputs: real exam deadline/budget/chapter/checkpoint and page-note typing/save/refresh. Drawer/feedback/modal navigation tested. Header hit targets measured; scans visible. Screenshots wait for reload covers to settle, not accept blank transient frames.

**Upload:** actual authenticated browser upload not tested. **Media:** real server WAV/streaming tested, actual Plus playback/device lifecycle not tested. **Keyboard:** desktop-driven input at mobile dimensions and reader Enter activation tested, real virtual keyboard untested. **Sticky overlap:** header, LAM and Canvas geometry rechecked as described. **Android/WebView:** not physically tested. No blanket “mobile verified” claim.

Final evidence: **92 settled layout observations across 24 routes and 14 viewport sizes**, zero document-wide overflow and zero framework error overlays in those observations. This is not equivalent to every feature being end-to-end certified. `test-artifacts/sepb/browser-layout.json` contains dimensions/headings/layout and LAM/Canvas geometry; accompanying JPGs show the actual screens.

## Android/WebView QA

No physical/native session and no APK rebuild. Prior APK/prototype untouched. File-picker/cookie/back/keyboard/permission/background checklist still required.

## Accessibility

Essential 44 px mobile targets, drawer/modal return, meaningful reader control labels and chapter keyboard activation repaired/exercised. Reduced motion retained. Full screen-reader/contrast/editor-field audit pending.

## Performance regression

Existing engine/glass/server-flag tests pass. No source-art replacement, broad render loop/store subscription, heavy SDK migration, hidden media player or feature removal introduced. No comparable fresh cold-device benchmark; no new zero-lag/speedup guarantee.

## Environment configuration

Read-only Vercel metadata confirms official domain and latest observed production deployment READY. Key presence is not validity. Public auth flags and connector UI corroborate email/Drive gaps. Local redacted config check reports DB/session blockers and OAuth/email warnings. No env file overwritten or production secrets pulled.

## Known limitations

Browser `.spec.ts` suites not run; CUA manual observations/HTTP smoke are distinct. No new staging deployment, production DB test writes, external consent, device permissions or user sign-out. Synthetic guest test data remains only at localhost:3003.

## Unverified live dependencies

Hosted private persistence/workers, deployed OAuth/Drive callback/consent, email delivery/recovery, complete video completion/playback, real two-user room and physical mobile media/permissions. Passing local adapters/configured keys do not prove a deployed journey.

## Exact deployment prerequisites

1. Supply genuinely isolated staging DB/URL and disposable Free/Plus accounts; controlled developer role for that gate. Do not reset production; keep passwords/keys out of chat.
2. Configure staging session secret/canonical HTTPS origin; validate Google login and distinct exact Drive redirect/least-privilege consent.
3. Configure verified email sender and delivered single-use/expiry/replay/reset/session-revocation checks. Human handles credential-change or legal-consent steps.
4. Review isolated migration status/backup; no schema migration authored by this pass. Do not substitute db push/reset for reviewed migration deployment.
5. Complete PDF/book/LAM, ownership/account switch, Free/Plus/developer, Group Study and AI-video journeys with real data persistence evidence.
6. Complete real Android/iOS keyboard/file-picker/media/back/foreground and authenticated editor/viewport checks.
7. Re-run RC/config/smoke/TypeScript/lint/build/diff after any repair, close blocker/high items and update verdict with evidence.
8. Seek separate explicit deployment authorization. This report does not authorize push, deployment, production config writes or migrations.
