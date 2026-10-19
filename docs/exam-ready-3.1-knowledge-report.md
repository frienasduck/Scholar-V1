# SCHOLAR EXAM READY 3.1 — INDEPENDENT KNOWLEDGE SYSTEM REPORT

Checkpoint: 13 October 2026 · release target: late January 2027.

## 1. Executive summary

Built an independent Exam Ready domain with stored content, private-material ownership, source-first retrieval, recoverable lesson segments and the View Materials sheet. This is an implementation checkpoint, not a completed academic universe. **ACADEMIC LIBRARY NOT READY.** No commit, push, deployment, production change, subscription grant or new live AI call was made.

## 2. Existing architecture audited

Reviewed the 3.0 report, all 150 manifests, the two retained raw provider samples, teacher/material/session routes, shared PDF/OCR utilities, generic fetch protection and Prisma ownership models. The former primary catalog was Resources; the new primary catalog belongs to Exam Ready.

## 3. Previous academic failures addressed

Recorded Physics outlines, missing independent calculation contracts, incorrect arithmetic and the Maths false middle-term assertion now have regression gates. Lossless symbol/MCQ normalization is retained. Correction to the prior audit: the 20° incline with μs=.35 DOES slide; the provider's force numbers and acceleration, not its onset conclusion, were wrong.

## 4. Independent library architecture

`src/lib/exam-ready/knowledge/` owns original units, licensed snapshots, mappings, retrieval, bank questions, content versions, context bounds, ingestion and staged generation. Built-in content is repository-versioned; private content and generation checkpoints have dedicated additive PostgreSQL entities.

## 5. Shared infrastructure reused

Authentication, entitlements, grade checks, origin/rate limits, PostgreSQL transactions, PDF.js parsing/rendering, bundled English OCR, provider adapters, academic validators, existing content rendering and Liquid Glass primitives. The AI/verification/storage/React guidance influenced validation, owner fences and isolated UI state; existing provider architecture was not replaced.

## 6. External section dependencies

Removed Resources/Practice/E-Book catalog dependence from factual retrieval. Generic parser/OCR/rendering utilities are reused. Legacy source IDs fail closed with a reselection explanation; no private file from another section is silently imported. Existing Resources/Notes export destinations remain explicit user actions, not teaching inputs.

## 7. Curriculum coverage

Registry: CBSE Class 9 and Class 11, 150 chapters and 695 objectives. The 2026–27 alignment warnings remain: the legacy registry is NOT certified as the current syllabus. PCM priority work is topic-level; the remaining catalog is explicitly tracked, not claimed populated.

## 8. Supported chapters

150: 75 Class 9, 75 Class 11. Full chapter/objective inventory is in `test-artifacts/exam-ready-3.1-coverage.json`.

## 9. Indexed chapter count

18 chapters currently contain readable independent content: Physics p5/p6/p7/p12; Chemistry c4/c6/c7; Maths m3/m5/m8; CS cs7/cs8/cs9/cs10/cs11/cs12/cs14/cs15. CS file handling is labelled teacher-assigned extension, not guaranteed current Class XI assessment scope.

## 10. Deep teaching coverage

**Zero whole chapters independently certified complete.** Fourteen substantive original topic units have explanations, conditions, worked examples, checks and revision prompts. A topic unit is not a comprehensive chapter.

## 11. Partial coverage

All 18 indexed chapters remain PARTIAL. Objective-level missing content, worked-example/question counts and outstanding review are separate fields, not a misleading overall percentage.

## 12. No material

132 chapters have no readable independent built-in material in this checkpoint. This includes all 75 Class 9 chapters and all 15 Class 11 English chapters. The requested breadth is therefore unfinished.

## 13. Verified teaching-source counts

24 stored material records: 14 original topic units plus 10 licensed primary-document sections from FIVE distinct Python documents. There are 53 indexed passage records. These numbers are not 53 independent textbooks or 24 expert-certified courses.

