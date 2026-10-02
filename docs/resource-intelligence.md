# Scholar Resource Intelligence — operations and architecture

This is a local implementation, not a deployed database update. Apply the additive migration to a disposable/staging PostgreSQL database and verify authenticated imports before releasing. No production migration, commit, push or deployment was performed.

## Architecture

The Resources page retains its original video-backed study-library interface through `src/components/resources/classic-resource-library.tsx`. Its cards, tabs and filters consume every page of the shared resource API; they do not reconstruct the old synthetic catalog. Other feature shelves continue using `resource-library.tsx`, which also provides the common source reader and private-import dialog. Source-text downloads include attribution and are available only for readable, permissioned sources.

The shared resource service in `src/lib/resources/service.ts` combines a reviewed, server-only global catalog with account-owned PostgreSQL resources. Both expose the same resource/mapping/chunk/citation contract. Global catalog updates are reviewed source changes shipped with Scholar; private uploads are durable database records, never entries in the public catalog.

`StudyResource` owns provenance, permissions, source hash and processing state. `ResourceMapping` uses Scholar's real curriculum/class/subject/chapter IDs. `ResourceChunk` retains heading, page and optional timestamp/source URL. `ResourceArtifact` caches extractive study aids by resource, type and source hash, with generator-version invalidation. `ResourceJob` has a fenced lease, three automatic attempts and bounded backoff.

The normal text/PDF path is:

1. Authenticate, check origin/rate limits, validate class entitlement and enforce existing allowances.
2. Normalize/hash, deduplicate within the owner account and transactionally reserve/store.
3. Return an accepted/processing response; use Next `after()` for one immediate worker attempt.
4. Extract bounded text, persist an extraction checkpoint, classify and index.
5. Publish chunks/mapping/readiness atomically under the job lease.
6. An external authenticated worker recovers retries or expired leases. A third interrupted attempt becomes a visible failure instead of hanging forever.

Ambiguous mappings become `NEEDS_REVIEW`; owners can select a canonical chapter. Scanned PDFs become `needs_ocr` and never claim a complete searchable index. Definite invalid PDFs are rejected and refund the new allocation once; legacy backfill never refunds/recharges a historical allocation.

## Initial reviewed corpus

126 real source records; 28 licensed text snapshots; 98 link-only records. The snapshots total approximately 147 KB, kept on the server rather than sent with every page.

| Publisher | Records | Ingestion policy |
| --- | ---: | --- |
| NCERT | 82 | 37 textbook chapters + 45 Exemplar chapters; original links only |
| Wikibooks contributors | 28 | CC BY-SA 4.0 attributed text snapshots, history/revision references |
| MIT OpenCourseWare | 8 | Lecture/resource pages; noncommercial license, link only |
| CBSE Academic | 3 | Current 2026–27 PCM syllabi, official links |
| PhET / University of Colorado Boulder | 5 | Official simulation links; no rehosted code/media |

Mappings cover the existing **Class 11** Physics (15), Chemistry (14), Mathematics (16) chapter keys, plus three subject-wide syllabus mappings. These include legacy/rationalized chapters in Scholar's existing taxonomy, not a claim that all 45 are in the current board examination syllabus. The catalog explicitly asks students to check their current school syllabus. Class 9 private mappings are supported, but a newly researched Class 9 global corpus, Computer Science and English seeds are not included in this batch.

One NCERT Units and Measurements link experienced a transient socket failure during the full refresh. Its earlier verified entry was retained, and the issue remains in `curation-review.json`. Text-only refreshes preserve review findings for skipped sources.

## Sources and rights decisions

Primary source checks included:

