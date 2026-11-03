# Freebuff surgical rollback and five-second Scholar loader

3 November 2026. Local work only. Branch `main`; HEAD remains `e28f7cb53ffc37ef0d9eb26e8acb460beb6222ab`.

## Outcome and ownership

Reversed the confirmed Liquid Crystal overlay without replacing the application or introducing another redesign. The five tracked rollback targets now have **zero Git diff** against the verified preceding Codex release. Ownership was established using the complete working-tree diff, dependencies, the prior Codex release in this chat, Git history, and the existing Liquid Velocity/loader reports—not file timestamps alone.

| Restored file | Confirmed unwanted changes reversed |
| --- | --- |
| `src/app/layout.tsx` | Removed only the `liquid-crystal.css` import. Retained `liquid-glass.css`, `liquid-velocity.css` and `launch-splash.css`. |
| `src/components/app-shell.tsx` | Removed `scholar-sidebar-head`, the two added `scholar-sidebar-mark` classes, and the extra `scholar-nav-item` on the special Plus/upgrade row. **Preserved the pre-existing `scholar-nav-item` on ordinary navigation rows**, with its legitimate styles, tests and motion dependencies. |
| `src/components/liquid-glass/glass-filter.tsx` | Restored the `RefractionPreset` type; removed the extra 16-unit `lens` filter and its duplicated-scene comment. Retained the original three shared presets and signed-edge five-primitive optical renderer. |
| `src/components/liquid-glass/velocity-motion.tsx` | Removed the added spring import/easing, restored `VELOCITY_TIMING.navigation` with `out(4)`, removed `sg-velocity-lens-scene`, and removed only the extra `.scholar-main-scroll button` delegated press selector. Original Anime scopes, live optical lens, dock/tab behavior, press handling and cleanup remain. |
| `src/components/ui/button.tsx` | Removed the added defaulted `data-variant` and `data-size` attributes used by the unwanted stylesheet. Preserved the original variants, props and rendering. |

Removed two confirmed Freebuff-created text files after verifying their dependencies:

- `src/components/liquid-glass/liquid-crystal.css`: the global environment, panel, chrome, navigation, control, menu/dialog/tab, dock and appearance overrides.
- `scripts/liquid-crystal-visuals.mjs`: the corresponding capture script.

Both are recoverable from the safety backup. **All 32 existing files under `test-artifacts/liquid-crystal/` were retained as evidence.** No screenshots, reports, APKs, asset folders, paused cinematic-video work or unrelated untracked directories were deleted. No whole-file Git restore/reset or whole-commit revert was used. Two restored files received only native line-ending normalization after their content diff was already empty.

Preserved Codex Liquid Velocity 1.0, installed Anime.js 4.5.0, original Liquid Glass components/optics, desktop/mobile navigation, Exam Ready 4.0, authentic LAM, education, authentication/user data, homepage/cinematic development, all startup readiness code and the liquid-wordmark assets. No package or lockfile changes.

Other untracked/scratch work has uncertain or unrelated ownership and was deliberately left alone. No ambiguity remained in the seven confirmed rollback targets; no attempt was made to infer ownership of the whole untracked tree.

## Recoverable safety snapshot

Created **before editing** outside the repository source:

`C:\Users\Lenovo\Desktop\SCHOLAR\.rollback-backups\2026-11-03-073219-freebuff`

Includes 18 copies of relevant source, loader, tests, scripts and reports; the complete tracked working-tree patch; the empty staged patch; and a README recording branch, HEAD, classification and selective recovery instructions. No credentials, environment files, database exports or browser sessions are in this backup.

Working-tree patch SHA-256: `52869FFCD98439A2C58EB7DBE08BE3A3D51ECAAFE9CBE03AAED22774709DD719`.

## Loading-screen correction

This intentionally supersedes the earlier loader report's immediate-ready/repeat-static behavior, following the user's new five-second instruction.

- `src/lib/animation/launch-wordmark.ts`: shared `WORDMARK_FILL_DURATION = 5_000`, with linear physical bottom-to-top travel. Task progress no longer cancels/restarts or accelerates the liquid. A separate readiness signal prevents false full completion when actual preparation is still pending.
- `src/components/launch-readiness-gate.tsx`: reveal requires **both** the five-second minimum and the existing real startup/session/shell/profile boundaries. A slow backend still holds the overlay longer. Optional “Open now” cannot bypass these boundaries.
- `src/components/launch-splash.tsx`: passes actual readiness into the existing controller without per-frame React state.
- `src/components/launch-splash.css`: removed the reload-only forced full-white carrier; normal reloads now also use the slow reveal.
- `tests/launch-wordmark.test.tsx` and `tests/launch-splash.spec.ts`: added linear-rise/minimum-duration coverage, reload coverage, and seven-second session/profile fixtures proving readiness still blocks after five seconds.

