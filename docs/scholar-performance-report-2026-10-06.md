# Scholar pre-SEPB performance engineering — 6 October 2026

Local implementation and production-mode verification, completed before the user's subsequent request to publish the accumulated changes. Historical no-commit/push/deployment notes below describe the verification stage. No production migration, new credential configuration or dependency installation was performed. Existing unrelated work was preserved; temporary QA artifacts remain local and can be regenerated using the supplied scripts.

## 1. Executive summary

Reduced avoidable shell work without redesigning Scholar: cropped avatar assets, narrow presence subscriptions, intent-aware prefetch, split assistant/export/player code, shared display ticks, batched glass geometry, coalesced session/flag requests and explicit canvas cleanup. Visible teaching retains the original synchronous Markdown/MathML renderer. No colors, spacing, fonts, backgrounds, glass material, motion timing or navigation labels were rewritten.

This is a measured engineering pass, not a guarantee of zero lag on every device. Authenticated local flows and physical Android performance remain uncertified; see sections 49–50.

## 2. Performance baseline

Captured the existing compiled Next 16 application on localhost:3002, in an isolated Guest workspace, before application edits. Desktop was 1440×900; mobile gallery was 390×844. Source/build inventory is `test-artifacts/perf-audit-before.json`; browser samples are `perf-baseline.json`; original screenshots use `perf-before-*.png`.

Dashboard settled script bodies totaled **2,476,869 bytes**. The initial sample observed FCP 768 ms, LCP 1,668 ms, TTFB 36.4 ms, six long tasks (71/149/50/61/99/57 ms), and buffered CLS 0.871. These are single local lab samples, with warm-cache/service-worker effects and animated startup; they are not field Web Vitals or a statistically controlled CDN benchmark.

The avatar gallery used cropped windows over optimized **whole 1448×1086 sheets**. Browser density-adjusted natural dimensions were 204×153 for the header, 566×424 for a 100px gallery card and 815×611 for the preview. Direct public optimizer responses confirm the actual bitmap sizes in section 47. A deterministic music-store probe published **120 notifications for 120 identical duration values**.

## 3. Primary bottlenecks discovered

Unneeded math/export imports, globally bundled gated music implementation, broad gallery/presence invalidation, whole-sheet avatar decoding, Full-mode idle route prefetch on Quick repeat visits, automatic footer prefetch, duplicate telemetry, whole-body modal rescans, overlapping session/flag queries, and failed flag-query/log storms. A lazy-render SSR regression was caught and corrected rather than accepted.

## 4. Global architecture improvements

The shell remains persistent. Only heavy conditional implementations were split; the existing navigation map, media ownership, subscription enforcement and feature boundaries remain intact. The small header music button is independent of the full player implementation.

## 5. React rerender improvements

LAM activity hooks subscribe to their effective state string. Avatars subscribe to flat visual values rather than unrelated owners/context. The gallery parent subscribes only to session mute. Equal media telemetry is no longer published. These are tested invalidation reductions, not fabricated React Profiler commit counts.

## 6. Context/store improvements

No new application-wide feature store or context was introduced. Zustand shallow selection is reused for avatar presentation. Media store validation, account-scoped data, deadlines, queue semantics and actual changing telemetry are preserved.

## 7. Timer improvements

Exam Ready header/review and Music display clocks share a single visibility-aware scheduler: one interval/listener regardless of display count, none while hidden, and full cleanup after the final subscriber leaves. Time is derived from timestamps. Music's business deadline/completion loop runs only while needed, including restored unrecorded completion/break states; it does not halt native audio.

## 8. Listener cleanup

Clock listeners are reference-counted and cleaned up. Glass hiding cancels a queued frame. Subscription unmount aborts pending requests. Existing passive nested-scroll and cursor listeners remain. Static source counts are inventory counts, not simultaneous runtime listeners.

## 9. RAF improvements

Glass geometry reads finish before any CSS-property writes. Ten pointer events before a frame coalesce into one frame in the regression fixture. Existing cursor refs, player throttling, idle-stopping loops and LAMTube hidden-document cancellation remain unchanged.

