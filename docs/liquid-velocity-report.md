# Liquid Velocity — local implementation and verification

Date: 2 November 2026. Working tree: `C:\Users\Lenovo\Desktop\SCHOLAR\Scholar-V1`.
Branch `sepb-rc`; starting and ending HEAD `5988c52`. No publication performed.

## A. Executive summary

Implemented the shared frontend refinement in the actual application, not a separate concept page:

- Persistent Anime.js glass selection lenses in the desktop navigation, mobile dock and shared Radix tabs.
- Short tactile press/release feedback for shared buttons; scoped menu/dialog entry and route transitions.
- A five-primitive, signed-edge live-backdrop renderer. Fixed a real zero-size-SVG viewport bug found by pixel comparison.
- Enforced visible-surface optical budgets; offscreen surfaces no longer incur pointer geometry reads.
- High/balanced/lightweight rendering policies, application/system preference synchronization, bounded measured degradation and explicit iOS/Safari/Firefox fallback.
- Short dashboard reveals replacing delays up to 2.6 seconds; explicit Quick startup no longer waits for the first-launch branding minimum.
- Correct initial sidebar width reservation and stable, explicitly dismissible Guest notice, reducing unsolicited layout shifts.
- Cheaper chrome, non-blurred inputs, no large idle ambient glass animation; page background media respects quality, reduced data and explicit wallpaper precedence.

This is a working shared-system pass, not a claim that every legacy feature-specific animation has been rewritten or every authenticated workflow certified. The promotional LAM video remains paused and untouched.

## B. Anime.js integration

Verified installed version **4.5.0**. Executed the requested npm installation safely pinned to the existing version:

```powershell
npm i animejs@4.5.0 --package-lock=false --ignore-scripts --save-exact --no-audit --no-fund --prefer-offline
bun install --frozen-lockfile
```

npm reified local dependencies; Bun then reconciled them against the canonical `bun.lock` and generated the local Prisma client. Neither package manifest nor lockfile changed; no root npm lockfile was introduced. Prisma generation was not a migration or database operation.

