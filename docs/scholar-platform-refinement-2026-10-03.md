# Scholar platform refinement — implementation and validation report

Date: 3 October 2026. Repository: `C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1`.

All paths below are relative to that repository. Changes remain local. No staging, commits, pushes, deployments, dependency installation, production migrations, or Android native edits were performed.

## 1. Executive summary

Implemented the requested connector infrastructure, Google Drive server integration, shared Plus previews, honest experiment availability, Slideshow creation gating, LAM/background optimizations, ready-aware AI Tools video fades, compact glass footer, uploaded-PDF reader integration, natural-language study proposals, and Canvas beta labels.

Local code validation passes. **Live Google Drive authorization and the authenticated PDF-to-reader-to-LAM acceptance flow are not verified:** this environment has no Drive OAuth client/encryption configuration or PostgreSQL connection URLs. Those are release prerequisites, not successful acceptance results. The connector migration was created but not applied.

## 2. Files/components audited and changed

Targeted inspection covered the shared shell/navigation, entitlement resolution and guards, experiment implementations, Slideshow generation paths, existing Google authentication/session helpers, resource ingestion/jobs/PDF extraction, EBook reader/storage, LAM chat/context/animation/background, Planner/store, Settings and footer. Existing working systems were reused.

New implementation files:

- `src/lib/connections/{registry,adapters,crypto,google-drive,http,browser}.ts`
- `src/app/api/connections/route.ts`
- `src/app/api/connections/google-drive/{start,callback,files,import,disconnect,open}/route.ts`
- `src/components/connections/plugin-connections.tsx`
- `src/components/subscriptions/plus-feature-preview.tsx`
- `src/app/api/ai/slideshow/route.ts`
- `src/components/ready-video-background.tsx`
- `src/components/ebook/uploaded-book-reader.tsx`
- `src/lib/lam/study-plan.ts`
- `src/components/lam/study-plan-proposal.tsx`
- `prisma/migrations/20261003210000_plugin_connections/migration.sql`

Updated implementation files:

- `prisma/schema.prisma`
- `src/app/api/ai/route.ts`
- `src/app/api/ebooks/route.ts`
- `src/app/api/ebooks/[ebookId]/route.ts`
- `src/app/api/lam/chat/route.ts`
- `src/app/api/subscriptions/usage/route.ts`
- `src/components/app-shell.tsx`
- `src/lib/nav.ts`
- `src/components/subscriptions/plus-gate.tsx`
- `src/components/views/{lab,slideshow-maker,narrated-slideshow,ai-tools,live-tutor,canvas,settings}.tsx`
- `src/components/lam-widget.tsx`
- `src/components/live-tutor/{personality-background.tsx,live-tutor.css}`
- `src/components/scholar-footer.tsx`
- `src/components/ebook/{book-mode-reader,custom-ebook-library}.tsx`
- `src/lib/ai.ts`, `src/lib/ai/{client,schemas}.ts`
- `src/lib/resources/{pdf,jobs}.ts`

Tests are listed in sections 31–32. This report and `test-artifacts/platform-plus-preview-2026-10-03.jpg` are additional deliverables. The tree already contained unrelated Study Music, LAMTube, resource placement, and other changes; those were preserved, not claimed as new work here. An existing untracked Android APK was not modified.

## 3. Google Drive integration

Authorization uses a separate web OAuth client, authorization-code exchange, PKCE S256, random state and an HTTP-only browser-binding cookie. Attempts are bound to Scholar user, active session, callback URL and expiry. A state is atomically claimed before exchange. Completion and disconnect serialize on the user's database row to prevent cancelled authorization from recreating a connection.

Scope is exclusively `https://www.googleapis.com/auth/drive.file`. The service lists/searches only granted PDFs and Google Docs, with bounded pagination and escaped search input. Drive's **Open with Scholar** integration supplies the per-file grant; this deliberately is not a whole-Drive browser. See [Google's Drive scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

PDFs download through fixed Google API endpoints. Google Docs export to PDF. Imports are size-bounded and feed the existing authenticated EBook/resource ingestion route, including ownership, quotas, validation and duplicate handling. No isolated Drive reader was created.