## 10. Observer improvements

Music's MutationObserver exists only for an active visible YouTube source and ignores unrelated chat/progress/thumbnail changes. Dialog insertion, removal and attribute changes still pause/detach the covered source. The shared LAM IntersectionObserver is retained. No new perpetual DOM observer was added.

## 11. LAM optimization

All 22 identities, profiles, priorities, reactions, peeks, sleep/wake and LAMTube story behavior remain. Lossless source crops plus display-sized Next Image variants avoid decoding reference sheets for small art. Scroll-driven owner recomputation is bounded to 200 ms while the exact last-interaction timestamp is retained; direct input is immediate. Peek eligibility is checked before dialog/focus queries or margin hit tests.

## 12. Liquid Glass optimization

Material and CSS are unchanged. Read/write batching removes the geometry-thrashing pattern, and visibility cancellation avoids a queued decorative frame after hiding. All 339 backdrop-filter declarations found by the inventory remain. No blur, shadow, gradient or transition was flattened or removed.

## 13. Background optimization

Existing poster-to-video readiness, async loading, visibility/reduced-motion handling and route cleanup were inspected and retained. No remote background was substituted, downloaded or transcoded. Local bandwidth/decode availability of external backgrounds is not a production guarantee.

## 14. Image optimization

Added 22 full-resolution lossless WebP crops, reproducibly generated by `scripts/generate-lam-derivatives.ts`, with source hashes/crop coordinates in their manifest. Tests compare decoded RGBA pixels against every original crop. Original reference files stay unchanged. Small image variants use display width, avoiding the 640px minimum of a fixed `sizes` declaration.

## 15. Thumbnail optimization

LAM cards benefit from cropped/resized assets. Existing lazy LAMTube thumbnails, source allowlists, fallbacks and Music artwork remain. No cosmetic thumbnail replacement or unrelated image compression was performed.

## 16. Media/player optimization

The real player remains one shell-owned instance across navigation. The full implementation loads only after valid music entitlement. Player obstruction checks, minimum visible YouTube surface, native background audio, source attribution, queue and persisted playback rules remain. Duplicate duration/play/buffering/time values no longer publish store updates.

## 17. Bundle changes

See section 47 for final observed script-body totals. Heavy modules were retained in route/interaction chunks, not deleted. Gzip sizes in the audit JSON are compression estimates of build files, not actual Vercel transfer sizes.

## 18. Code splitting

Split the shell's response renderer, Dashboard exporter and gated Music implementation. Existing PDF.js, Canvas, Group Study and AI Video feature splits were inspected. PDF.js remains absent from the normal Dashboard interaction, and source renderer functionality is retained.

## 19. Dynamic imports

The assistant preloads its identical renderer when opened. Dashboard opens the print window during the user gesture before awaiting the exporter, preserving popup policy on touch/WebView. Academic pages retain synchronous content imports; the static-render regression is fixed and tested. No placeholder redesign was introduced.

## 20. Prefetching

Quick repeat visits no longer quietly schedule four Full-mode routes. Optional work respects mode, current/warmed routes, Data Saver, slow connections and hidden-document state. Desktop Long/Full idle budgets are 2/4; mobile is at most 1. Long's heavy-module initialization prepares the active feature rather than unrelated books, quiz and mock code; explicit Full retains all nine original module targets. Footer Link markup/navigation is unchanged, but prefetch is based on mouse hover or keyboard focus.

## 21. Server/client boundary changes

No large page tree was converted to a client tree. IntentLink is a small client navigation leaf; the footer's static visual markup stays intact. The synchronous public AI rendering/export contracts remain. No private content was moved into a public cache.

## 22. Hydration improvements

Shared clock server snapshots are deterministic, with the existing session fallback timestamps. No new random SSR visual state was introduced. Browser checks include absence of hydration/console errors. Initial startup/animated CLS is not claimed solved by these changes.

## 23. Dashboard improvements

Removed unused shared UI imports that dragged the academic renderer into the entry graph. PDF export loads on demand, with the gesture-opened window retained. Dashboard cards, Scholar Today, challenge rewards, mastery, graphs, fonts and backdrop are unchanged.

