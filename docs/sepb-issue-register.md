# SEPB issue register — 2026-10-06

Baseline reproduced with `bun test tests/personalization-security.test.ts`: **25 pass, 3 fail**. No application edits preceded this register and the release matrix.

| ID | Area | Severity | Reproduction | Root cause / evidence | Fix | Verification | Status |
|---|---|---|---|---|---|---|---|
| RC-001 | Bonus PDF dispatch | High | Onboarding POST returns 201 but test sees 0 background tasks | Test resource.findFirst always returns null even after nested creation; production also performs a second optional lookup after committing upload | Pending atomic dispatch review + faithful relational fixture | Onboarding dispatch, owner/private resource, no duplicate allocation | Investigating |
| RC-002 | Failed standard PDF creation | High | Expected 422; receives 503 | Fixture lacks findFirst/aggregate/storedFile and entitlement storageLimitBytes; unrelated TypeError masks intended create failure. Durable DB/storage outage should be 503, as current ebook-upload test correctly asserts; 422 would imply invalid user content | Restore complete fixture; explicitly exercise creation failure and safe response/quota release, not weaken rollback assertions | Durable rollback + no tasks + friendly response + existing book intact | Investigating |
| RC-003 | Original PDF byte preservation | High | Expected upload 201; receives 503 | Same incomplete transaction fixture. Upload is now asynchronous; old POST-only assertion no longer invokes PDF worker, so cannot prove transfer safety | Exercise extraction with transfer and compare original bytes; keep original persistence assertion | Transfer adapter + processing integration + real PDF parser suites | Investigating |
| RC-004 | Canonical/OAuth origin | High | Source default is scholar-v1.vercel.app in auth config/layout/sitemap | Product domain is scholarofficial.vercel.app; actual production override not yet checked | Pending shared canonical default with localhost/explicit override preserved | Domain/callback/metadata regression tests + production metadata | Investigating |
| RC-005 | Real private journey certification | Blocker (release gate) | Local backend previously reports incompatible DATABASE_URL protocol | Prisma schema PostgreSQL; isolated staging DB and disposable account not confirmed | No production DB/config mutation; inspect presence/protocol only and request isolated environment if needed | Real upload→process→reader→OCR/LAM→refresh→owner denial | Unverified |
| RC-006 | Cross-tab account switch | High (hypothesis) | Subscription provider listens only to same-tab session change/focus/visibility; explicit switch clears session but local account shell may remain | Need inspect shell and all event dispatch boundaries before confirming | Pending fail-closed switch + privacy-safe multi-tab invalidation if confirmed | Account A→B, logout, delayed session, stale response negative tests | Investigating |
| RC-007 | Physical mobile/native coverage | High (release gate) | No real iOS/Android device currently attached | Emulation does not certify virtual keyboard/WebView/media permissions | Document physical test checklist, do not claim emulation as device proof | Native keyboard/file picker/audio/back navigation | Unverified |

Tests are corrected only when source/contract evidence demonstrates fixture drift. Assertions for ownership, quota atomicity, original bytes, rollback and friendly errors remain required. Current task does not authorize commit, push, deploy or production database changes.

## Current closure evidence

The original table is the pre-edit record; this table records the current result.

