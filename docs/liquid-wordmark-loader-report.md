# Scholar liquid wordmark — local implementation and verification

2 November 2026. Initial implementation base: `5988c52`. The user subsequently authorized review, fixes, push and production deployment; release-preflight follow-up is recorded below.

## Result and latest art direction

Implemented the reference's charcoal Scholar lettering, one connected white liquid surface, small real startup status and full-white completion. Subsequent user corrections supersede the original background and exit directions: **the entire viewport is pure `#000`, with no violet artwork, outside margin or rounded panel boundary; completion is a simple fade into the ready page, with no enlargement or zoom**. Desktop wordmark scale and placement are retained; mobile scales to its viewport. The review pass uses a stable local heavy face to avoid a webfont-swap jump.

Inspected the actual supplied MP4 before implementation: H.264, 1600×1200, 60 fps, approximately 5.17 seconds. Extracted a frame contact sheet, middle-fill and zoom frames. Compared the real browser captures with them. The original reference is not embedded, copied into public assets or used as the runtime animation. The final typography uses Scholar's existing heavy system/Geist face, not the unidentified reference font.

Reused installed Anime.js **4.5.0**, with `animate`, `createTimeline` and `createScope`. No dependency or lockfile changes. Checked the official [scope](https://animejs.com/documentation/scope/), [timeline](https://animejs.com/documentation/timeline/) and [update callback](https://animejs.com/documentation/animation/animation-callbacks/onupdate/) documentation. The React best-practices and end-to-end verification skills informed lifecycle cleanup, accessible status and actual-browser checks.

## Runtime and readiness

- Real completion still requires settled startup work, a prepared shell/session state, and the signed-in user's profile when applicable. Existing controller tasks, timeout/error handling, authentication, Guest access, session restoration and stored data are preserved.
- No independent fake five-second loader. Removed the old first-launch branding minimum for every mode. Optional warm-up modes retain their existing behavior; Open now can cancel optional preparation, not bypass auth/profile readiness.
- Pending task progress is capped at 92%; an additional glyph-space mapping guarantees a visible charcoal cap even at the wave crest. Full white is authorized only by the existing readiness gate. No rapidly announced or invented percentage is displayed.
- Unknown progress produces indeterminate liquid motion and truthful status. Reduced motion uses a static identity and immediate exit. Repeat visits use the same static identity with a short fade, not another large zoom.
- Normal cosmetic completion: 90 ms final fill followed by a 160 ms fade, with no hold or scale animation. A separate 380 ms removal timer prevents a lost animation callback from leaving the overlay stuck. These are scheduling targets, not promises under a blocked main thread. The fade uses Anime's native WAAPI opacity path, with a JS fallback for older WebViews.
- Pointer interception and loading accessibility state end as soon as readiness is committed, before cosmetic removal. Failed session restoration reveals the existing Retry connection screen; coordinator-level failures also offer Retry safely without clearing saved work.
- The dynamic-import fallback holds the same static opening pose. It does not run a second introduction. Browser checks observed at most one launch surface.
- One small SVG text clip and a 12-segment cubic wave; no turbulence filters, canvas, WebGL, external artwork, new font or media requests. Wave/fill frames mutate isolated SVG properties, not React state. Only opacity changes during the exit; lettering stays the same size. Timelines/scopes/listeners are cleaned up; a browser test verifies no continued mutations after removal and pause/resume on synthetic tab-visibility events.

## Evidence

The final artifacts are real local production-build browser captures, using synthetic anonymous session/network fixtures. They are not generated product mockups, live-account certification or AI-provider tests.

Recordings:

- [Desktop MP4](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/after/desktop-loader.mp4), [original desktop WebM](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/after/slow.webm).
- [Mobile MP4](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/after/mobile-loader.mp4), [original mobile WebM](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/after/mobile.webm).
- [4× CPU mobile WebM](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/after/mobile-throttled.webm).

Desktop milestones: [start](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/desktop-start.png), [25](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/desktop-25.png), [50](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/desktop-50.png), [75](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/desktop-75.png), [100](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/desktop-100.png), [fade](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/desktop-fade.png), [prepared page](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/desktop-ready.png).

Mobile milestones: [start](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/mobile-start.png), [25](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/mobile-25.png), [50](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/mobile-50.png), [75](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/mobile-75.png), [100](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/mobile-100.png), [fade](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/mobile-fade.png), [prepared page](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/mobile-ready.png).

Milestone captures pause Playwright's deterministic clock while the **actual** controller runs and session readiness is withheld, then released. Labels identify approximate normalized fill targets, not exact white pixel-area percentages. Exact observed values are in [milestone results](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/milestones/results.json). Real-time recordings and measurements use normal clocks, not those deterministic captures.

## Measured load impact

The [before](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/before/results.json) and [after](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/after/results.json) runs use local production builds, matching viewport/session fixtures, and browser screen recording. Measurements are single samples on this machine, not field benchmarks or statistically established speedups. Readiness time is when the gate's ready state reaches the DOM; handoff is the subsequent time until overlay removal. Pointer interception ends at readiness in every after scenario.

Observed milliseconds, rounded; these are **DOM removal** timings, not a claim that the screen stays visually opaque for that entire interval:

| Scenario | Before readiness from navigation | Final readiness from navigation | Before ready → removed | Final ready → removed |
|---|---:|---:|---:|---:|
| Fast desktop, 100 ms session fixture | 1,603 | 1,642 | 605 | 331 |
| Slow desktop, 3 s session fixture | 4,757 | 4,440 | 616 | 431 |
| Mobile, 3 s session fixture | 4,569 | 4,408 | 617 | 336 |
| Reduced motion | 2,511 | 2,069 | 13 | 184 |
| Failed session / real retry screen | 1,761 | 1,379 | 617 | 260 |
| Repeat visit | 2,258 | 2,331 | 138 | 139 |
| Mobile, 4× CPU | Not measured | 14,868 | Not measured | 912 |

No five-second wait is imposed; actual application startup and network/session delay dominate the overall wait. Scheduling/rendering noise is visible, including the reduced-motion DOM-removal result; do not infer a universal speedup from this table. Existing page hydration/rendering long tasks remain, especially under 4× CPU throttling (10.54 s total observed long-task duration across startup in that sample). The loader does not make a blocked browser main thread smooth, and no universal 60 fps or physical-device performance claim is made. The normal fade's programmed duration is 160 ms after the final 90 ms fill; actual DOM unmount can take longer. The current production preview is [localhost:3017](http://127.0.0.1:3017/).

## Validation and limitations

- Production webpack build and its TypeScript phase pass. Standalone `tsc --noEmit` also passed during implementation.
- No-cost isolated unit suite after the recording review: **1,238 pass, 0 fail, 16 skipped, 115 files**. All five live-provider flags were explicitly disabled. [Results](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/unit-results.json). Focused mapping/markup/no-scale/readiness-weight suite: **6 pass, 125 assertions**.
- Six real-browser launch tests pass: liquid/readiness/full-black geometry, mobile reduced motion, repeat visit, hidden-event pause and cleanup, delayed session, delayed signed-in profile. Five startup source-invariant tests pass after correcting an outdated literal assertion to recognize the existing `startupReady && active !== "live-tutor"` LAM guard; no application guard was weakened.
- Seven production browser recording scenarios pass: fast, slow, mobile, reduced, failed, repeat and 4× CPU mobile. No uncaught page errors, horizontal overflow, duplicate launch overlays or ready-state pointer interception.
- Focused lint passes. Whole-tree lint excluding the already-paused, untracked cinematic video file passes. Unqualified whole-tree lint still has its pre-existing `react-hooks/refs` error at `src/components/landing/cinematic-video.tsx:120`. That unrelated file and lint configuration were not changed.
- Browser fixtures exercise real components/controller and prepared UI, but do not certify real login/logout, private data, payments or live AI. No database/provider calls were needed. Safari, iOS, physical Android WebView, real-device battery use and native screen-reader behavior were not tested.
- The reference's outer composition and zoom were deliberately removed following the latest user instructions. Exact font identity and physical-fluid simulation are not claimed. Normal main-thread scheduling can lengthen the short cosmetic exit, particularly during existing app startup work. Earlier draft captures containing zoom are not the final evidence linked above.

## Files changed for this task

Product:

- `src/components/launch-splash.tsx`: Scholar clip-path markup, real status and animation lifecycle; removed original planetary presentation and subsequently removed the outer artwork.
- `src/components/launch-splash.css`: responsive full-bleed pure black and wordmark/status layout; reduced/repeat states.
- `src/lib/animation/launch-wordmark.ts` (new): connected wave, truthful fill mapping, bounded Anime entrance/completion/fade/cleanup.
- `src/components/launch-readiness-gate.tsx`: retain mandatory guards, remove arbitrary minimum, single splash, ready-triggered exit and fallback removal/recovery.
- `src/app/page.tsx`: passive same-pose dynamic-import fallback.

Verification:

- `tests/launch-wordmark.test.tsx` (new), `tests/launch-splash.spec.ts`, `tests/startup-readiness.spec.ts`.
- `scripts/wordmark-loader-browser.mjs` and `scripts/wordmark-loader-milestones.mjs` (new).
- This report and generated artifacts under `test-artifacts/wordmark-loader/`.

The previously completed Liquid Velocity work and unrelated dirty/untracked files were preserved during the initial local implementation. No account setup, environment/secret change, direct database operation or paid AI call was needed.

## Recording review and release preflight

The user's downloaded `desktop-loader.mp4` exactly matched the delivered recording (SHA-256 `4C082E0DAB19A022C1AFD7F7B474B98E469BC97EC287ACE66A207333D0ACA7B9`). Inspected the complete sequence and the final transition frame-by-frame. Found and addressed:

1. **Near-complete plateau:** asset-task progress finished before auth/profile, leaving the liquid close to white for most of the wait. Visual weighting now reserves headroom for those real boundaries: tasks contribute 70%, shell/session 18%, and applicable profile completion 4%. These are unannounced presentation weights, not invented exact backend percentages; readiness guards remain unchanged.
2. **Abrupt exit under main-thread work:** completion now starts in a layout effect, and Anime's [WAAPI opacity path](https://animejs.com/documentation/web-animation-api/) keeps the fade off the JS frame loop. Optional LAM/presence startup is released after the overlay unmounts, so it does not compete with the fade.
3. **Text stability/readability:** a local heavy typeface avoids a downloaded-font swap; status uses a separate readable face, at least 11 px, with more separation from the wordmark.
4. **Second intro after loading:** the existing hero had delayed blur/text/CTA entrances lasting up to 1.9 seconds. The existing launch-seen flag now settles only those entry poses behind the loader. Hero design/content, controls, hover effects, background media and authentication are unchanged.

Updated review recordings: [desktop](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/review/desktop-loader.mp4), [mobile](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/review/mobile-loader.mp4). [Review measurements](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/wordmark-loader/review/results.json). The earlier `after/` timings above describe the pre-review implementation; they are retained as a comparison, not relabeled as the reviewed result. Native opacity is paused/seeked only for deterministic still captures; normal recordings use its real clock. Reduced motion may remove the overlay synchronously before a MutationObserver sees a distinct ready state; in that case no separate readiness timestamp is invented.

The user authorized publication of completed updates, including Liquid Velocity. Target verified through the authenticated Vercel project: `scholar-v1`, production `main`, public alias `scholarofficial.vercel.app`. Existing candidate isolation and deployment preflight remain intact. No migration/schema changes are part of this release. Paused cinematic-video source, its production plan, local recordings, unrelated scratch directories and APKs are intentionally excluded from the release commit. The actual commit/deployment outcome is reported in the chat after verification, not asserted in advance here.