## 24. Ask LAM improvements

The closed shell does not eagerly import the parser through its response component. Opening prewarms it before a normal AI answer arrives. Existing 64 ms streaming batching and memoized response/academic rendering remain. Full-history localStorage persistence during streaming was inspected, not speculatively rewritten.

## 25. LAM AI improvements

Uses optimized shared avatars and narrowed activity subscriptions. Live provider selection, memories, voice, streaming and personality behavior were not modified. Guest gate was checked; authenticated streaming throughput was not exercised locally.

## 26. Chapter Command Centre improvements

Uses the optimized shared presence/art runtime; its resource/practice links and teaching flow remain. Existing mission selectors, source shelves and curriculum mapping were inspected. Browser chapter selection/Ask LAM interaction is included in the acceptance pass.

## 27. Exam Ready improvements

Header and final-review presentation share a display clock instead of separate intervals. Lesson content stays synchronous, prose stays prose, explicit equations retain KaTeX/MathML, and owned feedback still settles beneath teaching priority. Mission order, readiness evidence, progression, saved notes and business clocks are unchanged.

## 28. LAMTube improvements

The companion benefits from cropped art and narrow presentation subscriptions. Existing thumbnail-only cards, single active embed, AI Video dynamic workspace, 200 ms UI telemetry and 10-second watch checkpointing were retained. Generation leases/polling/quota logic was not altered.

## 29. Study Music improvements

Conditional player chunk, lightweight unchanged header access, idempotent telemetry, non-starving library-save debounce, conditional focus completion loop, shared display clock and targeted dialog observation. YouTube remains visibly compliant; native/licensed audio remains audio-only where intended. No first-play/minimize workaround or hidden embed was introduced.

## 30. E-Book/PDF improvements

Uploaded readers retain PDF.js worker loading, bounded visible-page canvases, canceled renders, debounced/abortable search, actual OCR context and document destruction. Canvas backing stores are explicitly reset to zero during render cleanup. No OCR, storage, permissions or reader layout was rewritten. The pre-existing private-upload fixture failures remain separate.

## 31. AI Tools/Canvas improvements

Retained route/workspace-level loading and cleanup; removed no tool or editor. Source audit covers listener cleanup and object URLs. No speculative virtualization, worker framework or editor replacement was added.

## 32. Mobile-specific improvements

Display-sized avatar downloads, no inactive player implementation, cheaper peek eligibility and lower optional prefetch bandwidth. Existing layouts, touch controls, accessibility and reduced-motion preferences are preserved. Mobile is not forced into reduced motion.

## 33. Android WebView improvements

Web improvements apply to the same WebView application. The native bridge observer was inspected: one RAF-coalesced UI-state publisher, guarded semantic hooks and scoped attribute observation, no obvious self-trigger loop. Native source/APK were not edited. Physical-device FPS, thermal, battery and media-policy testing remain unverified.

## 34. API/network improvements

Concurrent focus/visibility/payment refresh events reuse the pending session request, with explicit account switches superseding and aborting it. Responses remain no-store; privileges clear on switch. Static service-worker caching excludes RSC/prefetch route data, private APIs and dynamic image endpoints; public hashed chunks, art, backgrounds, content and scan assets remain cacheable.

## 35. Database/query improvements

Global public flag override reads are single-flight and use the existing 30-second TTL. Failed reads retain the same env/default fallback and back off for that TTL; mutations invalidate it with a generation guard. The fixture proves 25 simultaneous reads use one query and one outage log. No user data/entitlement cache or schema/index migration was added. Other session queries already parallelize independent reads; no blind DB rewrite was made.

## 36. Memory leak fixes

Explicit PDF canvas backing-store release, abort-on-unmount session requests and reference-counted clock cleanup. Existing PDF document/worker, media, object URL and observer disposal were retained. Four rapid full reloads temporarily grew heap from 21.4 to 59.8 MB and retained detached contexts; natural GC subsequently returned it to 19.4 MB with zero detached script states. A normal persistent-shell cycle then measured 19.4→20.8 MB, nodes 1533→1517, zero detached script states. This is finite evidence, not an unbounded production leak guarantee. Forced GC was unavailable through the permitted tool.