Access and refresh tokens are encrypted and stored only server-side. Refresh uses compare-and-swap persistence so concurrent disconnect/reconnect cannot be overwritten. Disconnect blocks usage immediately, revokes Google's token and deletes credentials; failed revocation retains only encrypted credentials in a retryable DISCONNECTING state. API responses never return tokens.

Status: implemented and mocked regression-tested; real consent, granted-file selection and imports await external configuration and an authenticated database-backed account.

## 4. Plugin architecture

The provider registry declares identity, OAuth type, minimum scope, supported MIME types and capabilities. The actual Google adapter is used by browse/import/disconnect routes. Shared request handling enforces session ownership, origin checks, rate limits and safe errors. Only Google Drive is advertised as implemented.

Future connector procedure:

1. Add a provider definition and accurate capabilities.
2. Implement server-only authorization and user-bound encrypted token persistence.
3. Implement an adapter with bounded requests and explicit file/operation authorization.
4. Register the adapter and surface only supported actions in Settings.
5. Add revocation, expiry, cancellation and safe error handling.
6. Add cross-user, token-secrecy, provider-error and import tests before marking it usable.

Calendar, Dropbox, OneDrive, Notion and GitHub were not falsely presented as working connectors.

## 5. Plus locked-feature system

`PlusFeaturePreview` replaces the dead lock with a shared translucent elevated glass surface: feature title, useful description, capabilities, readable hierarchy, edge highlights, restrained accents and primary/secondary navigation. Callers can supply capability bullets, an optional illustrative preview, CTA label and back action. Capability defaults cover the main gated features.

`PlusGate` consumes the existing shared entitlement provider. It does not grant access or mutate subscriptions. The existing shell transition supplies lightweight entrance motion. Backend entitlement checks remain authoritative. Guest purchases/subscriptions still require sign-in.

## 6. Experiments changes

Only the existing interactive Pendulum Motion, Vernier Calipers and Screw Gauge implementations receive Plus badges and the reusable preview for Free users. Unimplemented experiments retain Coming Soon. Cards are keyboard-operable buttons with focus feedback, not inert divs. Paid experiment AI requests use the existing premium experiment entitlement. No nonexistent simulation was relabeled as available.

## 7. Slideshow Maker Plus conversion

AI Tools now advertises Slideshow Maker as PLUS. Creation UI is gated; the saved-project library remains outside the creation gate. Free users can still view previously saved decks.

The new `/api/ai/slideshow` route requires the shared entitlement before generation and forces the Slideshow feature tag. The generic AI route also checks Slideshow usage; subscription usage recording requires the entitlement. Both ordinary and narrated generation clients use the protected path. Direct API Free-user bypass and forged feature-tag cases are covered by regressions. Authenticated Plus rendering/provider generation remains a live acceptance prerequisite.

## 8. LAM background root cause

Concrete costly paths were identified: large streaming chat bubbles repeatedly applied backdrop blur over moving video; startup awaited multiple unbounded requests behind a blocking preparation layer with additional blur; token updates restarted smooth scrolling; decorative video handling did not consistently pause hidden playback or bound readiness cleanup.

The previous personality background already used at most two video layers. It was not a three-video preload bug. These findings explain avoidable rendering/startup work, but no controlled before/after FPS benchmark was performed, so this report does not claim every device's lag is conclusively eliminated.

## 9. LAM background optimization performed

The personality background is memoized and keeps one current video plus a short handoff layer. Decoded-frame readiness, bounded handoff cleanup, hidden-document pause/resume and reduced-motion fallback are shared in `ReadyVideoBackground`.

Large bubbles use inexpensive translucent material instead of video-wide backdrop filters. Small navigation/composer blur is bounded. Startup fetches are concurrent, cancellable and time-limited; a small non-blocking restoring-context status replaces the full-screen blocker. Late history restoration cannot overwrite a newly started conversation. Streaming scroll is instant only near the bottom; ordinary messages can still scroll smoothly.

The existing shared pointer runtime was preserved. No shaders, per-card pointer listeners or global animation engine were added.

## 10. AI Tools background transition fix

