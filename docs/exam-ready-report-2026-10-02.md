# Scholar Exam Ready — implementation and verification report

Date: 2 October 2026. Repository: `Scholar-V1`. Local working-tree implementation; nothing staged, committed, pushed, deployed or migrated. Previous Resource Intelligence work and the restored Resources interface were preserved. Android files were not changed.

Release status: **implemented locally, not yet verified against a live account database or live AI providers**. Missing database configuration is a release gate, not a successful end-to-end test. The sections below distinguish working code, observed browser behavior and remaining work.

## 1. Executive summary

Replaced the old Exam Prep view with an adaptive preparation cockpit: guided setup, chapter confidence, real study budget, dated blocks, an active AI teacher, inline questions, source controls, notes, formulas, mistake memory, replanning and a contextual Mock Exam handoff. The teacher is not an optional resource checkbox. Resources support teaching.

The local guest story is usable without a database for plans, timing and notes. Authenticated teaching, evaluation, private materials and durable account sync require the existing authentication/database infrastructure. No substitute account, fake AI answer or fabricated readiness was introduced to hide that dependency.

## 2. Existing Exam Prep architecture discovered

The existing `ExamPrepView` was a self-contained quiz/mock preparation screen, not a persistent teacher-led environment. Scholar already had a view registry, canonical curriculum IDs, profile-scoped Notes/Flashcards, private PDF import/OCR, Resource Intelligence, LAM providers and a Mock Exam runner. Those integrations were reused.

The standalone Mock Exam view has legacy simulated rank/leaderboard behavior. Exam Ready does not use those predictions; contextual results and exports use actual answer evidence. Unrelated standalone behavior was not comprehensively redesigned.

## 3. New Exam Ready architecture

The client owns presentation, local drafts and guest/offline state. A pure planning engine owns timestamp arithmetic, priorities and task transitions. Authenticated route handlers own authorization, source selection, answer keys, generation leases and revision-checked persistence. A bounded JSONB aggregate stores each preparation in PostgreSQL.

Flow: setup → saved preparation → current teaching/checkpoint → adaptive path → contextual mock → evidence and revision brief. Study and Practice links retain exact class/subject/chapter context.

## 4. Routes changed

Kept `/exam-prep` and the existing view ID so old links remain valid; navigation now says **Scholar Exam Ready**. Added:

- `GET/POST /api/exam-ready`: rollout policy, owned preparations, creation.
- `GET/PATCH /api/exam-ready/[id]`: owned session and bounded actions.
- `POST /api/exam-ready/[id]/teacher`: contextual validated teaching.
- `POST /api/exam-ready/[id]/mock`: saved-paper generation and authoritative grading.

No login, landing, Group Study or Android routing redesign.

## 5. Components created

`ExamReadyWorkspace`, `Workspace`, `SetupFlow`, `Plan`, `Clocks`, `ToolsDrawer`, `Materials` and `ImageScan`. Session persistence/request handling lives in `use-session.ts`. Styling is scoped to the Exam Ready material system rather than replacing Scholar's global design.

## 6. Components reused

Scholar's app shell/navigation, subscription provider, curriculum helpers, safe AI Markdown/KaTeX renderer, Radix dialogs, resource reader/import dialog, private custom e-book pipeline, OCR endpoint, Notes/Flashcards store, chapter destination helper, existing AI provider stack and Mock Exam runner.

## 7. Database/schema changes

Added `ExamReadySession` and the corresponding User relation. Columns: ID, owner, integer revision, JSONB state, generation lease expiration and timestamps. Owner/updated-time index supports listing; ownership is inside parameterized SQL predicates. Saves use compare-and-swap revisions and bounded state size. The client is regenerated successfully; the table has **not** been created in any database by this task.

## 8. Planning engine

Deterministic task drafts rank chapters by answer evidence where available and otherwise self-reported confidence. Tasks include calibration, foundations/repair, recall, application, mistakes, optional reset and final mock. Integer allocations conserve the available task budget. Every task has an objective, priority, dependency, explanation and checkpoint.

Completed/skipped work and recent plan versions remain visible. Emergency paths remove long diagnostics and breaks. This is an explainable heuristic engine, not a trained optimizer or an official exam-topic weighting model.

## 9. Time engine