## 37. Cleanup improvements

Source/store subscriptions, shared display timers, glass frames and modal observers have regression coverage. Generated derivatives are reproducible. Development servers created for prior testing were stopped; user production sessions and signed-in browser tabs were not changed.

## 38. Files changed

Task changes: `scholar-ai-content.tsx`, new `scholar-ai-renderer.tsx` and `lazy-scholar-ai-content.tsx`; `app-shell.tsx`; `lam-widget.tsx`; `lam-response.tsx`; `lam-avatar.tsx`; `lam-identity-settings.tsx`; `lam-presence-runtime.tsx`; `identity.ts`; new `presentation-selectors.ts`; `glass-runtime.ts`; `exam-ready/presentation.tsx` and `final-review.tsx`; `study-music/player.tsx`, `tools.tsx`, `library-runtime.tsx`, new `quick-access.tsx` and `dialog-mutations.ts`; `subscriptions/subscription-provider.tsx`; `views/dashboard.tsx` and `music-widget.tsx`; `music-store.ts`; `pdf.ts`; `server-flags.ts`; `startup-modes.ts` and `startup-tasks.ts`; `launch-readiness-gate.tsx`; `scholar-footer.tsx`; new `navigation/intent-link.tsx` and `intent-prefetch.ts`; new `time/visible-clock.ts` and `use-visible-clock.ts`; `uploaded-book-reader.tsx`; `public/sw.js`; 22 crop derivatives/manifest; the three scripts and three performance test files; this report and QA artifacts. Other dirty files predate this request and were preserved.

## 39. Dependencies changed

None. Existing Sharp, Next, React, Zustand and Bun tooling were reused. No lockfile, package manifest, native build or production environment change.

## 40. Tests added

`performance-engine.test.ts` (23 cases: prefetch, display clock, pixel equality, selectors, telemetry, modal mutations, cache privacy), `performance-glass.test.ts` (1), `performance-server-flags.test.ts` (2). Total **26 new cases**. Existing mission/prose/math and LAM behavior tests were retained, not relaxed.

## 41. Exact test results

Final isolated unit run: **861 pass, 3 fail, 13 skip across 85 files**; no file timeout. This includes `.test.tsx` fixtures omitted by the previous narrower run. The only failing file is the pre-existing `personalization-security.test.ts`: background task expected 1/received 0, durable failure expected 422/received 503, original upload expected 201/received 503. These failures were present before this optimization. Live-provider tests require explicit test environment and remain skipped.

## 42. TypeScript result

Standalone `bunx tsc --noEmit` and final build TypeScript pass. An initial generator-array inference issue was corrected; it is not left unresolved.

## 43. Lint result

`bun run lint` passes. React review covered primitive/shallow snapshots, effect cleanup, SSR rendering contract, passive listeners, intent-only imports, media ownership and accessibility. No blanket React.memo or experimental rendering framework was added.

## 44. Production build result

Final `bun run build` succeeds: compilation **9.3 s**, TypeScript **73 s** while the isolated test suite also ran, **66 static pages** generated in 1.206 s. Build wall time is not a user-interaction benchmark.

## 45. git diff --check result

Pass. Only existing Windows LF/CRLF conversion notices; no whitespace errors. No staging, commits, pushes or deployment.

## 46. Browser performance testing

The story is unchanged Scholar navigation → shell/feature components → existing authorized APIs/data → rendering, with smaller and quieter client work. Production IAB checks use CUA/CDP, not HMR or a separate browser driver. Dashboard, LAM AI gate, Music Plus preview, LAMTube, CCC, Exam Ready, Resources, E-Book and Settings were sampled. Actual checks include mobile menu navigation, Ask LAM open/type/clear/close, Laws of Motion chapter tutoring input, running/paused Exam Ready clock, LAMTube returning to watching, scrolling, gallery and a built-in reader with one page image and no mass canvas/iframe instantiation. Final browser error logs were empty. The evidence is saved in `perf-final-browser.json` and screenshots. API/private gates were not bypassed. Temporary viewport, media and network emulation settings were reset.