Studied the official [React/scope lifecycle](https://animejs.com/documentation/getting-started/using-with-react/), [timelines](https://animejs.com/documentation/timeline/), [scopes](https://animejs.com/documentation/scope/), [scroll observers](https://animejs.com/documentation/events/onscroll), [layout](https://animejs.com/documentation/layout/), [draggable](https://animejs.com/documentation/draggable/) and [WAAPI](https://animejs.com/documentation/web-animation-api) documentation.

Implemented `animate`, `createScope`, `createTimeline`, `stagger` and `waapi.animate`. Did not add draggable navigation: normal tap, scroll, keyboard and cancellation semantics are more appropriate. Did not wrap the entire application in layout measurement or attach scroll observers to every card.

Primary implementation: [velocity-motion.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/velocity-motion.tsx), with policy/timing in [velocity-policy.ts](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/lib/animation/velocity-policy.ts).

Ownership is explicit: Anime owns the new lens geometry, route wrapper, dashboard reveal elements, and individual control scale. Existing feature-specific Framer Motion remains in place. The old Framer shared-layout navigation pill was removed. A portal's positional transform remains separate from its entry scale. Timelines/scopes revert on unmount; interrupted lenses cancel before replacement; visibility/preference changes stop new motion; route boundaries clear pending press effects. `will-change` is temporary. Pointer movement never enters React state.

## C. Liquid Glass architecture and research

All historical foundation components were inspected. Tier 1 remains selective; Tier 2 is the normal material for repeated panels; Tier 3 preserves readable functionality without optical effects.

Research (README, relevant source and actual LICENSE files checked):

| Reference | Technique, useful lesson, decision |
|---|---|
| [Sohum Suthar](https://github.com/sohumsuthar/liquid-glass) | Physical bezel/ray-traced displacement, layered lighting, restrained multi-channel optics. MIT. Physical per-element maps are attractive, but per-element texture generation and three displacement passes were not adopted product-wide. |
| [dpawlikowski](https://github.com/dpawlikowski/liquid-glass) | CSS/SVG layering; explicit distinction between replicated scene images and live backdrop filtering. MIT. Adopted the architectural distinction, not library code or scene copies. |
| [kwlck](https://github.com/kwlck/liquid-glass-web) | SVG live-backdrop enhancement, native controls and teardown. MIT. Conservative engine gating is useful; syntax support alone is not rendering proof. Its separately licensed photographs were not used. |
| [liquidglass.dev](https://liquidglass.dev/docs/) | Native control/dock behavior, signed lens maps, image-aligned cross-browser replication versus arbitrary-DOM fallback. MIT source; demo wallpapers excluded. Did not clone page/private content or add a full-application WebGL overlay. |

No code/assets were copied from these four references. Historical Max Rovensky attribution is retained; current research/provenance is recorded in [ATTRIBUTION.md](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/ATTRIBUTION.md). These documentation links are not public website links to the user's repository/account.

### Actual optical path

Three shared SVG filter definitions, five primitives each: two cached SVG channel fields → combine → signed displacement → restrained light transfer. Opposite edges bend oppositely; the middle is neutral. The optical layer samples the **live backdrop** through `backdrop-filter: url(...)`; content/text remains a separate unfiltered sibling. Colour edging is a cheap CSS rim, not three full-frame chromatic passes.

An initial optical comparison failed: the shared zero-size SVG made percentage-sized `feImage` inputs resolve incorrectly, displacing the centre. The isolated probe established the cause. Explicit `primitiveUnits="objectBoundingBox"` and unit-sized fields fixed it. A markup regression assertion and actual pixel comparison now cover the fix.

This is an economical edge-lens approximation, **not** a physically complete Snell-law ray tracer. Bezel thickness scales with the element. Wide/large surfaces are excluded, so those compromises remain bounded.

### Runtime budgets and fallback

- High: at most 6 visible optical surfaces.
- Balanced: at most 2; coarse/touch: at most 1 compact optical surface.
- Lightweight/fallback: 0.
- Maximum optical area 180,000 CSS pixels; maximum width 640 CSS pixels.
- One shared pointer listener/RAF, intersection observer and size observer. Reads precede writes. Hidden/offscreen work stops; the pointer RAF is event-driven, not an idle loop.
- All iOS browsers, desktop Safari, Firefox and unknown engines fail closed to non-refractive material. Chromium is the verified live-backdrop path. No unsupported-browser refraction claim.
- Reduced motion, glass-off, contrast and battery/performance preferences are honored. Hardware hints are advisory, not the sole quality decision.
- An interaction can start a bounded 90-frame sample. Two slow windows (>22% frames over 34 ms), separated by a five-second cooldown, are needed for a downward quality step. No automatic oscillation/upgrading in the same mount, no telemetry and no idle sampling.

## D. Route coverage matrix

Every row below was opened in the real local production browser before/after, except the explicitly identified interaction-only LAM panel. The route sweep used actual Guest entry and blocked API requests; error/gate states are not passed off as authenticated functionality. Every route inherits the updated shell, shared controls and material policy.

| Route/area | Before → implemented change | Observed coverage and remaining boundary |
|---|---|---|
| Public homepage `/` | Existing hero/form/showcases preserved; shared runtime/media policy improved | Desktop before/after screenshots; no new promotional video. |
| Dashboard `/dashboard` | 1.6–2.6 s delayed details → bounded reveal; stable initial sidebar/banner | Desktop plus all ten requested layout sizes; actual touch context separately. |
| Desktop sidebar | Per-item Framer pill → single Anime optical lens | Rapid selection, collapse/reopen, settled geometry and visible screenshots passed. |
| Mobile dock | Independent active fill → moving selection lens, tactile feedback | Native taps, rapid changes, cancellation, More drawer and landscape passed. Starts collapsed; stays open when user navigates from the dock. |
| Study `/study` | Existing curriculum preserved; new shell/page transition | 75-chapter overview rendered; teaching/provider requests not exercised. |
| Exam Ready `/exam-prep` | Existing preparation/library preserved; shared shell and controls updated | Guest preparations landing rendered. Complete live-AI journey not rerun; no provider budget was used. |
| Chapter Command `/chapter-command` | Existing chapter content preserved; shared navigation/material changes | Actual subject/chapter workspace rendered. No live teaching call. |
| Notes `/notes` | Existing editor retained; shared dropdown entry/controls updated | Created and edited a disposable Guest note, opened/dismissed Actions menu; no account note or AI summarization touched. |
| E-Book `/ebook` | Reader/mapper preserved; shell/input/media policy updated | Physics reader/mapper landing rendered. No private upload or authenticated PDF/OCR certification. |
| Practice `/practice` | Existing question bank preserved; shared transition/controls | 323-question practice interface rendered; no generated question request. |
| Mock `/mock-exam` | Existing generation/settings preserved; shared transition/controls | Mock centre rendered; no API paper generation or full timed examination run. |
| Planner `/planner` | Task UI preserved; shared controls/material | Planner rendered; no server AI schedule request. |
| Flashcards `/flashcards` | Existing deck preserved; shared tabs/lens material | 120-card interface rendered; no content mutation in account storage. |
| Settings `/settings` | Shared tab lens and control policy | Click/arrow-key tabs, light material, 125% root text and quality/reduced-motion branches passed. |
| Files `/files` | Private gate unchanged | Guest sign-in gate asserted. No private files fetched. |
| LAM AI `/live-tutor` | Private gate unchanged | Guest restriction preserved. Separate general LAM onboarding/panel opened and closed; no message or microphone operation. |
| Study Music `/music` | Shutdown card unchanged | Copyright pause state rendered. No music playback enabled. |
| LAMTube `/nigtube` | Shutdown card unchanged | Copyright pause state rendered. No video-generation work resumed. |
| Group Study | No feature logic edited | Existing policy/sync/security unit coverage passed; no authenticated multi-user room certification. |

Route timing in the sweep includes an intentional 600 ms inspection pause and full document navigation. It is **not** a route-transition latency score. All swept routes had no body horizontal overflow or uncaught page errors.

## E. Performance benchmark

Conditions: Windows, Chrome **156.0.8078.76**, headless Playwright, actual local `next start` production builds; Quick startup selected, real disposable Guest entry, all `/api/**` requests deliberately aborted. No fake API success responses. Public/Guest desktop samples at 1440×900. Warm means a same-context repeat navigation. Throttled reload at 1920×1080: 4× CPU, 150 ms latency, 200,000 B/s down, 90,000 B/s up. Local resources and remote media caches can affect results.

These are **one before/after pair**, not statistical field measurements or Lighthouse scores. LCP/CLS come from browser observers. Event maximum is a diagnostic, **not standardized INP**. Frame p95 comes from a bounded 90-frame sample, not an all-session FPS guarantee.

| Measurement | Before | After |
|---|---:|---:|
| Public cold LCP | 2,324 ms | 1,744 ms |
| Guest entry LCP | 3,264 ms | 2,344 ms |
| Guest entry CLS | 1.0033 | 0.0152 |
| Guest entry long-task total | 414 ms | 373 ms |
| Guest entry event maximum | 1,624 ms | 960 ms |
| Guest entry frame p95 | 83.4 ms | 50.0 ms |
| Warm dashboard LCP | 1,264 ms | 796 ms |
| Warm dashboard CLS | 0.1766 | 0.0024 |
| Warm dashboard long-task total | 275 ms | 105 ms |
| Warm frame p95 | 16.8 ms | 16.8 ms |
| Warm event maximum | 136 ms | 176 ms |
| Warm JS heap sample | 18.26 MB | 18.52 MB |
| Throttled LCP | 8,844 ms | 2,712 ms |
| Throttled CLS | 0.7835 | 0.0103 |
| Throttled long-task total | 5,526 ms | 2,832 ms |
| Throttled frame p95 | 166.7 ms | 33.3 ms |

**Regressions/limits are not hidden:** warm event maximum increased 40 ms and sampled heap about 0.26 MB. Public cold long-task count increased 5→6 (total time decreased 709→676 ms); frames over 34 ms increased 8→10 in its sample. Guest first-entry events remain well above 200 ms; throttled LCP remains above 2.5 s. No universal zero-lag/60-FPS or INP target claim.

Mobile touch/layout verification is separate from those desktop timing samples. A comparable touch-device **before timing baseline was not captured**, so no mobile speedup percentage is claimed. No production RUM or bundle-byte reduction claim.

Raw evidence: [before metrics](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/before/metrics.json), [after metrics](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/after/metrics.json).

## F. Mobile optimization

Preserved safe-area insets, the existing visual-viewport keyboard mechanism, native back integration and navigation destinations. Dock buttons remain native controls with no drag-to-navigate, pointer capture, scroll prevention or hover dependency. Optical touch response is limited to tiny material offsets. Cancel/up/leave/blur/visibility reset the offsets and press state.

Layout sweep passed at 320×700, 360×800, 390×844, 430×932, 768×1024, 844×390, 1024×768, 1366×768, 1440×900 and 1920×1080. Separate touch emulation exercised 390×844 and 844×390. Shared coarse-pointer controls retain at least 44 px heights. Keyboard-hidden-dock CSS was tested by applying its real state flag; **headless emulation cannot certify a physical software keyboard**. The 125% test is root-text enlargement, not a claim of native browser-zoom or screen-reader certification.

Inspected the current Expo/React Native wrapper and its embedded web screen. Its Android BackHandler, overlay/native message bridge, navigation allowlist and file/media paths were not changed. No APK was built. Real Android WebView, iPhone/Safari and physical-device input/battery tests remain unverified.

## G. Visual and motion evidence

Actual application screenshots, not generated artwork:

- [Before desktop](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/before/dashboard.png) → [after desktop](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/after/dashboard.png).
- [Settled sidebar](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/desktop-lens-settled.png), [mobile dock](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/mobile-dock.png), [pressed mobile control](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/mobile-pressed.png), [landscape](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/mobile-landscape.png).
- [Dialog](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/dialog.png), [real Notes dropdown](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/notes-menu.png), [Notes editor](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/notes-editor.png), [LAM panel](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/lam-panel.png), [light/large text](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/light-large-text.png), [opaque fallback](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/opaque-fallback.png).
- Remaining route and viewport images are in [before](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/before) and [after](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/after).

Optical proof: compare [filter off](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/optics-off.png) with [filter on](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/optics-on.png). Both use the same live striped background, same clipping and real shared filter. Blur was removed from this isolated comparison to avoid confusing blur with displacement. Mean RGB difference at the sampled edges: **45.00**; centre: **3.01**, on a 0–255 scale. The centre is largely stable while the rim bends actual background lines.

Real runtime recordings: [desktop](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/desktop-runtime.webm) and [mobile](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/mobile-runtime.webm). These are QA screen recordings, **not** the paused cinematic LAM marketing video. Entry-state screenshots can show intermediate opacity; recordings show settling.

## H. Testing and honest failures

- Production build and its TypeScript phase passed; 70 static pages generated. Standalone `tsc --noEmit` also passed during implementation.
- Final isolated no-cost suite: **1,232 pass, 0 fail, 16 skipped** across 114 files; all live-provider flags explicitly set to zero. Focused glass tests: **5 pass, 0 fail, 36 assertions**, including the final iOS gate regression. [Unit results](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/unit-results.json).
- Full lint excluding the pre-existing paused/untracked video file passed. Unqualified `bun run lint` still fails on its existing `react-hooks/refs` violation at line 120. That file was intentionally not edited or hidden by changing lint configuration.
- [Browser interaction results](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity/interactions/results.json): sidebar geometry and rapid navigation, collapse/reopen, command dialog/Escape, Notes edit/dropdown, keyboard tabs, private Guest gate, LAM onboarding/panel, reduced motion, glass-off/lightweight policy, light/root-text layout, optical pixel proof, touch cancellation and More drawer all passed; no uncaught page errors.
- Responsive sweep: 10/10 sizes, no body horizontal overflow.
- Lifecycle unit tests assert coalescing, reads-before-writes, zero offscreen reads, enforced budgets, hidden cleanup and full unregistration.

Iteration failures were useful and not accepted as success: a hidden tab-list locator was replaced with a visible control locator; the optical proof caught and fixed incorrect shared-map sizing; mobile testing exposed the old auto-close handler and it was corrected; LAM verification was updated to complete its actual onboarding before expecting the composer. No paid AI call was used to get a green result.

No real account creation/login/logout, payment, private PDF, multi-user Group Study or online provider round trip was performed. Those boundaries remain protected, not bypassed; security/auth regression tests are no-cost fixtures/source invariants, not live certification.

## I. Changed files

Modified:

- [layout.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/app/layout.tsx): shared stylesheet import.
- [app-shell.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/app-shell.tsx): persistent navigation lenses, dock integration, route wrapper, stable initial sidebar/Guest notice and skeleton space.
- [launch-readiness-gate.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/launch-readiness-gate.tsx): Quick/reduced-motion readiness minimum.
- [glass-filter.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/glass-filter.tsx): original bounded optical renderer.
- [glass-runtime.ts](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/glass-runtime.ts): visibility, geometry and optical budget.
- [glass-tokens.ts](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/glass-tokens.ts): declared tier limits.
- [liquid-glass-provider.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/liquid-glass-provider.tsx): preferences, quality, measured degradation, conservative browser gates.
- [scholar-glass.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/scholar-glass.tsx): register optical-only surfaces as well as pointer controls.
- [ATTRIBUTION.md](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/ATTRIBUTION.md): research/provenance.
- [ready-background-video.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/ready-background-video.tsx): quality/data/motion/wallpaper gates.
- [dialog.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/ui/dialog.tsx), [dropdown-menu.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/ui/dropdown-menu.tsx), [tabs.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/ui/tabs.tsx): reusable motion preserving native/Radix focus and refs.
- [dashboard.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/views/dashboard.tsx): remove delayed reveal sequence.
- [performance-glass.test.ts](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/tests/performance-glass.test.ts): visibility-aware runtime fixture.

Added:

- [velocity-motion.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/velocity-motion.tsx).
- [mobile-liquid-dock.tsx](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/mobile-liquid-dock.tsx).
- [liquid-velocity.css](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/liquid-velocity.css).
- [velocity-policy.ts](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/lib/animation/velocity-policy.ts).
- [liquid-velocity.test.ts](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/tests/liquid-velocity.test.ts).
- [production browser harness](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/scripts/liquid-velocity-browser.mjs), [interaction harness](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/scripts/liquid-velocity-interactions.mjs), [isolated optics diagnostic](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/scripts/liquid-velocity-optics.mjs), this report and generated QA artifacts.

No dependency/lockfile diff. Pre-existing untracked screenshots, Android APK, `NEW PROJECT`, and paused cinematic-video files were preserved.

## J. Remaining limitations

This is not full cross-browser, hardware, authenticated-product or field-performance certification. Physical iOS/Safari/Firefox/Android WebView tests, actual keyboard/browser-zoom tests, authenticated private features and additional repeated timing trials are outstanding. Some feature-specific native buttons, legacy CSS recipes and Framer animations intentionally remain; the shared system does not pretend every individual control has been rewritten. Initial public/Guest long tasks remain measurable. The throttled LCP and first-entry event targets are not universally met. No complete live academic teaching or private-data workflow was retested.

The intentionally paused cinematic video still prevents an unqualified whole-tree lint success. No production deployment should be inferred from local build success.

## K. Safety confirmation

**No commit, push, deployment, domain change, production environment modification, migration, production/staging database mutation, account setup, APK generation or billable AI request occurred.** Existing configured credentials were not printed, moved or changed. Browser QA blocked APIs rather than accessing private data. Generated notes/preferences were confined to disposable browser contexts. Package installation only reconciled local dependencies/generated client files. All product changes remain local.