The existing video assets/design are preserved. A single ready-aware video starts transparent, waits for a usable decoded frame and fades over 520 ms. Loop boundaries fade out, rewind and fade in. Source changes reset readiness through the keyed video layer. Timers/frame callbacks/listeners clean up; hidden tabs and reduced motion stop unnecessary playback.

Browser inspection observed one video, readyState 4, opacity 1, `opacity 0.52s` transition and no video backdrop filter. This verifies the runtime path, not a frame-by-frame slow-network benchmark.

## 11. Footer redesign

The shared footer now has compact rounded glass, translucent lighting, a subtle border/highlight, restrained blur and tighter spacing. Existing Study, Tutor, Quiz, Flashcards, Notes, Planner, Files, Reminders, Settings, Plus, Help, Updates, Privacy and Terms links remain intact. Immersive view exclusions and compact-reader variants were preserved. No new nonexistent destination was invented.

## 12. PDF → EBook root cause

Three implementation problems were found: upload processing could target the oldest pending job rather than the exact new resource; a transient first processing error could mark the book failed before its allowed retry; uploaded books opened in an inferior text dialog rather than the normal reader.

This local environment also lacks PostgreSQL URLs, preventing authenticated persistence/upload acceptance. That is an independent configuration blocker, not proof that PDF.js parsing is broken. A real existing Mathematics PDF was successfully parsed: 35 pages, searchable text, needsOcr false.

## 13. PDF → EBook fix

Upload paths now process their exact created resource. Library polling processes the exact pending owned resource and reports real job status/error. Transient failures remain processing until permanent failure or retry exhaustion. Password-protected and corrupt PDFs receive actionable permanent error codes instead of repeated opaque failures.

Existing 4 MB intake limits, ownership/storage quota validation and source preservation remain. PDF extraction has page/text/time bounds and rejects unsafe embedded actions. Reader document, file fetch and AI operations are cancellable/time-bounded. No artificial multi-stage percentage sequence or fake successful extraction was added.

## 14. Uploaded EBook feature parity

Uploaded PDFs now reuse `BookModeReader`, via a small optional page-render hook. Shared page navigation, spread/scroll modes, zoom, themes/brightness, search, bookmarks/notes and reading controls are retained. Existing built-in image books are unchanged.

PDF.js renders only visible pages, with bounded pixel ratio, resize/intersection observation and render cancellation. Original authenticated PDF access remains available if rendering fails. Progress/bookmarks use the existing profile-scoped device storage, not new cross-device synchronization.

Search uses extracted page text. Automatic semantic chapter/TOC inference was not added, so imported books do not yet have built-in-style curated chapter boundaries. Scanned pages truthfully report missing text/OCR; visual page rendering still works. This limitation prevents claiming complete parity for every possible PDF.

## 15. LAM EBook integration

Ask LAM passes the selected book/resource/page context through the existing draft handoff. The student still sends the message explicitly. The chat endpoint verifies ownership, ready status and class context, and replaces caller-supplied page text with stored page content. Private retrieval remains owner-scoped. Changing pages cancels obsolete question generation and clears stale UI state.

## 16. EBook question-generation verification

The reader builds a page-grounded checkpoint through the existing AI client, checks the four-option answer structure/index, and displays answer/explanation only for that question. A scanned page with no extracted text does not pretend it can generate grounded questions. Cancellation prevents a response for an old page from appearing on a new page.

Resource/PDF/security tests passed, and TypeScript/build validate the reader integration. **The live upload → private reader → Ask LAM → generated question → refresh flow was blocked by missing database-backed authentication.** Provider answer quality and actual private-book persistence are therefore not marked browser-verified.

## 17. LAM planning failure root cause

Existing local commands focused on navigation/reminders and did not turn ordinary exam-preparation requests into an explicit Planner proposal. Generic model text was not equivalent to invoking Planner. Missing reliable current date/time context compounded interpretation errors. A too-restrictive initial plan matcher also missed study-only deadlines and spoken duration requests; focused regressions now cover those cases.

## 18. LAM planning/tool fix

A shared, deterministic planning handler is used by the global LAM assistant and full LAM view. It understands exam-preparation requests, declared upcoming tests, chapter completion deadlines, multi-day study requests and short study budgets. It chooses real curriculum/chapter context, avoids carrying an unrelated subject's chapter, and uses available weak-topic context.