- [NCERT textbook portal](https://ncert.nic.in/textbook.php) and [Exemplar portal](https://ncert.nic.in/exemplar-problems.php?ln=en).
- [CBSE current curriculum](https://cbseacademic.nic.in/curriculum_2027.html).
- [Wikibooks copyright policy](https://en.wikibooks.org/wiki/Wikibooks:Copyrights): copies/adaptations keep contributor attribution, original/history links and the CC BY-SA 4.0 license.
- [MIT 8.01SC](https://ocw.mit.edu/courses/8-01sc-classical-mechanics-fall-2016/): noncommercial restrictions mean no Scholar-hosted transcript/video copies.
- [PhET licensing](https://phet.colorado.edu/en/licensing): use original simulation links rather than assume redistribution rights for all simulations.
- [OpenStax licensing](https://help.openstax.org/s/article/Licensing-information-of-OpenStax-textbooks) and its [Computer Science preface](https://openstax.org/books/introduction-computer-science/pages/preface): current noncommercial/AI-related restrictions were not treated as an unrestricted commercial ingestion license. Not seeded.
- [CBSE Class X sample papers](https://cbseacademic.nic.in/SQP_CLASSX_2026-27.html), [Class XII sample papers](https://cbseacademic.nic.in/SQP_CLASSXII_2026-27.html), [sample archive](https://cbseacademic.nic.in/sqp_archive.html) and [official examination paper archive](https://www.cbse.gov.in/cbsenew/question-paper.html): not relabeled as Class XI PCM papers.
- [NTA documents](https://jeemain.nta.nic.in/documents/page/4/): an answer-key notice without question text was not misrepresented as a question bank. No login-protected candidate papers were acquired.

No paid books, credential-protected content, unrestricted web crawler or scraped commercial coaching corpus was introduced. User URL imports are private metadata bookmarks, not permission to copy that page. Users remain responsible for having rights to their uploaded material. Wikibooks is supplemental/community-authored; successful extraction is not academic certification.

## Imports and limits

- PDF uses the existing private Custom E-Book upload API: 4 MB per file, maximum 500 pages, maximum 2 million extracted text characters and a 35-second parse deadline. Original bytes are copied before PDF.js can transfer them; active JavaScript/actions are rejected.
- The existing one-time 50 MB onboarding allowance, row locking, duplicate protection and monthly upload entitlements remain authoritative. New books are also resource-pipeline inputs. Setup may continue while indexing finishes.
- UTF-8 TXT/Markdown files and pasted notes are bounded to 250 KB (pasted notes require at least 40 characters). Multipart/JSON bodies are bounded before parsing; binary/NUL/invalid UTF-8 payloads are rejected.
- One public HTTPS URL is validated at a time. No credentials or nonstandard ports; DNS addresses are checked and pinned; every redirect is revalidated; private/reserved/cloud-metadata networks are blocked. HTML is fetched only for bounded title/description metadata. Downloads go through file import.
- Text/link storage is charged against existing `StoredFile` storage allowances and limited to 500 active resources. PDF storage continues the existing `CustomEbook` allocation policy; those two historical storage schemes have not been redesigned into one bucket.
- Existing PDF books can be explicitly backfilled from the E-Book library, five at a time. This is private, opt-in and does not consume another upload/onboarding allowance.

## Search, provenance and grounding

Private search uses parameterized PostgreSQL full-text SQL with ownership, visibility and deletion conditions inside the query, plus GIN indexes. Global search uses the bounded static catalog/snapshots. Titles outrank incidental text mentions. Class/chapter/type/publisher/language filters, pagination and current learning priorities influence ranking. This is lexical retrieval, not vector similarity or a semantic embedding service.

The public resource list sends metadata, not pending document text or complete PDF bodies. Readers fetch 12 chunks at a time. Processing jobs do not expose partial chunks. Mapping/extraction failures remain visible, with owner-only review/retry/remove controls. Deletion purges source chunks, cached aids/jobs and stored upload data; copied personal notes are retained intentionally.

Both `/api/ai` resource-context requests and `/api/lam/chat` use server-selected permitted chunks. Uploaded text is explicitly untrusted reference data. Retrieval is capped at six chunks / 12,000 characters. The server whitelists real citation IDs, masks fabricated IDs even across streaming delta boundaries, and constructs source links from retrieved metadata rather than model-invented URLs. This validates citation identity/provenance, **not the truth or entailment of every generated sentence**.

Source-linked summaries, definition cards, formula expressions, flashcards and recall practice are deterministic/extractive. They work without an AI provider. They are not fabricated past papers, a numeric-question generator, independently reviewed answers or automatic exam certification. Formula/definition heuristics may need manual review; source links remain visible. MathML/TeX formulas are preserved and rendered with Scholar's existing safe Markdown/KaTeX renderer.

## Adding, updating, disabling and removing sources

1. Research the original publisher URL and actual reproduction/derivative license.
2. Add an explicit entry in `manifest.ts`, using canonical Scholar mappings. Do not infer modern textbook file numbers from legacy chapter IDs.
3. Run `bun run scripts/curate-resources.ts` to verify new entries; `--refresh` rechecks everything; `--refresh-text` refreshes permitted text only.
4. Review the three generated JSON files, source text/math, rights, syllabus fit and `curation-review.json`. Keep a retained earlier snapshot distinct from a newly successful check.
5. To disable/remove a global source, remove it from the manifest and regenerate. Its catalog record and orphan snapshot are removed from the published bundle. Private user material is never added to this manifest.
6. Global snapshots are re-chunked by the current server service. Private failed jobs can be retried in the reader; changing/replacing an upload creates a new hash/identity. There is no public admin upload endpoint.

## Local testing

Do not point migration tests at a production database. On a disposable PostgreSQL database, generate the client and apply the migration through the standard Prisma migration workflow. Start Scholar with `bun run dev`. Guest browsing of built-ins needs no resource tables, but authenticated ingestion does.

Run each `.test.ts` file in a separate Bun process. Existing tests replace shared modules globally, so one large shared-process `bun test tests` run can contaminate unrelated suites. Relevant resource files are `resource-engine`, `resource-api`, `resource-jobs`, `resource-pdf`, `resource-ssrf`, and the existing onboarding/security/migration regressions. `ai-live` and `live-tutor-providers-live` are opt-in provider calls, not ordinary offline regressions.

## Production ingestion / recovery worker

Existing `DB_DATABASE_URL` (pooled application connection) and `DB_DATABASE_URL_UNPOOLED` (Prisma direct/migration connection) and normal Scholar authentication/provider configuration remain required. Next loads `.env.local` for the application; a plain Prisma CLI invocation does not automatically load that file. For local read-only validation with configured variables, use `bun --env-file=.env.local node_modules/prisma/build/index.js validate`. In this workspace **both database variables were absent even with `.env.local` loaded**. Structural schema validation therefore used temporary, nonconnecting localhost placeholders; no database connectivity or migration execution is implied. Production migration tools must receive real database variables through their normal protected environment. New worker variables:

| Variable | Purpose |
| --- | --- |
| `RESOURCE_WORKER_SECRET` | Shared server/scheduler bearer secret, at least 32 characters |
| `RESOURCE_WORKER_URL` | Scheduler's trusted HTTPS `https://your-domain/api/resources/process` endpoint; localhost HTTP allowed only for local testing |
| `RESOURCE_WORKER_BATCH` | Scheduler command batch size, 1–20, default 1 |

The server endpoint is **POST**, not GET. A periodic external scheduler should invoke `bun run scripts/process-resources.ts` (or perform an equivalent authenticated POST) at a cadence matched to upload volume. One invocation processes one job, fenced against concurrent workers. `RESOURCE_WORKER_BATCH` limits the CLI drain; it does not make one Vercel invocation process 20 jobs. The CLI rejects redirects so the bearer secret cannot be forwarded elsewhere. Never place this secret in a `NEXT_PUBLIC_` variable or the browser.

No scheduler was registered, no secret was written, and no external OCR/embedding service was connected. Next `after()` handles normal immediate attempts, but **automatic recovery depends on the scheduler**. Inspect job error codes and sanitized `[Resource job]` logs; do not log source text, credentials or bearer tokens.

## Release checklist and remaining gates

1. Review the local diff and migration, back up the production database through normal operations.
2. Apply `20261002100000_resource_intelligence` on disposable/staging PostgreSQL first; verify generated client/schema compatibility.
3. Exercise authenticated PDF/TXT/paste/URL imports, indexing/retry/backfill, quota/refund and two-account isolation against that real database.
4. Run live-provider source-grounding checks with explicitly authorized provider credentials. Offline tests do not establish live model quality.
5. Apply the additive migration through the approved production migration process before shipping endpoints that require the new tables. Do not use destructive reset or `db push` as a substitute.
6. Ship the reviewed application/corpus and configure the protected scheduler.
7. Repeat authenticated and guest checks on the deployed host, verify worker recovery and audit source license notices.

These are recommended steps, **not steps performed by this task**. Production rollout is not verified until these gates pass. See the separate 40-section implementation report for exact validation results and file inventory.