## 47. Before/after metrics

Measured Dashboard script bodies: **2,476,869 → 2,139,299 bytes**, a **337,570-byte / 13.6% reduction**. The final settled sample observed FCP **560 ms**, LCP **1196 ms**, CLS **0.0403**, TTFB **109.8 ms**, versus the baseline values in section 2. Local TTFB did not improve; these single samples are not causal/statistical proof of Web Vital gains. ScriptDuration was **0.423669→0.278158 s** in the inspected windows, with differing cache/idle histories. No blanket speedup percentage is inferred from that.

Direct public Next Image response metadata (WebP quality 75, same original art):

| Asset use | Before bitmap / bytes | After bitmap / bytes |
| --- | --- | --- |
| Header | 640×480 / 52,864 | 48×51 / 950 |
| 100px gallery card | 640×480 / 52,864 | 128×135 / 3,932 |
| Preview | 828×621 / 78,564 | 256×270 / 11,088 |

Header requested bitmap pixels fall by **99.2%**, with source crop pixel equality verified. These are per-asset numbers; the old sheet URLs were shared/cached, so they are not multiplied by avatar count to invent page-transfer savings.

Deterministic fixture results: music equal-duration notifications **120→1**; three display subscribers share **1** interval/listener and **0** ticks while hidden; 25 concurrent flag callers use **1** actual query. Static blur count **339→339**; timer call-site inventory **40→38** (not a live-timer count).

Finite 1.5-second after-only RAF cadence: Dashboard idle **16.67 ms mean / 16.8 ms max**; cold Ask LAM input/open **23.33 / 83.4 ms**; warm Ask LAM input **17.05 / 33.4 ms**; Exam Ready active clock **18.27 / 66.62 ms**. Cold panel opening and some transitions still spike. RAF cadence is not a physical-device GPU/FPS certification or an INP measurement. Fast/Slow 4G commands were accepted and warm-cache mobile UI remained usable, but localhost/cache observations did not validate real cold-network latency or transfer throughput.

No invented INP, actual mobile-device 60 FPS, or production database latency is reported. Lab frame cadence and event timings are distinguished from field vitals.

## 48. Visual-regression result

Before/after desktop and mobile screenshots were saved and inspected. The gallery was checked at **1920×1080, 1440×900, 1366×768, 390×844, 360×800 and 320×700**: document width matched viewport width in every check, with all **22** approved forms present. Layout/style files, typography, card markup, backgrounds, material and animation timings are unchanged. Derivative RGBA equality is tested for every avatar. Animated backgrounds/phases and time-dependent content mean full screenshots are not expected to be byte-identical.

## 49. Known remaining bottlenecks

Large curriculum/schema/framework chunks, external background bandwidth, some duplicated Google font imports (34 existing declarations retained to protect exact typography), streaming history persistence, rich compositing/GPU load, cold panel-opening spikes and initial client startup CLS. These need targeted field/device profiling; they were not disguised by removing visuals. The three unrelated PDF fixture failures remain.

## 50. Anything not verified

The local database URL still does not match the PostgreSQL schema. Authenticated Plus playback, private-reader/OCR workflow, live LAM streaming, Google sign-in, Drive, actual multi-user WebRTC and production DB latency were not certified against this local build. Existing unit/security/real PDF/OCR fixtures cover their contracts, not live account environments. Physical Android battery/thermal/device tests and statistically controlled field LCP/INP are unavailable. No production website changes were made.

## 51. Recommended post-beta monitoring

Collect privacy-safe real-user LCP/INP/CLS by route/device, long-task samples, render/heap traces for long chats and large books, authenticated playback-navigation stress tests, physical low-end Android/WebView runs, and external background/font latency. Suggested regression budgets: no reintroduction of reference sheets into small avatars, no optional Quick-mode idle prefetch, one media owner, one visible clock interval, zero hidden display ticks, and no private/RSC service-worker cache. Alert on sustained regressions relative to this measured local baseline, not arbitrary marketing scores.
