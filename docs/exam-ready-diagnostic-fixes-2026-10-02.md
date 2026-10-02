# Exam Ready — targeted diagnostic and corrections

2 October 2026. Existing Scholar working-tree changes were preserved. No staging, commit, push, deployment, dependency installation, migration or Android change was performed.

## Causes and fixes

1. **Inset workspace:** the global shell added padding and Exam Ready added a rounded, width-limited outer panel. Exam Ready now fills the available app viewport below the existing header, with the sidebar open or closed. Internal panels retain their glass styling; long content still scrolls normally.
2. **Disconnected deadline and budget:** the date field and fixed 120-minute budget were independent. New preparations now derive a realistic study suggestion from the deadline, including daily blocks for multi-day preparation. A manually selected budget is preserved when the deadline changes. Editing daily blocks updates their total, and invalid daily hours are rejected.
3. **Cramped mathematical prose:** legacy math normalization could reinterpret ordinary explanation text containing equals signs, division or superscripts as one long equation. A shared Exam Ready renderer disables that heuristic while retaining explicitly delimited equations. Feedback uses readable paragraphs and line spacing.
4. **Repeating/reordering missions:** chapter tasks used the first concept as their topic; early completion and answer evaluation regenerated stages. Longer new missions now cover curriculum concepts in order before application. Automatic adjustment rescales the existing unfinished path rather than regenerating it. Answers keep the active lesson visible until advancement. Skipped/completed teaching is not immediately reinserted by a manual replan. Repeated verified errors can create one bounded, clearly labelled targeted repair, not an endless restart.
5. **Repeated guest lesson:** every guest checkpoint used the same Newton’s Second Law demonstration. Offline guidance now follows the selected chapter, concept and stage. Laws of Motion has separate first-law, second-law, third-law, friction and momentum guidance, with distinct calibration/application/recall/trap checks. Other chapters show honest curriculum guidance and self-review rather than an unrelated physics demo. These local checks do not manufacture readiness scores.
6. **Live teaching context:** LAM receives ordered coverage, stage-specific instructions, completed-checkpoint context and evaluated-question identities. Already evaluated generated questions are filtered from new responses. Source restrictions and answer secrecy remain enforced.
7. **Saved legacy preparations:** missing coverage metadata is corrected on load; stale first-concept lessons are invalidated. Task IDs/order/status, notes, answers, clocks and revisions remain intact. Existing legacy broad checkpoints remain broad rather than silently deleting or inventing completed work.
8. **Beta communication:** the Scholar menu has an EARLY BETA badge. Entering Exam Ready shows an accessible, dismissible notice about bugs/errors and free access during early beta, with guest/live-AI limitations. The badge reopens the notice. Mobile close-button/title overlap was corrected.

## Files changed in this correction pass

- `src/components/app-shell.tsx` — Exam Ready viewport padding and beta-badge treatment only; unrelated earlier edits retained.
- `src/lib/nav.ts` — Early Beta badge.
- `src/components/exam-ready/exam-ready.css` — fullscreen root, responsive study context, feedback, budget and beta-dialog styles.
- `src/components/exam-ready/workspace.tsx` — beta notice, chapter-aware offline guidance and advancement handling.
- `src/components/exam-ready/setup.tsx` — deadline-aware suggestion/manual-budget behavior and daily-block validation.
- `src/components/exam-ready/presentation.tsx` — distinguish recall cycles, mixed practice and targeted repairs.
- `src/components/exam-ready/teacher-panel.tsx` — shared readable content and checkpoint review before completion.
- `src/components/exam-ready/study-tools.tsx` — shared renderer for formulas and recorded mistakes.
- `src/components/exam-ready/content.tsx` — new scoped content renderer.
- `src/components/exam-ready/use-session.ts` — legacy local-session coverage repair.
- `src/lib/exam-ready/model.ts` — optional coverage/task evidence metadata and backwards-compatible coverage repair.
- `src/lib/exam-ready/planner.ts` — ordered concept coverage, stable advancement, bounded repair and non-overlapping block timing.
- `src/lib/exam-ready/experience.ts` — study-budget recommendations.
- `src/lib/exam-ready/preview.ts` — new chapter/stage-specific offline guidance.
- `src/lib/exam-ready/teacher.ts` — stage-specific teaching and repeated-question filtering.
- `src/lib/exam-ready/server.ts` — backwards-compatible coverage repair on owned-session reads.
- `tests/exam-ready-diagnostic.test.tsx` — 14 diagnostic regressions.
- `tests/exam-ready-teacher.test.ts` — 2 additional teacher regressions.
- This report.

## Validation

- 118 focused tests passed across access, diagnostic, engine, experience, materials, persistence, security and teacher suites, run independently to isolate their module mocks.
- Full lint, standalone TypeScript, the final production build (including TypeScript) and `git diff --check` passed. The Git index remained empty. Git emitted only its existing LF/CRLF conversion warnings.
- Browser walkthrough: calibration → First Law → Second Law → Third Law; review required before completion; a wrong local answer retains the checkpoint and readable feedback.
- Browser setup: a four-day deadline suggests four two-hour blocks; an explicit two-hour override survives a later deadline change.
- Desktop 1680×1000, laptop 1366×768 with sidebar open, mobile 390×844 and narrow mobile 320×568: workspace matches the available app width with no document horizontal overflow. Mission drawer and beta notice stay within the mobile viewport; Escape dismisses dialogs.
- No page errors were reported by the verification browser. The browser session was separate from the user’s browser and closed after verification.

## Limits

The local database is not configured for a real signed-in Exam Ready session. Live provider-backed teaching, uploads and cross-device persistence were therefore checked through focused boundary/regression tests, not a real production account. No migration was applied. Offline curriculum guidance is not live AI, and general chapter guidance outside the authored Laws of Motion examples still requires account-backed LAM for detailed adaptive teaching. Readiness remains an evidence-based study estimate, not an exam-result guarantee.
