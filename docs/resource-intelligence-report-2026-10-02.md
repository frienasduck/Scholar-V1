# Scholar Resource Intelligence — 40-section implementation report

Date: 2 October 2026. Repository: `C:\Users\Lenovo\Desktop\SCHOLAR\Scholar-V1`.

**Status:** implemented and validated locally within the available environment. The public catalog is usable now. Authenticated database ingestion and production rollout still require the database/environment/migration and scheduler gates below. This report does not claim that unrun live-database or live-model flows passed.

**UI follow-up:** at the user's request, the pre-existing Resources interface was restored (original video, study-library hero, statistics, navigation tabs, filter pills and compact cards), with all 126 real catalog records retained. `classic-resource-library.tsx`, `classic-resources.css` and `library-presentation.ts` supply that presentation; the shared source reader, imports, ownership checks, licensing and backend remain intact. Favorites/Downloads/Recent operate across all API pages, and readable source-text downloads retain attribution. Follow-up validation: 44 focused tests passed (7 presentation, 20 engine, 17 API), TypeScript and scoped lint passed, desktop/mobile browser checks passed. The full build/regression numbers below describe the preceding platform implementation, not a new full rebuild after this UI correction.

## 1. Executive summary

Scholar now has a shared resource platform rather than a disconnected collection of synthetic resource cards: a real curated catalog, private ingestion, canonical chapter mappings, durable processing, search, provenance, extractive study tools and LAM grounding. The initial corpus has **126 real sources**, including **28 legally attributed readable snapshots** and **98 original-source links**. Final regression results: **456 passed, 13 live-provider tests skipped, zero failures across 40 isolated test files**. Production build, TypeScript, lint and `git diff --check` passed.

No staging, commit, push, deployment, production migration or Android modification was performed. The development server is available at `http://localhost:3000`.

## 2. Existing architecture discovered

Scholar uses Next.js 16 App Router, React, Prisma/PostgreSQL, account-aware client state, existing AI provider routing, an existing Chapter Command Centre and the Custom E-Book system. Supported UI curricula include Class 9 and Class 11. Existing Custom E-Books own PDF bytes/text/page data, monthly usage and the one-time 50 MB onboarding allocation. Resources previously contained a large view-specific catalog/guesswork rather than a shared searchable ingestion service. Existing source readers, Markdown/KaTeX rendering, quotas, authentication and navigation were reused.

## 3. Resource architecture implemented

The same resource contract serves global catalog entries and private database imports. Reviewed global metadata/text is stored in server-only catalog files; private data is stored in owner-scoped normalized database tables. Resource identity, mappings, chunks, artifacts, jobs and citations are separate concerns. APIs expose bounded metadata/chunks, not complete documents in every list. The Resource Vault, shared shelves, command search and LAM use this service rather than independent hardcoded catalog copies.

## 4. Database/schema changes

Added `StudyResource`, `ResourceMapping`, `ResourceChunk`, `ResourceArtifact`, `ResourceJob`, and their User/CustomEbook relations. Records carry source/provenance/rights, visibility, ownership, canonical URL, hash, confidence, processing state and source metadata. Added unique identities, ordered chunks, artifact cache keys, canonical mapping indexes, job recovery indexes and full-text GIN indexes. A database CHECK enforces ownerless global versus owned private resources; foreign keys cascade child data appropriately. Existing tables/quotas were not reset.

## 5. Source adapters created

Implemented controlled official-source manifests, permitted Wikibooks text extraction, safe HTTP metadata/link intake, private UTF-8 text/Markdown/paste intake and a bounded PDF.js adapter. Existing PDF uploads enter the same resource pipeline. No unrestricted autonomous crawler, credential-protected scraper or invented transcript adapter was added. MathML-only and older TeX-alternative formulas are retained as mathematical text, not silently discarded.

## 6. Web research performed