Study budget and exam countdown are separate. Remaining study time is bounded by both the budget and deadline. Dated availability blocks cannot overlap or extend beyond the exam; tasks split to fit those windows. Expired exams cannot create a new preparation.

Strategy uses effective short-time urgency first, then exam horizon for deeper/spaced planning. A remaining-time override stores an exact millisecond budget, avoiding extra time from rounding elapsed seconds. Existing stored sessions remain backward-compatible.

## 10. Confidence model

Initial confidence is 1–5 and validated against actual selected curriculum chapters. High confidence leads to verification/recall, not assumed mastery; low confidence leads to foundations. Actual incorrect answers can reverse initial confidence-driven priorities. Confidence alone never contributes readiness points.

A separately trained confidence-calibration score and global mastery write-back are not implemented.

## 11. Diagnostic implementation

Optional initial calibration becomes a short current-chapter teaching/checkpoint step and is omitted in emergency mode. For unrestricted Class 11 sessions, the existing chapter quiz bank supplies up to three unused checks where available; otherwise validated AI-generated checks are labeled accordingly.

There is not yet a separate 5–10-question, all-chapter pre-plan diagnostic wizard. Other chapters are calibrated during their teaching/practice checkpoints.

## 12. Material selection

Modes: all permitted material, Scholar + curated web, Scholar only, personal + Scholar, personal only, explicit custom sources. AI remains mandatory in the authenticated preparation workflow regardless of mode. Source selection is bounded to twelve IDs and checked again by the server.

“Web” means the shared reviewed catalog, not arbitrary live browsing. Currently Scholar-only and Scholar+curated-web draw from the same global catalog; there is no newly separate web-search provider or exhaustive content acquisition service.

## 13. Upload/OCR integration

Reused the Resource Intelligence import dialog for PDF, text and notes. PDF upload remains private and follows existing e-book quotas/processing limits; setup can continue while indexing finishes. Uploaded sources must become readable before grounding uses them. The resource UI exposes processing/link-only states instead of pretending every PDF is indexed.

Image scans use existing OCR access rules, bounded 10 MB PNG/JPEG/WebP input, confidence display, editable extracted text and explicit private save. Users are warned to check equations, symbols and units; diagrams are not reconstructed. Existing OCR entitlement restrictions are not bypassed by the Exam Ready promotion.

## 14. Resource Intelligence integration

Reuses shared library/search, owner-aware lookup, permitted chunks, citations, source states and rights checks. The previous 126-source catalog remains intact. Emergency preparation excludes video from selected teacher resources. Retrieval uses vetted IDs and bounded readable chunks rather than injecting an entire library into a prompt.

Source upload recovery still depends on the existing protected resource worker. See `resource-intelligence.md` for its operational setup and content rights.

## 15. AI teaching implementation

The teacher receives exam/board/format, selected chapters, current task, remaining time, confidence, verified answer evidence, mistakes, saved notepad and recent conversation. Controls request faster/deeper explanations, another method, examples, confusion repair, quizzes and foundations. Normal progression and resume initiate teaching for authenticated users.

Uses existing Groq for the shared free path and existing scoped user credentials/Plus provider selection where allowed. Output is structured and validated before rendering. Calls are bounded; the previous lesson stays visible during work. The UI currently renders completed validated lessons rather than streaming partial JSON.

## 16. Source-grounding behavior

Personal-only and custom modes restrict server-selected passages and teacher instructions to permitted sources/session notes. Missing readable material produces a visible gap rather than an outside-knowledge fallback. Strict contexts omit general curriculum chapter text and formula fallbacks. Foreign/deleted explicit source IDs fail rather than disappear silently.

Real citation IDs and links are whitelisted. These controls establish source provenance and policy boundaries, **not mathematical proof that every model sentence is entailed by a source**. Live adversarial/model-quality checks remain a release gate.

## 17. Question generation

Questions are tied to exact subject/chapter/task context. MCQs must have four distinct options and an answer matching one of them. Descriptive answers use a saved model answer and AI assessment. Generated questions are labeled Scholar AI-generated, never official past papers.

Teacher answer keys are removed from public session payloads. The server grades the saved key and ignores client-supplied scores. Stable wording fingerprints prevent repeated generated wording from inflating unique-question counts. Mock generation rejects duplicate questions.

## 18. Active recall

