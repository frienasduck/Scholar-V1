# Mobile dock: direct swipe-following glass

3 November 2026. Implemented in Scholar's actual mobile bottom menu. The dock remains anchored; its glass selection lens follows the finger across the five destinations and selects the destination on release. This supersedes the earlier tap-only/tiny-offset dock policy at the user's request.

## Implementation

- `src/components/liquid-glass/mobile-liquid-dock.tsx`: native accessible buttons, stable gesture/lens refs, local compact SVG definition.
- `src/components/liquid-glass/use-dock-swipe.ts`: horizontal intent threshold, pointer capture only after intent, at-most-one RAF for direct DOM writes, release commit, preview, bounded stretch/lift, cancellation, click deduplication and cleanup. No React state per pointer frame. More opens the existing sheet. Keyboard/tap semantics retained.
- `src/lib/animation/dock-swipe.ts`: deterministic geometry/intent/bounds. Vertical pan and pinch remain browser-owned through `touch-action: pan-y pinch-zoom` ([Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action)).
- `src/components/liquid-glass/velocity-motion.tsx`: the existing lens geometry owner now accepts direct manipulation and settles using the existing Anime transition. No competing CSS translate engine.
- `src/components/liquid-glass/glass-filter.tsx`: original three presets preserved; one static dock-only definition with a wider 18% signed rim and 0.14 object-relative displacement. Initial narrow shared rim was barely visible at phone size. This compact definition exists only while the dock is mounted; it adds no optical surface or scene copy.
- `src/components/liquid-glass/liquid-velocity.css`: drag highlight, stretch and dock-only refraction. Existing engine, visibility, user-preference and optical-budget gates remain authoritative: at most one compact touch lens. No academic text filtering.

## Verified

Local production build / TypeScript passed. Final isolated suite: **1254 passed, 0 failed, 16 live-service skips**, 117 files. Scoped lint passed. Actual full lint still reports the preserved, untracked paused cinematic component's existing react-hooks/refs error; no ignore or unrelated fix added.

Chrome 156 real CDP touch: continuous intermediate finger following (maximum sampled center error under 2 CSS px), no navigation until release, one navigation on release, actual touch cancellation, vertical intent, blur, outside release, subsequent tap, reduced-motion direct tracking, More, keyboard and landscape passed without uncaught page errors. Reduced motion removes stretch/overshoot and animated settling, not user-directed selection.

Actual mounted dragging lens with a temporary live striped backdrop: refraction off/on edge mean RGB difference **98.72**, neutral-center **1.62**. Restored normal appearance after proof. This is genuine bounded backdrop displacement in supported Chromium, not a full physical ray-tracer. WebKit 26.5 native mouse-pointer drag and coherent glass-off/non-refractive fallback passed. **No physical iPhone, Safari, Android WebView or universal 60-FPS certification.** iPhone/Safari fallback is not represented as native Apple's system refraction.

Evidence root: `C:\Users\Lenovo\Desktop\SCHOLAR\Scholar-V1\test-artifacts\dock-swipe`. Files: `results.json`, `compatibility.json`, `drag-optic-off.png`, `drag-optic-on.png`, `dock-following.png`, `dock-settled.png`, `mobile-swipe.mp4`, full `touch-runtime.webm`, `build-final.log`, `unit-results-final.json`, `scoped-lint-final.log`, `lint.log`. Earlier failed harness attempts remain archived: development font compilation timeout, a fixed evaluate-scope bug, and the initial too-subtle optical proof. They are not counted as passed checks. API calls were blocked in local UI QA; no live AI, private content or real account tests.

Safety copies: `C:\Users\Lenovo\Desktop\SCHOLAR\.rollback-backups\2026-11-03-dock-swipe`. Loader, auth/Plus, providers, saved work, schema/migrations, deployment settings, original optical budgets and unrelated files are unchanged. Publication is separately authorized by the user's subsequent DEPLOY instruction; release status must be checked against the actual resulting commit/deployment rather than inferred from this implementation note.