Preserved the pure `#000` full-viewport background, local heavy typography, connected liquid wave, existing short opacity-only fade, no zoom, accessible status, hidden-tab pause, cleanup and independent exit safety cap. System/application reduced motion remains the static, immediate-when-ready accessibility exception.

Recorded fast desktop and mobile sessions began exiting after **5,089 ms** and **5,088 ms**, respectively, measured from first overlay observation. Removal followed at approximately **5.39/5.40 seconds**, including the existing completion/fade. No simultaneous duplicate overlays or horizontal overflow. These are local recorded observations, not a promise of exact timing or constant 60 fps on every device.

## Verification evidence

All new artifacts are under `test-artifacts/rollback-2026-11-03-073219/`; older evidence remains untouched.

| Check | Actual result |
| --- | --- |
| `bunx tsc --noEmit` | Passed, exit 0. |
| Actual `bun run lint` (`eslint .`) | **Failed: one pre-existing error**, `src/components/landing/cinematic-video.tsx:120`, `react-hooks/refs`, `runRef.current = shouldRun` during render. This paused, unrelated untracked component was not changed or excluded. Full output: `lint.log`. |
| ESLint on changed loader/source/test files | Passed, exit 0; `scoped-lint.log`. |
| Actual `bun run build` | Passed, exit 0; production webpack compilation, TypeScript and all 70 static pages completed. `build.log`. This builds locally only; no migration/deployment. |
| Isolated unit/regression suite | **1,239 passed, 0 failed, 16 skipped**, across 115 files. Live-service flags disabled. `unit-results.json`. |
| Playwright loader/startup suite | **11 passed**: six actual-browser cases and five source guards. Includes slow readiness, five-second early-ready/reload, reduced motion, visibility pause and teardown. `browser-tests.log`. |
| Actual desktop/mobile interaction harness | Completed: navigation rapid selection/collapse/reopen, keyboard command dialog, Guest note/editor/dropdown, Radix tabs, private Guest gate, LAM panel only, motion/quality fallbacks, large text, touch dock/press cancellation/More drawer/landscape. `ui/results.json`. |
| Original optical architecture | Live backdrop displacement proof: edge mean pixel difference **45.00**, center **3.01**, using `#sg-refraction-standard`; not the removed duplicated scene. |
| Console | No uncaught page errors; **no unexpected console errors** in the completed desktop/mobile harness. Twenty intentionally blocked API resource messages are recorded separately. |
| Final source checks | Five rollback files have zero Git diff; no stale Liquid Crystal/header/mark/duplicated-scene references in application source, scripts or tests; `git diff --check` passes. |

The auxiliary `console-audit.mjs` did not establish a valid hydrated Guest shell in two attempts and is **not counted as passing evidence**. See `console-audit-notes.md`. The established interaction harness waits for the overlay to appear and disappear, then verifies the real Guest shell; its completed run supplies the console evidence.

Verification used local production build `http://127.0.0.1:3020`, real Chrome rendering and actual app interactions, with API requests intentionally blocked or fulfilled by synthetic test fixtures. No live AI calls, real accounts, database operations or production services were used. Authenticated backend behavior and physical-device/GPU performance are outside this local visual rollback verification.

## Visual review and captures

Inspected both the historical `test-artifacts/liquid-velocity/interactions/desktop-lens-settled.png` / `mobile-dock.png` and newly rendered desktop/mobile output. The original flush, 256-pixel sidebar at `(0,0)` with zero margin, brand treatment, rows, selection lens, command dialog and mobile dock composition are restored. `freebuffNodes = 0` in the actual desktop DOM.

Comparison is of the restored interface, not a claim that entire screenshots are pixel-identical: video/background frame, time-dependent greeting and nav scroll can differ. `desktop-restored.png` explicitly matches the historical nav scroll position. Mobile was browser-emulated at 390×844, including touch events; not a physical phone.

New evidence:

- `ui/desktop-restored.png` — restored desktop sidebar and Notes view.
- `ui/mobile-dock.png` — restored mobile dock and Home view.
- `ui/dialog.png`, `ui/notes-menu.png`, `ui/mobile-landscape.png` — portal/menu/responsive checks.
- `loader/desktop-loader.mp4`, `loader/mobile-loader.mp4` — fresh real-clock browser recordings, also retained as WebM.
- `loader/desktop-timeline.png`, `loader/mobile-timeline.png` — inspected one-second frame sequences showing the gradual rise.
- `loader/results.json` — timing, fill samples, single-overlay checks, recorded frame gaps and errors.

## Publication and remaining issues

**No commit, push, deployment, database change or production modification occurred.** HEAD and branch are unchanged; the index remains unstaged. Only the six intended tracked loader/test files retain content diffs after the rollback, plus this new report and local QA artifacts.

Remaining issues: full-project lint is still red solely at the untouched paused cinematic-video component. Browser emulation/fixtures do not certify real signed-in services or physical-device smoothness. All unrelated work remains available for its own task.