Research used primary publisher sources: [NCERT textbooks](https://ncert.nic.in/textbook.php), [NCERT Exemplar](https://ncert.nic.in/exemplar-problems.php?ln=en), [CBSE 2026–27 curriculum](https://cbseacademic.nic.in/curriculum_2027.html), [Wikibooks rights policy](https://en.wikibooks.org/wiki/Wikibooks:Copyrights), [MIT 8.01SC](https://ocw.mit.edu/courses/8-01sc-classical-mechanics-fall-2016/), [PhET licensing](https://phet.colorado.edu/en/licensing), official board sample/past-paper archives, and OpenStax/NTA materials. URLs and appropriate ingestion rights were checked separately; public accessibility was never treated as redistribution permission. The controlled refresh verified the manifest and downloaded only permitted text.

## 7. Curated sources selected

| Source family | Count | Contents / handling |
| --- | ---: | --- |
| NCERT textbook | 37 | Explicit modern textbook-to-legacy Scholar mappings, link only |
| NCERT Exemplar | 45 | Chapter question-bank PDFs, link only |
| Wikibooks | 28 | Attributed CC BY-SA 4.0 supplemental study text, readable/indexed |
| MIT OCW | 8 | Real lecture/resource pages, link only |
| CBSE Academic | 3 | Current Physics/Chemistry/Mathematics syllabi, link only |
| PhET | 5 | Official interactive simulation pages, link only |

The catalog contains per-source URLs, publishers, dates, rights and mappings; counts are actual records, not decorative UI numbers.

## 8. Sources rejected and why

Did not ingest paid coaching books, random reposted PDFs, login-protected papers or unknown-rights downloads. [OpenStax's current licensing](https://help.openstax.org/s/article/Licensing-information-of-OpenStax-textbooks) and [Computer Science preface](https://openstax.org/books/introduction-computer-science/pages/preface) were not assumed to permit unrestricted commercial AI ingestion. MIT's noncommercial material remains original-source links. [CBSE Class X](https://cbseacademic.nic.in/SQP_CLASSX_2026-27.html) and [Class XII samples](https://cbseacademic.nic.in/SQP_CLASSXII_2026-27.html) were not relabeled as Class XI PCM papers. An NTA answer-key notice without question text was not mislabeled a question bank. One NCERT link had a transient refresh socket failure; its earlier verified entry was retained and flagged, not silently represented as newly verified.

## 9. Copyright/licensing strategy

Unknown, copyright-restricted and noncommercial-only sources default to `LINK_ONLY`: no hosted copy, transcript or derived material is fabricated from metadata. Only expressly permitted global text enables copies/derivatives. Wikibooks keeps contributor attribution, source/history/revision links, modification notices and CC BY-SA licensing for derived aids. Private user uploads are never republished globally. Generated/extractive aids are labeled distinctly from originals and retain source references; extraction success is not academic certification.

## 10. Built-in resources imported

Shipped the 126-entry reviewed catalog and 28 text snapshots (146,963 bytes at final refresh). Licensed text is actually searchable/readable and usable for source-backed aids; the other 98 records open genuine publisher resources. Global data remains on the server. `curation-review.json` retains the Units and Measurements transient socket failure on `keph101.pdf`; the previous verified record remains available. No unauthorized global PDF/video archive was created.

## 11. Subjects/chapters covered

This batch covers Scholar's existing **Class 11 PCM** taxonomy: Physics p1–p15, Chemistry c1–c14, Mathematics m1–m16: **45 chapter keys**, plus three subject-wide syllabus keys. Some keys are legacy/rationalized chapters and must be checked against the user's current school syllabus. This is not a claim of complete current board coverage. Private mapping supports Class 9 too, but a newly curated Class 9 global corpus, English, Computer Science and other curricula remain unseeded in this batch.

## 12. Search/indexing implementation

Private full-text search uses parameterized SQL and PostgreSQL `simple` text vectors/GIN indexes, with ownership/visibility/deletion enforced inside the query. Global search reads the bounded catalog/snapshots server-side. Ranking prioritizes title matches, exact chapter relevance, source authority, current priorities and learning preferences. Search supports grade, subject, chapter, type, publisher, language and private/global scope; lists are paginated. Retrieval is lexical, not embedding/vector search. General explicit-source questions can fall back to permitted owner chunks rather than produce a misleading empty result.

## 13. User import implementation

Authenticated users can import PDF through Custom E-Books, UTF-8 TXT/Markdown up to 250 KB, pasted notes (40–250,000 characters, bounded by byte storage), or one public HTTPS URL. Input bodies are bounded before parsing; binary/NUL/invalid UTF-8 text is rejected. Duplicate identity is owner-scoped and locked transactionally before allocation. Imports return accepted/processing states and start background extraction. Owners can review mappings, retry transient failures and remove imports. Private import/mutation routes reject guests and cross-origin requests.

## 14. 50 MB onboarding integration

The original one-time allowance, account locks, byte accounting and idempotency remain intact. New onboarding PDFs create private resources/jobs rather than stopping at the original ebook table. The selected learning-profile grade is honored during setup. The UI displays pending processing and permits setup to continue. Invalid PDFs refund a newly consumed allocation once under the worker lease; historical/backfilled uploads are not recharged or refunded. Existing onboarding/security regression tests pass.

## 15. URL import behavior

URLs are canonicalized, then public-address DNS results are validated and pinned. Each redirect is rechecked. HTTPS is required; credentials, private/reserved/metadata IPs, nonstandard ports, oversized bodies and excess redirects are blocked. Bounded HTML fetches extract title/description only. A private bookmark is created with original URL/publisher and link-only rights. No website login, arbitrary content copying, automatic PDF download or inferred reproduction permission is attempted.

## 16. Video integration

Eight genuine MIT lecture/resource pages appear with chapter mappings. Video discovery is available in Resource Vault and NIGTUBE shelves without replacing the existing player. No transcript or hosted video copy is claimed. User video URLs are private metadata links; absent transcripts do not become fabricated LAM evidence. Expensive glass filters were not placed over video/iframe content.

## 17. LAM grounding

Added resource context to the existing AI client/schema/API and retrieval to LAM chat. The server retrieves only global-permitted or same-owner private text, capped at six chunks / 12,000 characters. References are explicitly untrusted data, not executable instructions. Real source IDs/pages/headings are whitelisted, unknown citation IDs are masked even across streaming boundaries, and source URLs are taken from actual retrieved records. Structured responses are also citation-filtered. Link-only explicit sources without text return an honest unavailable response. Provider routing/auth/quotas were not rewritten. Live model factual quality and private-database grounding still need staging verification; citation identity validation is not a factual entailment proof.

## 18. Generated study materials

Implemented source-extractive summaries, structured definition statements, exact formula expressions, definition-based flashcards and recall practice with revealable source answers. Each item retains a source citation, license and generator identity. Existing private caches are invalidated by source hash and generator version. Text remains marked for review rather than academically certified. These are provider-independent study aids, not fabricated MCQs, certified worked solutions or invented past papers; a broader AI-generated question bank remains future work.

## 19. Chapter Command Centre integration

The Overview reading path and Resources workspace consume real mapped records. Practice/Mock entry areas expose source-linked practice; Revision exposes grounded revision aids. Chapter LAM passes real chapter context into server retrieval. Existing guided flows, mastery/analytics, navigation, missions and quiz runner remain in place. Laws of Motion browser checking showed 10 relevant source records, including NCERT, MIT, PhET, Wikibooks and the subject syllabus.

## 20. Notes integration

Added a source-summary shelf without replacing existing user notes. Readers can copy excerpts or aids into a new attributed note; no original note is overwritten. Copied notes include source headings/pages, publisher attribution, original URL/license and source-derived tags. Browser checking confirmed the created note appeared in the existing editor. Removing an import intentionally does not remove separately copied personal notes.

## 21. E-Book integration

Existing uploaded books remain the PDF storage/reader system, now linked to resource jobs. The library shows processing/failed/OCR states, polls visible pending uploads and blocks inappropriate open attempts. The PDF byte-copy bug discovered by regression tests was fixed before parsing could transfer original storage bytes. Existing books have an opt-in owner-only backfill action, five at a time, without new quota charges. Built-in textbook links populate the E-Book discovery area; restricted books are not rehosted. Legacy PDF reading continues rather than being replaced by a new storage architecture.

## 22. Flashcards integration

The existing flashcard tools remain. Added source-linked discovery/recall aids, with chapter mapping and visible provenance. Where definitions can be extracted, fronts ask about actual named concepts rather than every card using the same generic heading prompt. Source answers remain revealable and reviewable. The browser verified reveal behavior; no fake fixed number of cards is shown.

## 23. Practice integration

Practice discovers official NCERT Exemplar question-bank links and source-explanation recall practice. Existing local practice/question flows and difficulty controls remain intact. Real mappings adapt legacy practice chapter IDs to the resource taxonomy. The platform does not pretend that a linked Exemplar PDF has become a locally graded MCQ database. Additional imported numeric/MCQ datasets, solution validation and per-topic question analytics remain separate future work.

## 24. Scholar Today/recommendation integration

Added real-resource discovery to Scholar Today, guided reading paths and Scholar Intelligence. Priority subject, source authority, current exam subjects/date and preferred resource format influence ordering. Available sources remain distinguishable from missing ones; recommendations do not invent locked content or placeholder resources.

## 25. Personalization

Resource ranking consumes the existing learning-profile preferences and selected class/subjects. Visual/examples preferences favor video/simulations; practice/exam preferences favor question banks; current weak/priority subjects and upcoming exams affect ordering. Resource UI is keyed by account and grade to prevent stale private results carrying across account switches. This is a deterministic ranking layer, not a new learned personalization model. Topic-level strengths and desired explanation depth are not all independently modeled in resource scoring yet.

## 26. Security protections

Added same-origin mutation checks, existing rate-limit reuse, bounded import/search schemas, entitlement checks, parameterized full-text SQL, private DNS/redirect/rebinding defenses, PDF page/text/time/script limits, invalid-UTF-8 rejection, lease fencing and deletion cleanup. Resource text is never executable HTML in the UI; the existing safe Markdown/KaTeX renderer is reused. Worker maintenance requires a 32+ character bearer secret with timing-safe comparison, including malformed-Unicode token handling. The CLI refuses redirects to avoid bearer forwarding.

## 27. Privacy isolation

Owner, private visibility and nondeletion conditions are applied before database reads—not just filtered in the client. Cross-user detail/artifact/mapping/delete requests return 404. Processing text and internal usage keys are removed from list metadata. Database failure returns public catalog content with an explicit private-index warning, never another user's content. Caches are private/no-store. No global publication, Group Study sharing or cross-account retrieval is implicitly authorized by importing a file.

## 28. Deduplication

Normalized text hashes, raw PDF hashes and canonical URL identities are scoped by owner. Tracking variants and YouTube identities are normalized; unique constraints and account locking prevent duplicate allocations. Soft deletion tombstones the identity so a legitimate later re-import is possible. This is exact/normalized identity control, not fuzzy near-duplicate or plagiarism detection.

## 29. Performance work

Server-only global snapshots; 12-card pagination (API max 24); compact three-source shelves; 12-chunk reader pages; capped retrieval and text extraction; lazy reader/aid loading; 250 ms search debounce with aborted obsolete requests; artifact cache/versioning; visible-only polling; bounded worker batch/lease/retries. PDF extraction checkpoints are reused after index failure instead of reparsing/recharging. New cards use lightweight scoped surfaces, not per-card optical shaders/pointer listeners. No new dependencies or embeddings service were installed. No formal p95/concurrent-load benchmark was performed.

## 30. Files changed

All paths below are relative to the repository root printed above. Existing unrelated untracked files were preserved.

**New platform files:**

- `src/lib/resources/types.ts`, `engine.ts`, `manifest.ts`, `catalog.ts`, `catalog.json`, `snapshots.json`, `curation-review.json`.
- `src/lib/resources/safe-fetch.ts`, `mathml.ts`, `pdf.ts`, `intake.ts`, `jobs.ts`, `service.ts`, `artifacts.ts`, `grounding.ts`, `http.ts`.
- `src/app/api/resources/route.ts`, `[id]/route.ts`, `backfill/route.ts`, `process/route.ts`.
- `src/components/resources/resource-library.tsx`, `resource-search-commands.tsx`, `resources.css`.
- `scripts/curate-resources.ts`, `scripts/process-resources.ts`.
- `tests/resource-engine.test.ts`, `resource-api.test.ts`, `resource-jobs.test.ts`, `resource-pdf.test.ts`, `resource-ssrf.test.ts`.
- `docs/resource-intelligence.md`, this report, and the migration in section 31.

**Updated existing files:**

- `prisma/schema.prisma`.
- `src/app/api/ai/route.ts`, `src/app/api/lam/chat/route.ts`, `src/app/api/ebooks/route.ts`, `src/app/api/ebooks/[ebookId]/route.ts`.
- `src/lib/ai.ts`, `src/lib/ai/client.ts`, `src/lib/ai/schemas.ts`.
- `src/components/app-shell.tsx`, `src/components/chapter-command/workspace.tsx`, `src/components/ebook/custom-ebook-library.tsx`.
- `src/components/personalization/import-stage.tsx`, `src/components/personalization/scholar-today.tsx`.
- `src/components/views/resources.tsx`, `study.tsx`, `notes.tsx`, `ebook.tsx`, `flashcards.tsx`, `practice.tsx`, `formulas.tsx`, `revision-hub.tsx`, `nigtube.tsx`, `intelligence.tsx`.
- `tests/personalization-security.test.ts`, `entitlements-fail-closed.test.ts`, `private-beta-auth.test.ts`, `v2-platform.test.ts`.

New visual QA evidence is under `test-artifacts/resource-intelligence-*`: initial page, Resource Vault desktop/mobile, reader mobile, source summary/formulas desktop and Chapter Command Centre desktop. A pre-fix desktop reader screenshot also records the centering defect found and repaired; it is not a final-state screenshot.

## 31. Migrations added

`prisma/migrations/20261002100000_resource_intelligence/migration.sql` adds the five resource tables, constraints and search indexes. No migration was applied. Prisma client generation succeeded. Schema structure validated with temporary nonconnecting localhost placeholders because both required database URL variables are absent locally. Migration/table coverage tests passed; an actual PostgreSQL migration execution was not tested here.

## 32. Tests run with exact results

Final run: separate Bun processes to avoid existing global `mock.module` cross-suite contamination. **40 files, 456 passed, 13 skipped, 0 failed, 0 failing processes.** The five new resource suites account for **65 passing tests / 680 assertions**.

| Suite (`tests/*.test.ts`) | Passed | Skipped |
| --- | ---: | ---: |
| account-workspace | 5 | 0 |
| ai-live | 0 | 9 |
| ai-math-normalization | 2 | 0 |
| ai-reliability | 15 | 0 |
| auth-api | 10 | 0 |
| auth-rate-limit-void | 3 | 0 |
| auth-recovery | 12 | 0 |
| developer-access | 19 | 0 |
| entitlements-fail-closed | 4 | 0 |
| google-auth | 16 | 0 |
| google-claims | 15 | 0 |
| group-study-host-repair | 20 | 0 |
| group-study-policy | 9 | 0 |
| group-study-sync | 2 | 0 |
| guest-mode-security | 3 | 0 |
| live-tutor-provider-reliability | 8 | 0 |
| live-tutor-providers-live | 0 | 4 |
| monetization | 27 | 0 |
| ocr-packaging | 1 | 0 |
| payment-workflow-security | 2 | 0 |
| personalization-engine | 22 | 0 |
| personalization-presentation | 3 | 0 |
| personalization-security | 28 | 0 |
| postgres-auth-security | 6 | 0 |
| postgres-migration-coverage | 5 | 0 |
| private-beta-auth | 19 | 0 |
| quiz-generation-contract | 3 | 0 |
| reminder-store | 3 | 0 |
| reminders-engine | 22 | 0 |
| request-body-security | 2 | 0 |
| resource-api | 17 | 0 |
| resource-engine | 20 | 0 |
| resource-jobs | 16 | 0 |
| resource-pdf | 6 | 0 |
| resource-ssrf | 6 | 0 |
| security-rate-limit | 2 | 0 |
| subscription-security | 16 | 0 |
| user-ai-provider | 2 | 0 |
| v2-intelligence | 41 | 0 |
| v2-platform | 44 | 0 |

Three unchanged legacy suites initially failed five assertions: four expected LAM to remain Plus-only, and one mocked cookies without the existing logout `.delete()` method. Only their stale expectations/mock were updated to current production contracts; auth/subscription production behavior was not changed to make tests pass. Onboarding tests were appropriately updated for asynchronous PDF processing. The new PDF tests exposed and repaired original-buffer transfer and scanned-PDF readiness bugs. Job tests cover transactional rollback/checkpoint recovery, ownership, stale leases, retries, refunds and deletion.

## 33. Build/lint/typecheck results

- `bun run build`: PASS; Next.js 16.3.6 production compilation, built-in TypeScript and all 52 generated pages completed; all four resource route groups registered.
- `bunx tsc --noEmit --pretty false`: PASS.
- `bun run lint`: PASS on the final working tree.
- `git diff --check`: PASS; Git emitted normal LF/CRLF conversion notices, not whitespace errors.
- Prisma client generation: PASS. Read-only structural schema validation: PASS with temporary placeholder connection URLs; **not a database connection/migration test**.
- A normal Prisma validation command initially failed because the required database URL variables are not configured. Loading `.env.local` confirmed both remain absent. No credentials or configuration files were changed to hide that environment gate.

## 34. Browser flows verified

Used the existing browser automation CLI against the local application. Verified guest entry and the unchanged surrounding shell; actual 126-source Resource Vault; subject/chapter filters including Laws of Motion; pagination changing from page 1 to 2; exact-resource command search/navigation; source details, attribution/license/original links; readable source excerpts; summary generation; definition/formula generation; KaTeX expressions with zero renderer-error elements; flashcard reveal; attributed note creation visible in the existing Notes editor; bookmark/save filtering; Escape close and restored focus.

Desktop views were checked at 1258×628 and 1440×900. Mobile reader at 390×844 had a 374 px-wide centered dialog; body width remained 390 px with no horizontal overflow. The Resource Vault was also checked at 390×844. A doubled-translation reader positioning defect was found and fixed only in the new reader/import components. Runtime browser error collection was empty in the exercised flows. Existing smooth-scroll/command-dialog accessibility console warnings were observed; those are not claimed to be eliminated by this resource update.

**Not browser verified:** authenticated PDF/TXT/paste/URL/backfill flows against real PostgreSQL, private-data recovery against a deployed worker, or live AI answers. Their mocked route/worker/security contracts passed, but local database settings/migration and authorized live-provider execution remain prerequisites.

## 35. Known limitations

The acceptance bar is not fully production-proven: no real-database migration/import/browser run, no live-model grounding validation and no configured recovery scheduler. The seed batch is Class 11 PCM, not every supported class/subject. Most official resources are deliberately original-source links. Community snapshots are supplemental, not independently certified. Extraction/classification/formula/definition heuristics need review; OCR is unavailable in the server resource worker. Long private-document search is lexical, with a 500-resource active cap and bounded candidates. Saved filtering is explicitly **on the current page**, not a global saved-library query. The two historical PDF/file storage allowance schemes remain distinct.

## 36. Deferred work

Expand researched Class 9/English/Computer Science and other curriculum seeds; independently review community material and topic-level mappings; license additional authoritative text before ingestion; vetted transcripts; optional OCR; semantic/vector retrieval; fuzzy duplicate detection; certified numeric/MCQ/solution ingestion; richer source-set chapter summaries; topic-level personalization; administrative review dashboards and workload benchmarks. None of these is represented as already implemented or replaced with fake data.

## 37. Production requirements / environment variables

The existing Prisma schema requires **`DB_DATABASE_URL`** and **`DB_DATABASE_URL_UNPOOLED`**. Both were absent from this local workspace's loaded environment. Provide real protected database configuration before staging verification. Existing normal auth/provider configuration remains necessary for authenticated/live-AI features.

The recovery endpoint additionally needs `RESOURCE_WORKER_SECRET` (32+ characters). The scheduler CLI needs `RESOURCE_WORKER_URL` pointing to the trusted HTTPS `/api/resources/process` endpoint and optional `RESOURCE_WORKER_BATCH` (1–20, default 1). Never expose the worker secret through client-visible environment variables. No new paid API, vector database or embedding key is required for the shipped catalog/extractive tools.

## 38. Whether migrations need deployment

**Yes.** The additive resource migration must be applied through the approved migration workflow before enabling database-dependent endpoints in production. Test it against disposable/staging PostgreSQL first. No production/database migration was run during this task; schema validation and client generation do not substitute for that step.

## 39. Whether any external service setup is required

Normal immediate processing uses existing Next `after()`. Reliable retry/expired-lease recovery requires an external scheduler to invoke authenticated **POST** `/api/resources/process` or the bounded worker CLI. No scheduler was registered. A usable PostgreSQL environment is required for private ingestion. OCR/embeddings/transcript services are not required for the implemented feature subset and were not configured. Existing AI providers must be operational to verify live source-grounded responses.

## 40. Exact recommended deployment steps

These are **recommendations only**, not actions taken:

1. Review the diff, corpus, licenses and additive migration; preserve unrelated local files. Obtain a normal database backup before any production migration.
2. Configure a disposable/staging PostgreSQL environment with the correct pooled/direct variables; generate Prisma and apply the migration using the existing migration workflow.
3. Verify real authenticated file/paste/URL/backfill ingestion, mapping/search/readiness/retry/refunds and two-account isolation. Test both onboarding and normal PDF allocations, including scanned/invalid/interrupted cases.
4. Verify LAM/AI grounding with explicitly authorized live provider calls and actual private resources; inspect citation support, not merely valid IDs.
5. Run the relevant isolated suites, lint, TypeScript, build and responsive browser checks on the release candidate. Review the retained curation failure and refresh if appropriate.
6. When the user approves release, commit only reviewed task files. Do not stage unrelated APKs, workspaces or prior screenshots.
7. Apply the reviewed additive migration through the approved production process before exposing code that depends on the new tables. Do not reset the database or use destructive schema replacement.
8. Deploy the reviewed application/corpus through the existing Vercel workflow; configure the protected POST worker scheduler and verify scheduled recovery.
9. Verify deployed guest/library, authenticated imports, permissions, quotas, provenance, mobile layouts and live model grounding. Production acceptance remains pending until these checks pass.

Operations/source-maintenance details: [Resource Intelligence guide](resource-intelligence.md).