Plans have six ordered stages: concepts, independent questions, MCQs, doubt resolution, active recall and timed mock/review. Explicit budgets bound block lengths. Long-horizon plans use disclosed 6 PM local windows; short plans start in five minutes. Every plan states its assumptions and that nothing has been added yet. This is a practical template-based proposal, not a new autonomous scheduling agent or a fully adaptive per-topic daily curriculum.

## 19. Date/time handling

Current server ISO time and validated IANA timezone are supplied to LAM. The proposal parser supports ISO dates, named months, day-first dates, explicit years/times, next-occurrence partial dates, tomorrow/today/tonight, next/before weekdays, numeric or spoken relative days/weeks and “next 6 days.” Missing years infer the next future occurrence transparently; invalid/past dates ask for correction. Ambiguous weekends ask for a day/time. Clarification replaces the invalid date without losing the requested subject.

Timezone conversion validates resulting local calendar values, including nonexistent DST times. Very short deadlines/budgets ask for focused review rather than inventing a six-stage schedule. Availability, daily habits and existing calendar conflicts are not automatically known; proposed times are disclosed suggestions.

## 20. Planner integration

`StudyPlanProposal` exposes Add to Planner and Cancel. Approval calls the existing `useStore.addTask`; profile/class identity checks and plan markers prevent double-click/partial-retry duplication. Errors do not report Done; partially added tasks can be retried without duplication. Dates/times can be edited in existing Planner after approval.

Persistence follows Scholar's existing device/profile store. No backend Planner synchronization or calendar write permission was introduced. Browser QA generated and cancelled a proposal without adding tasks to the user's Planner. Actual persistence approval was not executed during browser QA; no private Planner data was overwritten.

## 21. Canvas Early Beta tag

Canvas navigation and project header now show EARLY BETA/Early Beta. The mobile header badge is explicitly preserved rather than being hidden with the existing subject badges. Mobile DOM inspection confirmed a visible flex badge and no page-width overflow at 390 px. No Canvas editor redesign was performed.

## 22. LAM opening animation

The existing `animateLamWakeReveal` implementation was located in the animation code and checked against Git history, including revision `41f9829`. The full LAM view reuses that helper for its mark/navigation reveal rather than inventing a new cinematic effect. It plays once in the intended mount context and respects quality/reduced-motion settings.

The global LAM widget remained responsive during planning QA. The authenticated full-page opening animation was not visually acceptance-tested because Guest Mode correctly restricts that view. Recovery from existing code is confirmed; a complete authenticated animation smoothness claim is not made.

## 23. Mobile behavior

In-app Chromium checks at 390×844 covered experiment Plus preview, Slideshow preview, Settings Connections, Canvas and the EBook library. Each reported document scrollWidth 390 for viewport width 390. Capability cards stack, buttons remain operable and private-upload/connection sign-in notices are visible. Canvas's previously hidden mobile beta badge was corrected.

The shared footer has responsive groups; reader compact links remain. Actual granted-Drive file rows, authenticated custom-PDF reader behavior and full LAM chat on a physical phone remain unverified. This was a focused mobile pass, not an exhaustive device matrix.

## 24. Android WebView considerations

No Android source/native packaging was touched. Browser APIs have reduced-motion/visibility fallbacks; no new permanent pointer loop or MutationObserver was introduced.

Android embedded WebView detection blocks starting Google Drive consent inside the embedded agent and provides the full Scholar Settings URL for browser handoff/manual copy. The user signs into Scholar in that browser before connecting; this keeps authorization bound to the correct browser/session. Listing/import after connection can still use the server-side connection from the same account.