Inline checks sit alongside teaching, with answer submission, explanation and follow-up progression. Retrieved chapter-bank questions and generated checks both record evidence. Skip/finish overrides remain possible, but a completed task alone never earns mastery/readiness.

## 19. Mistake memory

Session attempts retain topic, response, expected answer, explanation, timestamp, evaluation type and a simple mistake category. Repeated difficulty triggers prerequisite repair. The drawer exposes actual mistakes and a contextual teacher-repair action; the final brief surfaces recorded gaps.

Error categorization is heuristic, not a validated taxonomy or a cross-platform persistent misconception graph.

## 20. Dynamic replanning

Replans after significant overtime/early completion, checkpoint evidence, repeated errors, long pauses, settings changes and explicit less/more-time requests. Preserves completed work and recent reasons/version history. Time overrides can compress an existing plan below fifteen minutes without losing it on refresh.

Replanning occurs on meaningful actions, not a server request every second. Automatic background calendar rescheduling and globally optimized multi-day spacing are deferred.

## 21. Timer implementation

Timestamp source of truth; isolated display ticks once per second. Pause stops accrual; resume retains elapsed time. Refresh restores the selected preparation and timer state. Task overtime is visible and rebalanced at progression.

The Mock Exam adapter also uses timestamp timing, retains local question responses/start time for refresh and guards duplicate timeout submissions. Server paper/answer authority is independent of the local timer; this is not a proctored anti-cheating clock.

## 22. Break system

Longer plans include an optional, skippable reset. Short/emergency preparation has no forced break. Resets do not manufacture readiness or rewards. A sophisticated fatigue model, repeated Pomodoro schedule and automatic break notifications are not included.

## 23. Rewards

No XP/coins are granted for clicking through tasks, and no fake rewards are shown for contextual Exam Ready mocks. Existing standalone reward behavior is preserved outside this integration. A new evidence-backed reward issuance system is deferred rather than implemented as unprotected client counters.

## 24. Notepad

Session-owned persistent notepad, important-for-revision flag, explicit save and Save to Scholar Notes. Unsaved drafts are separately scoped to owner/grade/session and survive refresh. Scratchpad is intentionally temporary to the current component/tab and resets on reload.

Teacher note-summary/quiz/revision-sheet controls use saved notes. Answered checks can be copied to existing Flashcards. Offline edits are queued; conflicts require explicit resolution, retaining a separate local recovery copy and notepad draft before replacing local plan state.

## 25. Formula tools

Teacher-provided formula dock uses the existing safe mathematical renderer. Unrestricted modes may use chapter formula fallback; personal/custom modes may not. The prompt asks for definitions, units and worked context. Formula correctness still needs academic review; this is not a symbolic verification engine.

## 26. Practice integration

Chapter Study/Practice deep links use canonical class, subject and chapter IDs. In-workspace practice/recall records session evidence immediately. Arbitrary work performed after navigating to the separate Practice page is not yet automatically imported into the Exam Ready aggregate.

## 27. Mock Exam integration

Owner-scoped handoff carries preparation ID, selected chapters, grade, remaining-time-derived duration/question count and format. Uses the existing runner; generation and grading go through the Exam Ready route so source constraints and saved answer authority cannot be bypassed with a local/ebook alternate paper.

Contextual configuration controls are replaced by an explanation of the saved settings. Legacy leaderboard navigation and pre-exam answer highlights are hidden in this context. The saved paper is reused instead of silently changing on refresh. Local run state is account/grade/preparation scoped and bounded. Finishing a verified final mock completes the preparation instead of planning another mock forever.

## 28. Post-mock analysis

Server grading records topic-wise attempts, actual correct/question totals and a verified mock summary. The existing runner shows answer review/feedback and can export it without a fabricated rank; returning reopens the same preparation. Mistake memory, readiness evidence and the final revision brief use those attempts.

Descriptive grading is presently correct/incorrect, not a full board marking-scheme/partial-credit rubric. Detailed longitudinal exam analytics and automatic second-mock cycles are deferred.

## 29. Readiness model

Readiness stays unknown with fewer than five distinct evaluated questions. Initial heuristic weights: 65% answer accuracy, 20% checked chapter coverage and 15% verified mock performance, discounted while evidence is below fifteen questions. Self-reviewed answers, self-confidence and checklist completion do not add points.

Labels explicitly say early/preparation estimate, not predicted exam score or rank. The metric is not externally calibrated and should not be presented as certification of readiness.