| ID | Root / fix / verification | Current status |
|---|---|---|
| RC-001 | Bonus transaction returns its nested durable resource ID. Route dispatches without a second optional lookup. Faithful relation fixture proves no parsing before dispatch and extraction after it. | Fixed locally; 28/28 personalization-security cases pass |
| RC-002 | Restored missing transaction methods and storage allowance. Test proves create reached once, rollback leaves no file, quota released once, no task scheduled and no SQL details returned. 503 is storage outage; invalid PDFs remain separately rejected. | Fixed, not waived |
| RC-003 | Dispatched callback uses real extraction adapter against transfer-simulating parser. Compares original bytes before/after and asserts extracted content. Actual PDF parsing/resume/rasterization/OCR suites pass. | Fixed; full real-DB gate still RC-005 |
| RC-004 | Shared official canonical origin repairs auth defaults/metadata/sitemap; explicit staging override/dev localhost and unsafe-origin rejection retained. Vercel confirms official domain. Encrypted override value/Google Console allowlist not inspected. | Source fixed; live OAuth callback unverified |
| RC-005 | Confirmed local SQLite URL with PostgreSQL schema and absent session secret. Supplied URL is production, not isolated staging. No production DB/credential changes. | BLOCKER: private-user journeys not certified |
| RC-006 | Confirmed old shell could remain during explicit switch; other tabs waited for focus to see logout. Now synchronous shell gate, abort/sequence fences, nonce-only cross-tab invalidation, no rebroadcast, monthly usage cleared and invalidation excluded from account vaults. Five render and three event cases pass. | Local fix; real A→B browser gate outstanding |
| RC-007 | Required viewport emulation performed, not physical Android/iOS/WebView/keyboard/media-permission tests. | High release gate, unverified |
| RC-008 | Session storage counted only StoredFile, unlike upload enforcement. Uses common privateStorageUsed helper including standard books. Tests cover owner-scoped sums, guest no-read and safe outage. | Fixed |
| RC-009 | Uniform API browser/CDN privacy header missing. Added private,no-store for all APIs; static-only service-worker policy unchanged. Unit and actual built-server anonymous HTTP checks pass. | Fixed |
| RC-010 | Production UI visibly says Drive Not configured; env metadata lacks Drive client ID/secret. Encryption can use existing AUTH_SESSION_SECRET; separate encryption secret was not falsely declared mandatory. | High: administrator setup/consent/callback required |
| RC-011 | Live public auth config returns passwordResetConfigured=false/emailVerificationConfigured=false; metadata includes Resend key but no sender. | High: verified sender and delivery journey required |
| RC-012 | Screenshot/DOM proved 21 px search control overlapping neighbors at 320 px. Narrow header now has 44 px menu/search/notification controls, secondary actions in drawer, no squeezed guest badge. Drawer Feedback→close→Study exercised. | Fixed and browser verified |
| RC-013 | Canvas drawing/zoom rail collided with bottom Menu; minimum height broke short/landscape fit. Reserved bottom control space, visual-viewport height, no mobile minimum floor, compact layout for short sub-1024 screens. | Local fix; final geometry verification pending |
| RC-014 | Ordinary guest Notes intentionally excluded from preference-only storage, but said Autosaved. Explicit session-only/export-before-refresh notice and honest editor status; no private account data added to guest persistence. Separate built-in reader bookmark/note actually survived reload. | Expectation fixed; ordinary guest Notes remain session-only |
| RC-015 | Guest schema 2 re-triggered schema<7 migration, resetting fresh mobile LAM mode every refresh. Writes current schema; preference-only/no-privilege invariant retained/asserted. | Fixed; final browser refresh check pending |
| RC-016 | Reader icon/page controls unnamed and chapter cards pointer-only. Added labels, bookmark pressed state and Enter/Space activation, same visual layout. | Fixed; final keyboard check pending |
| RC-017 | Initial live Gemini failed AI_OUTPUT_TRUNCATED(422) with 80-token override; NVIDIA also hit 40-second probe timeout. Corrected probe to actual 4,000-token production default/internal 50-second bound. All four real providers then passed; explicit choices must resolve to themselves. No key/model changed or incomplete-output check relaxed. | Explained and verified; upstream latency still varies |
| RC-018 | Initial smoke incorrectly expected 401 on public Exam Ready policy. Source intentionally gives policy plus empty sessions. Smoke asserts exactly zero private sessions and 401 on creation. | Contract corrected; privacy assertion stronger |
| RC-019 | Final landscape inspection found LAM's 768 px mobile boundary conflicted with AppShell's 1024 px dock. Centralized compact/render-quality query at 1023 px, aligned CSS and preserved desktop dock ≥1024. Final closed-capsule/header geometry at 390/844/820/1366 showed no overlaps; independent breakpoint regression passed. | Fixed and browser verified |

RC-017 reference: [Google output/thinking limits](https://ai.google.dev/gemini-api/docs/generate-content/thinking). No failing critical test was hidden, removed or skipped to obtain a pass. Live opt-ins are separate from default zero-cost tests. Full evidence and release prerequisites are in `sepb-release-candidate-report.md`.

### Final browser closures

- RC-013: final rebuilt Canvas at 320×700, 390×844 and 844×390: drawing/zoom controls both inside the stage, mutually disjoint and clear of fixed Menu. Compact LAM header height accounted for. Closed locally.
- RC-015: selected Compact in local Guest Settings, reloaded, reopened LAM settings; Compact persisted. Closed locally.
- RC-016: Enter on the named rebuilt chapter card opened the correct chapter; zoom/rotation/expand/bookmark/note/OCR/page controls expose names and pressed bookmark state. Closed locally.
- RC-014: actual rebuilt `role=note` warning explicitly describes session-only guest Notes/export. Separate reader annotation/bookmark count remained one each after reload.

Final default run: 880 pass, 0 fail, 14 skip / 92 files; explicit live probes 12 pass, 0 fail, 2 skip. Real browser layout evidence: 92 settled observations, 24 routes, 14 viewport sizes, no document-wide overflow/framework overlay. Authenticated/staging/physical gates remain open; no release certification inferred.

## October 8 isolated staging execution

- RC-005 infrastructure prerequisite: user approved candidate push + Free staging. Separate `scholar-staging` Vercel project and `scholar-staging-db` Neon Free project created; pinned isolation, zero-table/write-permission proof and all 16 migrations passed. Real private-account journey is still **unverified**, not closed by schema provisioning.
- RC-020 (high): production project currently scopes base DB/session envs to previews too. Candidate branch now refuses execution there before migrations, requires known project/resource/endpoint/origin and direct TLS connection in staging, and preserves existing main behavior. Negative boundary cases pass. No production Git/env settings changed.
- RC-021 (setup gate): browser Vercel dashboard requires secure user sign-in; staging Git branch setting and OAuth/email follow-up pending. Disposable controlled addresses requested; no production user or synthetic entitlement borrowed.
- Current zero-cost regression run: **886 passed, 0 failed, 14 opt-in skipped / 93 files**. Full details/checkpoints: `sepb-staging-execution.md`. No new billable AI test authorized or run.