## 14. Source types

Scholar-authored original units; licensed PSF primary documentation; external reference links; private user files; session notepad passages explicitly requested by the user. Unreviewed OCR and rejected generation never become ready teaching text.

## 15. Licensing and attribution

Official references remain link-only unless reuse is established. [OpenStax's current licensing guidance](https://help.openstax.org/s/article/Licensing-information-of-OpenStax-textbooks) restricts commercial reuse; no current OpenStax textbook was copied. An older PDF fetch returned 403 and was not bypassed. [Python's documentation license](https://docs.python.org/3/license.html) permits reuse with retained notices: PSF attribution, change summary, source/version and the full PSF license are included in stored views and the runtime trace.

## 16. Ingestion pipeline

Explicit trusted PSF allowlist; robots and license checks before acquisition; bounded DNS-pinned fetches; named nested-section extraction; normalization; content hash; topic mapping; durable local job reports; sequential ingestion; idempotent reuse. Manual `--refresh`, not an uncontrolled crawler or automatic production ingestion.

## 17. Ingestion failures

The first license check stopped because HTML introduced a line break in the declaration. Whitespace normalization fixed that representation issue without relaxing permission checks; all ten seeds then succeeded. Old OpenStax PDF access remained unavailable. Failure/retry data is in `test-artifacts/exam-ready-3.1-ingestion.json`.

## 18. Deduplication

Primary snapshots are keyed by source/section and hash. A rerun skips unchanged stored sources. Original records have no duplicate content hashes in the audit. Private duplicates are checked under an account lock within the assigned chapter; cross-chapter shared-file associations are still a future improvement.

## 19. Chapter/topic mapping

Exact grade/subject/chapter filters; explicit objective indices in the controlled content definitions; current manifest validation. No keyword-only cross-chapter fallback. Index-based mappings must be reviewed if the registry changes; a complete migration to immutable curriculum-version identities remains outstanding.

## 20. Explanation material

Fourteen original topic explanations plus licensed Python reference sections. The bank labels authored content as authored, not a fresh AI answer. Subject-appropriate content includes force diagrams in prose, thermodynamic sign conventions, bonding models, equations and Python object semantics. Full derivation/visual coverage is not complete.

## 21. Worked examples

14 original worked examples, with independent arithmetic traces where applicable: opposing forces, friction with uphill pull, work-energy, rolling, calorimetry, equilibrium, bond order, binomial coefficients, complex roots, trig sign checks and list aliasing. No claim that every chapter has beginner/intermediate/challenge variety.

## 22. Question quality

14 original checks with stable content identities, exact assessed objectives, difficulty, timing, marks, rubrics and calculation metadata. Bank keys are withheld from authenticated lesson copies; Guest checks are authored self-review, not verified exam evidence. Official papers and extensive difficulty banks remain missing.

## 23. Revision material

28 authored revision prompts plus mistake/condition summaries in the original units. Existing session-derived revision evidence and user notes are preserved.

## 24. Academic validation

Structural depth, exact scope, distinct options, rubric totals, stable question identity, bounded arithmetic, compatible units and known-misconception regressions. Factorials now support integer inputs 0–20; no eval/functions/unrestricted CAS. These checks do NOT certify every formula choice, symbolic proof, chemical claim or generated citation's semantic support.

## 25. Recorded AI errors repaired

Saved Physics/Maths outputs are replayed without provider calls. Incorrect examples lacking calculation traces are rejected; false numerical middle-term generalization is rejected; valid factorial coefficient calculations can be checked. Earlier two symbol-shape failures and the overwritten intermediate Maths sample are documented historically, not falsely represented as five retained raw files.

## 26. Remaining academic issues

Major content gaps; insufficient alternative examples/questions; source/claim semantic verification; complex diagrams/derivations; current-year registry alignment; reliable real-provider acceptance. Authored overview/concept text repeats in places and needs further editorial polish; this is not a polished flagship completion.

## 27. Student PDF integration

Dedicated private upload inside Exam Ready: PDF, PNG, JPEG and UTF-8 plain text, up to 3 MB per file. Files are not published into E-Books/Resources. Account-locked deduplication and bounded active/recovery storage: 3 active files for Free, 20 for already eligible elevated plans. Large/chunked textbook uploads are NOT implemented here; deferred E-Book 20 MB work was untouched.

## 28. OCR

Reuse bundled English Tesseract; separate bounded PDF extraction and OCR stages; successful pages survive interruptions; OCR pages require explicit review before retrieval. Equations/handwriting/diagrams and non-English OCR are not certified. Shared native OCR tests passed; real authenticated upload-to-OCR browser proof is still pending.

## 29. User-file ownership

Parameterized owner-bound list/read/file/retrieve/update/delete/job queries. Fenced leases prevent stale writes after deletion. Soft deletion immediately blocks reads and retrieval, with bounded retained recovery storage. Review changes increment an integer source revision; stale caches do not rely only on timestamps.

## 30. Selection/exclusion

Scholar, personal-only, mixed, reference-checked and explicit custom policies. Private files require selection; excluded IDs cannot be retrieved. Source/version changes affect keys and saved context. Clear legacy selections/reset exclusions are explicit actions. Requested notebook styles use a separately identified owned note passage, not another section's history.

## 31. View Materials UI

One small workspace entry opens the existing Liquid Glass drawer. Chapter/policy selection, actual source status, cited/retrieved/selected/available distinctions, license, stored text, private-file actions and source exclusions. Existing resource preview styles are reused; broader workspace/mascot visuals were not redesigned. Some source-card/editor polish remains.

## 32. Actual source-use trace

Lesson trace stores policy, selected/excluded IDs, retrieved IDs/versions/headings/pages and the IDs cited in the accepted output. Browser Guest guide cited exactly the net-force unit shown as used. Excluding it removed its used badge and produced a gap rather than an unrelated substitute.

## 33. Citation integrity

Only IDs from supplied readable passages can link to sources; link-only material is never a text input. Invented citations/links are filtered and remote image syntax is suppressed in generated blocks. A valid citation ID is provenance evidence, not independent proof that every associated scientific sentence is correct.

## 34. LAM integration

Source-first runtime context; bounded complete JSON records rather than a truncated JSON blob; original baseline teaching can avoid a provider call. One generation call per explicit request; valid core/example/question segments are retained; missing stages are targeted on retry; original pace/request are carried for recovery. New dynamic provider reliability is unverified until a new budget is approved.

## 35. Live teaching results

**Zero new live calls in 3.1.** The prior five logical academic tests remain exhausted and had zero fully accepted AI lessons. No new pass is invented from mocks or authored bank output. Approval is required for more live testing.

## 36. Guest behavior

Legitimate local Guest plans, built-in guides, material browsing and local self-review. No private upload or unrestricted anonymous AI. Guest written comparison can enable mission progress but does not award verified readiness. Missing/excluded material disables Finish; skip remains explicit.

## 37. Entitlements

Existing feature rollout, account/grade, Free/Plus/provider and rate protections retained. Class 9 server access still requires its entitlement. No Plus grant, payment or production account changed. Own Exam Ready storage limits are separate from unchanged E-Book allocations.

## 38. Mobile

390×844 browser sheet: 370 px wide, 828 px high, client width and scroll width both 359 px—no horizontal overflow in this check. Chapter controls/cards remain in a scrollable viewport and the sheet closes back to the mission. Physical-device touch/keyboard/picker and authenticated mobile uploads are not certified.

## 39. Performance

Local deterministic built-in retrieval: ~0.066 ms mean across 1000 runs in the recorded audit. No claimed before/after speedup. Source lists are paged eight at a time; full catalog documents are not sent in list responses; private views are page-scoped; requests abort when closed/unmounted; panel status is isolated from the workspace. Browser long-task/FPS/memory baselines remain unmeasured.

## 40. Visual/animation preservation

No changes to Exam Ready CSS, shared presentation primitives, global styles or LAM asset/animation files. Existing teacher components received functional self-review/error gating changes, not a design rebuild. Screenshots are checkpoints, not pixel-identical regression certification.

## 41. Migrations

Prepared `20261013000000_exam_ready_knowledge`: additive ExamReadyMaterial and ExamReadyGeneration tables with ownership/FK/indexes, revisions and leases. Prisma schema validation passed using disposable schema-only environment placeholders; no database connection/migration was made. Root/staging/production databases remain untouched.

## 42. Files changed

Knowledge modules/snapshots/license; own material/guide routes; material selection/teacher/mock context and generation recovery; model metadata; View Materials panel and existing tools/workspace/setup/teacher behavior; ingestion/audit scripts; new tests and this report. Existing unrelated PDF/schema/staging edits were preserved, not silently shipped.

## 43. Test additions

Independent content/isolation/coverage/bank/numerics/context tests; robots/license/idempotent ingestion; source exclusion/page retrieval; private A/B function denial and actual PDF parsing under SQL fixtures; saved-failure replay; staged segment retention and no automatic provider retry. These fixtures are not a live two-account browser certification.

## 44. Exact test counts

Final recorded full isolated run: **979 passed, 1 failed, 16 skipped across 100 files**. The failure remains the preexisting deferred PDF signature-location static assertion in subscription-security.test.ts. It was not hidden or weakened. Two new live-provider checks remain opt-in and were not rerun.

## 45. TypeScript

Latest local production build's TypeScript check passed.

## 46. Lint

Focused Exam Ready/source/script/test ESLint passed; git diff --check passed with only existing LF/CRLF conversion warnings.

## 47. Production build

Local production compilation passed, including 69 static pages and the new routes. This was NOT a deployment or a clean RC certification: the shared dirty worktree still includes preserved deferred PDF changes.

## 48. Browser QA

Local 127.0.0.1:3002 Guest: preserved prior plan/notes; new disposable two-chapter plan; stored first-law/second-law teaching; intentional wrong MCQ feedback; written self-review enabling progress without readiness credit; actual used-source badge; exclusion leading to a material gap; Work/Energy chapter filtering; 390×844 sheet geometry/scroll and close. No paid AI call or staging-domain retry.

## 49. Security/privacy proof

Existing access/security tests pass. New private-material A/B and deletion/retrieval tests pass under isolated SQL fixtures; real PDF parsing preserves pages in that job path. No production cookies/keys copied, private student content exported, account created or domain denial bypassed. Real PostgreSQL transactions, auth transitions/shared-device caches and two signed-in staging identities still need end-to-end proof.

## 50. Incomplete chapters

132 empty and all 18 indexed chapters partial. Class 11 PCM breadth/depth, remaining CS gaps, English and all Class 9 subjects remain unfinished. See every missing objective in the machine-readable coverage matrix; do not advertise complete academic coverage.

## 51. External configuration needs

Isolated authorized PostgreSQL/session configuration; application of only reviewed Exam Ready tables; explicit candidate isolation/deployment approval if needed; allowed staging browser access; disposable test identities; a newly bounded live AI test budget. Current root auth/database and previously blocked staging access are not bypassed.

## 52. Deferred tasks

Populate the remaining curriculum with legally reusable/original reviewed material; immutable curriculum-version mapping; extensive bank/derivation/diagram coverage; larger uploads/multi-chapter file association; real upload/mixed/delete/privacy journeys; deeper editorial and mobile-touch/picker polish; staged generation/live feedback/mock reliability; measured full UI performance. No automatic production release.

## 53. Final readiness verdict

**ACADEMIC LIBRARY NOT READY.** Useful independent content and core infrastructure exist, but the required vast/comprehensive library, trusted real AI teaching and authenticated upload acceptance are not established. Work is unfinished; this report is not a completion claim.