## 30. Personalization integration

Setup prefills existing board, teaching style and upcoming exam preferences where available. Current Scholar class/curriculum remain authoritative; users can adjust chapter confidence, dates, budget, materials and availability. Sessions and local cache are keyed by account/class. No new onboarding redesign or automated mutation of global personalization.

## 31. Limited-time free entitlement

Central flags: `v2_exam_ready` and `v2_exam_ready_free`, both default true. Optional server `EXAM_READY_FREE_UNTIL` supplies a real expiration. Without it, the UI says currently free for a limited time without inventing a deadline. Disabling/expiring promotion falls back to existing `exam_prep` entitlement, not a new billing plan.

Feature/AI/rate/class access is enforced server-side. Free Exam Ready does not globally unlock Class 9, uploads, OCR or unrelated Plus features.

## 32. Mobile implementation

Teacher first, then evidence/tools and the adaptive path. Two-column laptop layout and three-column wide-screen cockpit; wrapping controls, readable fields and bounded scrollable dialogs. Tested viewport widths 1440, 1024, 390 and 320. No horizontal page overflow observed at 1024/390/320; the 390-pixel notepad dialog measured 366 pixels.

The existing mobile Scholar shell/collapsible menu is preserved rather than redesigned.

## 33. Android/WebView considerations

Responsive browser CSS, dynamic viewport sizing, safe timestamp timers and touch-friendly controls apply to the web experience. No native Android files, APKs or permissions were modified; no Android emulator/device/WebView verification was performed. Existing unrelated APK artifacts were left alone.

## 34. Accessibility

Labeled form fields, pressed answer/material states, visible focus outlines, status/alert text, semantic headings and Radix focus-trapped dialogs. Escape dismissal worked; the notepad's description ID resolved to a real element. Reduced-motion CSS disables new decorative motion. Countdown text is not announced every second.

This is focused interaction verification, not a complete WCAG audit or assistive-technology certification.

## 35. Security protections

Authentication before account actions, origin checks before mutations, exact owner predicates, class entitlement checks, bounded JSON/Zod input, parameterized SQL, CAS revisions, generation leases and central rate limits. The client cannot upload a correct flag/score as authoritative evaluation. Checkpoint grading cannot grade the mock through a second endpoint. Duplicate mock submission is rejected.

No new auth/OAuth/session architecture, database reset, destructive Git action or credentials copied into client code.

## 36. Privacy protections

Guest plans/notes stay on that device and are not automatically attached to an account. Authenticated records are owner-scoped; private retrieval uses existing ownership/deletion rules. Local cache/drafts/mock runs include owner and grade boundaries. Account API responses are private/no-store. Logs avoid source text and secrets.

Local recovery copies are retained intentionally; users of shared computers should clear site data when appropriate. No new retention/cleanup admin interface was added.

## 37. AI prompt-injection protections

Session notes, requests, chats and document passages are explicitly untrusted data. Instructions forbid embedded content from changing source policy, access, tools or disclosure behavior. Retrieval is selected server-side and citation URLs are whitelisted. Student grading prompts are also data-bounded and never authoritative client score requests.

There are no execution tools attached to this teacher. Prompt policy is defense-in-depth, not a claim of perfect model resistance; live malicious-document trials remain required before release.

## 38. Performance improvements

The clock updates an isolated component rather than the entire cockpit. No per-second server persistence/AI generation, no per-component pointer listeners and no shader mode. Material readers/import tools are dynamically loaded; lists/search/context/history are bounded. Scoped frosted surfaces use restrained blur, not optical filters on document/media content.

Responsive layouts were checked; no quantitative CPU/GPU or physical low-end-device benchmark was performed.

## 39. AI cost controls

Cached lessons keyed by task/pace/question/source/notes/evidence; twelve lesson entries and bounded recent conversation. Limited source/chunk retrieval and 5,000-token generation budget. Fifty-second route generation deadline and fifty-eight-second client timeout. Exclusive generation lease prevents racing turns.

Limits: 60 Exam Ready AI mutations/hour plus existing 20/minute burst and 90/hour shared AI limits; ordinary Exam Ready mutations 180/hour. Timers and checklist ticks do not generate answers. Provider billing/real cost was not exercised locally.

## 40. Files changed

New feature files:

```text
src/lib/exam-ready/access.ts
src/lib/exam-ready/http.ts
src/lib/exam-ready/materials.ts
src/lib/exam-ready/mock-adapter.ts
src/lib/exam-ready/model.ts
src/lib/exam-ready/planner.ts
src/lib/exam-ready/question-identity.ts
src/lib/exam-ready/server.ts
src/lib/exam-ready/teacher.ts
src/components/exam-ready/exam-ready.css
src/components/exam-ready/setup.tsx
src/components/exam-ready/tools.tsx
src/components/exam-ready/use-session.ts
src/components/exam-ready/workspace.tsx
src/app/api/exam-ready/route.ts
src/app/api/exam-ready/[id]/route.ts
src/app/api/exam-ready/[id]/teacher/route.ts
src/app/api/exam-ready/[id]/mock/route.ts
tests/exam-ready-access.test.ts
tests/exam-ready-engine.test.ts
tests/exam-ready-materials.test.ts
tests/exam-ready-persistence.test.ts
tests/exam-ready-security.test.ts
tests/exam-ready-teacher.test.ts
prisma/migrations/20261002140000_exam_ready/migration.sql
docs/exam-ready-report-2026-10-02.md
```

Updated integrations: `prisma/schema.prisma`, `src/components/app-shell.tsx`, `src/components/views/exam-prep.tsx`, `src/components/views/mock-exam.tsx`, `src/lib/nav.ts`, `src/lib/v2/flags.ts`. Extended the existing uncommitted `src/components/resources/resource-library.tsx` with an optional PDF-completion callback; its other work was preserved.

Screenshots: `test-artifacts/exam-ready-desktop.png`, `exam-ready-laptop.png`, `exam-ready-mobile.png`, `exam-ready-notepad-mobile.png`. The broader dirty tree includes earlier resource work and user artifacts; this list does not claim those as new Exam Ready changes.

## 41. Migrations created

`20261002140000_exam_ready/migration.sql`: additive table/foreign key/index. The preceding uncommitted `20261002100000_resource_intelligence` migration is a prerequisite for private content workflows and was preserved. Neither was applied during this implementation. Existing migration history was not rewritten.

## 42. Environment variables/config required

Required for live account persistence: `DB_DATABASE_URL` and `DB_DATABASE_URL_UNPOOLED`. They are missing in this local configuration. Existing authentication/session infrastructure must be configured normally.

Existing AI config: `GROQ_API_KEY` and optional `GROQ_MODEL`/`GROQ_FALLBACK_MODEL`; optional Plus providers use `GEMINI_API_KEY` and `NVIDIA_TEXT_API_KEY`/`NVIDIA_API_KEY` with existing model/base-URL settings. Scoped user-key encryption/config remains the existing service's responsibility. No API secrets were exposed or added to environment files.

Feature configuration: `V2_FLAG_EXAM_READY`, `V2_FLAG_EXAM_READY_FREE`, optional ISO timestamp `EXAM_READY_FREE_UNTIL`. Private ingestion recovery uses existing `RESOURCE_WORKER_SECRET` and a protected scheduler/worker. No dependencies were installed or scheduler created.

## 43. Tests run and exact results

Final isolated regression run: **47 `.test.ts` files, 550 passed, 13 skipped, zero failed files/tests**. Isolation avoids existing module-mock contamination between test files. External live AI/provider tests account for the skips; they are not counted as successful live verification.

Exam Ready suites: engine 44, security 17, materials 6, access 8, teacher 6, persistence 6 — **87 passed, zero failed**. Includes time-budget conservation, below-fifteen-minute cache validation, exact remaining-time overrides, final-mock completion, private/custom sources, ownership, class/flag enforcement, CAS/leases, hidden answer keys, score tampering, duplicate submission, question identity and scoped refresh persistence.

Server persistence/provider tests use controlled doubles; they do not prove real PostgreSQL SQL execution or live model quality. Prisma schema validation passed using process-only placeholder URLs without connecting; Prisma client generation passed. `git diff --check` passed under the repository's normal Windows line-ending configuration; only conversion warnings remained. The index is unchanged/unstaged.

## 44. TypeScript result

`bunx --no-install tsc --noEmit`: passed after resolving a test generic-inference issue. Production build TypeScript validation also passed. No ignored type-error workaround added.

## 45. Lint result