This follows [Google's prohibition on controlled embedded OAuth user agents](https://developers.google.com/identity/protocols/oauth2/policies). A native Custom Tab bridge was not added, and external-browser-to-app return behavior was not physically tested. WebViews that disguise their user agent may not be detected.

## 25. Security improvements

Drive credentials use AES-256-GCM with unique IVs and authenticated user/provider binding; no built-in production secret exists. OAuth state, PKCE, browser/session binding, expiry, atomic claim and disconnect serialization prevent cross-account/replay/cancellation errors. Refresh persistence cannot resurrect a changed connection.

All private routes require authentication. Mutations check origin and rate limits. Drive endpoints are fixed, input/search is bounded, metadata remains React-escaped, remote bytes are size-bounded, and imports reuse existing upload safeguards. Private PDF access is owner-bound with nosniff/sandbox handling. LAM does not trust arbitrary client page text. Slideshow entitlement is enforced before generation.

Live unauthenticated endpoint checks returned 401 for connection status/files/start/import/disconnect, Slideshow generation and EBook upload. Mocked Free-user requests returned 403 before Slideshow provider execution. No credentials or private PDF contents were printed.

## 26. Accessibility

Experiment cards use semantic buttons; preview buttons/capability headings have meaningful labels. Connector errors use alerts, asynchronous statuses are announced, file names wrap, controls have usable target height, and footer links remain keyboard-accessible. Canvas badges use readable compact text. Reduced-motion video/reveal handling is preserved.

No full screen-reader or automated WCAG certification was performed. The existing glass/design system supplies focus styling; not every contrast combination was independently measured.

## 27. Performance

No new dependency or expensive global runtime was added. Video layers are bounded/memoized; fades use opacity, frame readiness avoids fake fixed delays, hidden playback pauses and cleanup cancels work. Large video-overlaid bubble blur was removed. PDF render work is limited to visible pages, bounded resolution and cancellable jobs. Fetches have timeouts rather than permanent spinners.

React best-practices guidance influenced the ref/callback lifecycle, guarded state updates and cleanup repairs. Desktop Chromium is not classified as incapable merely because touch/coarse-pointer support exists. Structural inspection and runtime readiness were verified; CPU/GPU traces, p95 input latency, asset-byte benchmarking and physical-device FPS were not measured.

## 28. Prisma/schema changes

Added `PluginConnection` with per-user/provider uniqueness, encrypted credentials, connection status and update timestamp, plus its User relation. Migration `20261003210000_plugin_connections` creates the table and cascading user foreign key.

No migration was applied. Runtime connector SQL uses parameterized Prisma execution/query methods. The row lock selects a supported ID type; it does not return PostgreSQL void. The earlier auth advisory-lock regression remains passing.

Schema validation passed using temporary command-scoped dummy PostgreSQL URLs solely for schema validation, with no database connection. Actual-environment validation initially failed because `DB_DATABASE_URL_UNPOOLED` was missing. The generated migration still needs review/application against a correctly configured staging database.

## 29. Environment variables

Required connector configuration:

- `GOOGLE_DRIVE_CLIENT_ID` — separate Google OAuth web client ID.
- `GOOGLE_DRIVE_CLIENT_SECRET` — that client's secret, server-side only.
- `CONNECTOR_TOKEN_SECRET` — strong random secret of at least 32 characters. Existing `AUTH_SESSION_SECRET` can be the fallback; a dedicated connector secret is preferable.
- `AUTH_BASE_URL` — correct canonical Scholar origin used by OAuth callbacks; localhost development defaults to `http://localhost:3000`.

Existing persistence requires `DB_DATABASE_URL` and `DB_DATABASE_URL_UNPOOLED`. Existing AI providers use their existing environment variables; none were overwritten. Existing login `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are separate from Drive authorization and were not expanded with new scopes.

Local flags confirmed missing Drive ID/secret, connector encryption configuration and PostgreSQL URLs. Groq/Gemini/NVIDIA configuration flags were present; values were not printed. Do not rotate the encryption secret without a deliberate connection reauthorization/rotation plan.

## 30. External configuration required

Enable Google Drive API in the appropriate Google Cloud project. Create/configure the web OAuth client, consent screen, testing users or publication requirements and the narrow drive.file scope. Register the exact redirect:

`<AUTH_BASE_URL>/api/connections/google-drive/callback`

Configure Drive UI integration/Open with Scholar, appropriate PDF/Google Doc MIME support and this launch URL:

`<AUTH_BASE_URL>/api/connections/google-drive/open`

Then grant files through Drive's Open with action and browse/import the granted list in Scholar. This is necessary for meaningful per-file selection without exposing an OAuth access token to a browser Picker. Configure the database and review/apply the new table migration in staging before authenticated end-to-end acceptance. Cloud provider settings were not changed by this task.

## 31. Tests added

New tests:

- `tests/lam-study-plan.test.ts` — dates/timezones, intent/context, budget/deadline scheduling and clarification.
- `tests/connector-crypto.test.ts` — token envelope secrecy and user/provider authentication binding.
- `tests/connector-browser.test.ts` — Android embedded handoff without misclassifying normal Chromium.
- `tests/drive-connector.test.ts` — scope, OAuth ownership/session/expiry, encrypted persistence and cancellation race.
- `tests/drive-files.test.ts` — refresh/list/search, user isolation, PDF/Doc import, unsupported/oversize input, changed-connection CAS, remote 401 and revocation success/failure.
- `tests/slideshow-plus-route.test.ts` — Free denial, Plus forwarding with forced feature tag and origin denial.

Updated `tests/resource-pdf.test.ts` and `tests/resource-jobs.test.ts` validate extraction/failure/retry behavior. Existing related security/resource regressions were run rather than a complete unrelated test suite.

## 32. Exact test results

Focused Bun suites passed. Mock-heavy suites ran in separate processes to avoid unrelated module mocks contaminating another suite. Totals count each suite's latest passing run once, not repeated reruns.

| Suite | Passed | Failed |
| --- | ---: | ---: |
| lam-study-plan.test.ts | 17 | 0 |
| connector-crypto.test.ts | 2 | 0 |
| connector-browser.test.ts | 2 | 0 |
| drive-connector.test.ts | 5 | 0 |
| drive-files.test.ts | 9 | 0 |
| slideshow-plus-route.test.ts | 3 | 0 |
| resource-pdf.test.ts | 8 | 0 |
| resource-jobs.test.ts | 16 | 0 |
| subscription-security.test.ts | 16 | 0 |
| resource-api.test.ts | 17 | 0 |
| resource-engine.test.ts | 20 | 0 |
| resource-ssrf.test.ts | 6 | 0 |
| ai-reliability.test.ts | 15 | 0 |
| entitlements-fail-closed.test.ts | 4 | 0 |
| auth-rate-limit-void.test.ts | 3 | 0 |
| **Total** | **143** | **0** |

Additionally, a real local PDF extraction returned 35 pages with text. OAuth/Drive regression tests mock Google and database responses; passing them is not live authorization acceptance.

## 33. TypeScript result

`bunx tsc --noEmit` passed after implementation and subsequent targeted refinements. Final production compilation also checks TypeScript. Initial mock typing and parser option errors were repaired; no type suppression was added to application code to conceal them.

## 34. Lint result

`bun run lint` passed with exit 0, including the final newly added Drive file regressions. No remaining errors or warnings were reported. Initial lifecycle/ref findings were repaired rather than suppressed.

## 35. Production build result

The final `bun run build` passed with exit 0 on Next.js 16.3.6 after all browser-discovered corrections: compilation 47 seconds, TypeScript 64 seconds, 65 static pages generated successfully. The dev server was temporarily stopped for that build and restarted for manual inspection.

## 36. git diff --check result

`git -c core.safecrlf=false diff --check` passed with exit 0. The configuration override only avoids Windows line-ending conversion policy interference; it does not suppress whitespace checks. Nothing was staged. Existing unrelated changes and untracked files were preserved.

## 37. Browser flows tested

| Requested flow | Result |
| --- | --- |
| A — Settings → Drive → import | Settings/tab routing and Guest sign-in notice verified desktop/mobile. Live authorization/granted files/import blocked by missing configuration/account. |
| B — Free locked feature → preview → Plus | Guest-equivalent no-entitlement preview verified. CTA reaches `/plus`, where existing Guest sign-in restriction remains. Authenticated Free checkout view not exercised. |
| C — Experiment availability/lock | Three implemented cards show PLUS; unfinished cards show Coming Soon; Pendulum preview and back/CTA are operable. |
| D — Full LAM background/typing/reveal | Global assistant opened and accepted typed planning input. Full authenticated LAM page is Guest-restricted; full-page optical/performance acceptance not claimed. |
| E — AI Tools background fade | Single decoded ready video and 520 ms opacity transition active at runtime. |
| F — Footer | Existing link groups/compact reader links and glass presentation verified; mobile layouts had no page-width overflow. |
| G — Upload → reader → LAM → questions → refresh | Guest authorization notice and unchanged built-in library verified. Private upload/persistence and generated-question browser flow blocked by missing PostgreSQL/authenticated account. |
| H — Normal planning request → approval | November 25 Physics proposal appeared with correct year/month, six stages, evening windows, explicit unsaved state and Add/Cancel controls. Cancel used; Planner data left unchanged. |
| I — Canvas label | Header and navigation beta labels verified; mobile header visibility corrected. |
| J — Free Slideshow | PLUS tool card and Slideshow creation preview verified desktop/mobile; saved-library access remains outside the gate. |
| K — Plus Slideshow | Mock route forwarding regression passed; actual authenticated Plus UI/provider generation requires live account/configuration. |

Fresh page runtime log inspection returned no captured errors/warnings for the exercised guest routes. Development hot-reload remounts and intentional server-stop connection errors were treated as verification-session interruptions, not hidden production success. No authentication bypass or fabricated Plus account was used.

## 38. Known limitations

Live Drive consent/refresh/import/revoke and the authenticated private-PDF acceptance chain remain unverified. The migration/configuration must be supplied first. Only per-file granted PDFs and Google Docs are supported, not every Drive format or account-wide search.

No new OCR engine, automatic uploaded-book semantic TOC or cross-device bookmark synchronization was added. Scanned text must be extracted through a real supported OCR path before grounded AI can use it. Reader question quality/actual rendering require live acceptance.

Planning is a six-stage context-aware template with disclosed assumptions, not a conflict-solving adaptive scheduler. Known availability/conflicts are not checked; dates are edited in Planner after saving, and extremely short requests ask for clarification. Proposal acceptance/persistence and physical Android/browser handoff were not exercised against user data.

## 39. Deferred items

After correct staging configuration, run real-account Drive connect, refresh, unsupported file, PDF/Doc import, revoke/reconnect and cross-user acceptance. Run a complete owned PDF upload/read/search/bookmark/Ask LAM/question/refresh flow and authenticated Free/Plus Slideshow flows. Validate reduced motion, slow network, physical phone/WebView return behavior and actual before/after performance traces.

Future connectors, OCR expansion, semantic imported TOCs, cross-device reading state and calendar-aware planning require separate product scope. No fake placeholder connector or invented readiness data was used to substitute for those capabilities.

## 40. Exact deployment steps — operator instructions only

These steps were **not executed**. Do not deploy the entire dirty tree indiscriminately.

1. Review the task file list and existing unrelated changes; choose the intended release content. Keep Android artifacts out of this web-only release.
2. Obtain explicit release/migration authorization. Back up the target database and verify the environment is staging before changing it.
3. Configure the exact server-only variables in section 29 and Google Cloud URLs/settings in section 30. Use the actual deployment origin as AUTH_BASE_URL; never ship localhost callbacks.
4. Review all pending migrations, including pre-existing unrelated ones. `prisma migrate deploy` applies pending migrations, not just this new connector file. Resolve the intended complete migration sequence first.
5. With correct staging database URLs and approved migration sequence, the operator may run `bunx prisma migrate deploy`. Do not run reset/db push or use dummy validation URLs for migration.
6. Generate the client with `bunx prisma generate` if needed, after stopping processes that lock Prisma's Windows DLL. Reuse the normal dependency/install workflow only if required; do not delete unrelated files.
7. Run `bunx tsc --noEmit`, `bun run lint`, the focused suites in section 32 and `bun run build` on the exact release state. Run `git diff --check` before any authorized commit.
8. Deploy a staging/preview web release through the project's existing authorized CI/Vercel workflow. No credential extraction or new deployment mechanism is required.
9. Complete all blocked real-account browser flows from sections 37–39, including OAuth callback/session binding, encrypted storage, import quotas, disconnect and Plus denial. Verify error logs contain no secrets.
10. Only after acceptance and explicit production authorization, back up production, apply the reviewed migration sequence with correct production credentials and release the verified web artifact. Keep rollback/reconnection instructions available.

For local manual inspection, the development URL is `http://localhost:3000`. Source changes are intentionally uncommitted and undeployed.