`bun run lint`: passed with no reported errors or warnings. No blanket lint-rule suppression was added for Exam Ready.

## 46. Build result

`bun run build`: passed, including compilation, TypeScript and 53 static pages. All four Exam Ready API paths appear as dynamic routes. Successful compilation is not proof that unmigrated database endpoints work. The local dev server was stopped for safe validation/build and restarted for inspection.

## 47. Browser flows tested

Observed through the real local browser UI:

- Legitimate Guest entry; navigation label and existing `/exam-prep` route.
- Four-stage setup; Physics exam, three actual selected chapters, 120-minute budget and shared material listing.
- Plan creation; pause/resume; teacher sign-in boundary clearly shown, no fake response.
- Compression to fifteen minutes: high-yield recall, mistakes and mini-check, no forced break/diagnostic.
- Compression to five minutes and reload: retained preparation and exact `5:00` paused budget.
- Active refresh: clock changed `14:59` to `14:58`, retaining timestamp truth rather than resetting.
- Notepad save, Save to Scholar Notes notification and Escape dismissal.
- Unsaved notepad draft survived reload; temporary scratchpad reset as intended.
- Desktop/laptop/mobile rendering; no horizontal overflow at 1024, 390 and 320 widths.
- Restarted dev server: meaningful content, no error overlay, no captured runtime errors.

Existing shared-shell smooth-scroll metadata warnings were observed in development; no unrelated shell redesign was undertaken. Authenticated AI, private PDF/OCR, database sync and live mock grading were **not browser-verified** because the database boundary is unavailable. No fake login or database bypass was used.

## 48. Known limitations

Production release is blocked until database configuration/migrations and authenticated live-provider flows pass. This is a substantial working core, **not every aspirational feature in the master brief**.

Other limits: heuristic strategy/readiness/mistake taxonomy; partial initial diagnostic coverage; curated rather than live web retrieval; no client-visible partial-JSON streaming; no vector retrieval; source identity rather than semantic entailment verification; coarse descriptive grading; no anti-cheating/proctoring guarantees; availability windows require user input; separate Practice activity is not automatically reconciled; local offline recovery is explicit rather than automatic merge. Readiness and rewards are deliberately conservative.

## 49. Deferred work

Live two-account/DB/provider adversarial checks; all-chapter diagnostic and academic question/rubric review; validated exam-weight/high-yield metadata; finer teacher difficulty/evaluation calibration; true temporal spaced-repetition scheduling and calendar reminders; recurring fatigue-aware breaks; objective reward issuance; general activity reconciliation; separate constrained web-search provider; finer retention/recovery management; screen-reader/physical-device/performance benchmarking.

These should be planned explicitly rather than described as already implemented or masked with synthetic data.

## 50. Exact recommended deployment steps

The following are **recommendations only**, not actions performed:

1. Review the complete dirty tree and separate this feature, earlier resource changes and unrelated user artifacts. Obtain explicit release/commit approval; do not blindly include APKs/screenshots/secrets.
2. Configure the existing auth, database and provider secrets through the normal protected workflow. Choose the real promotion policy/expiration; retain class/OCR/upload access rules.
3. Back up through normal database operations. On disposable/staging PostgreSQL, apply the reviewed migration sequence including Resource Intelligence and Exam Ready, then generate Prisma. Do not use reset or `db push` to replace migration history.
4. Verify a signed-in preparation → teacher → inline answer → notes → private PDF/index/OCR → source-restricted lesson → mock → server evaluation → return/final brief with real services. Run the same story with a second account, stale revisions, offline edits and explicit conflict recovery.
5. Verify missing-source refusal, prompt-injected notes, provider failures/cancellation, expiry/Plus behavior, storage/rate limits and worker recovery. Check mobile, reduced motion and accessibility with actual hardware/assistive technology.
6. Configure the protected existing resource-processing scheduler if private ingestion recovery is needed. Keep secrets server-side and preserve source attribution/rights notices.
7. Only after those gates pass and explicit authorization is given, commit the reviewed files and deploy through the project's established release path. Apply production additive migrations through the approved migration process before enabling dependent endpoints.
8. Verify the deployed host using real authorized accounts; inspect sanitized errors/timings and feature policy. Use the central rollout flag to disable the feature if a release incident requires it; do not remove user session data as a rollback shortcut.

No production release was attempted by this task.
