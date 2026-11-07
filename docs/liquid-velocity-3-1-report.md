# Scholar — Liquid Velocity 3.1 implementation and verification

Date: 4 November 2026. Local changes only. Repository: `C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1`.

**User correction applied:** the replacement mobile Settings category selector was rejected. The original Settings tab/pill design, hero, cards and controls are retained. Only responsive spacing, label wrapping, tap targets, row layout and dock clearance are adjusted. Earlier selector-specific recordings/results are historical iterations, not the final Settings design. Final proof is `browser/results-07-mobile-settings.json` and the updated recording 07.

## Executive summary

The nine core corrections are implemented in the application. Actual Chrome browser journeys, not isolated demo components, were recorded for each request. Desktop/mobile navigation, direct-manipulation cancellation, menu presence, Guest timing, all Settings categories, inline search and public Resources were exercised. This is **not** certification of every route, browser, device or authenticated workflow.

No commit, push, deployment, database migration, production modification or paid AI request was performed. HEAD remains `91554372aff1e692ee8009b7165c8cb3209894e1`; the Git index is empty. The loader's artwork, timing and readiness system were not edited.

The React best-practices and full-story verification skills informed the single-owner animation/lifecycle work and browser→existing resource API→public catalog verification. The implementation does not add a provider, dependency, experimental appearance runtime or authentication bypass.

## Exact implementation map

Paths below are source links in the actual repository. Recording links are real captured MP4s; their original WebM files are retained.

| Task | Route / UI location | Component / source | Implementation | Actual refraction? | Browser verified / evidence |
|---|---|---|---|---|---|
| 1. Mobile sidebar and dock | All application sections; mobile header and dock | [AppShell](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/app-shell.tsx), [MobileLiquidDock](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/mobile-liquid-dock.tsx), [useSidebarTouch](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/use-sidebar-touch.ts), [dockDragFrame](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/lib/animation/dock-swipe.ts) | Desktop rail hidden by CSS before hydration below 1024px. Explicit Radix drawer, safe areas, scroll, dismissal/focus. Dock initially visible; same persistent lens follows bounded X only; no per-move React state. | Tier 1 assigned lens on capable Chromium, Tier 2/3 fallback otherwise. | Chrome touch: initial hidden drawer, outside/close/Escape/navigation dismissal and unlocked body. [Drawer recording](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/recordings/01-mobile-sidebar.mp4), [dock recording](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/recordings/02-dock-touch.mp4). Native Android Back is source-reviewed, not device-certified. |
| 2. Dropdown entrance AND exit | Notes actions, Settings Select, search popover; common portal adapters | [useVelocityPanel](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/velocity-motion.tsx), [Select](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/ui/select.tsx), [useRetainedSelect](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/use-retained-select.ts) | Anime/WAAPI 180ms entry, 150ms exit; real Radix Presence retained for 160ms. Select needs explicit retention because installed Radix Select has no Presence. No cloned menu. Immediate value handlers; epoch-fenced timer cleanup and focus restore. Side-aware Sheet transitions. | Bounded Tier 1 when allocated and settled; cheaper blur while animating. Enormous Dialog/Sheet surfaces are not whole-panel displaced. | [Menu recording](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/recordings/05-dropdowns.mp4): Notes Escape/outside/rapid reopen/focus, Select Escape/keyboard/re-entry. Search Popover and Sheet verified separately. Unused ContextMenu/Menubar/HoverCard families are source/type-checked only. |
| 3. Genuine sidebar backdrop | Desktop rail and mobile drawer; existing route media | [SceneBackdrop / SidebarOptic](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/scene-backdrop.tsx), [material CSS](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/liquid-velocity.css) | Moves the **existing** route background into one shell scene host using `createPortal`; does not clone a page or video. Removes unrelated blue rail fill. Separate unfiltered readable content; bounded top optical zone, rest translucent. During width animation uses cheaper blur. | Tier 1 actual SVG backdrop displacement in a maximum 540px-high zone; not a claim that the entire full-height rail refracts. | Real Settings scene had exactly one video under both columns. [Recording](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/recordings/03-sidebar-backdrop.mp4), equal-blur comparison below. |
| 4. Guest notice | Global signed-out Guest shell; Account information | [GuestSessionNotice](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/guest/guest-session-notice.tsx) | 5000 foreground milliseconds after startup ready, 180ms layout-collapse exit; once per browser session. Visibility pause, one bounded 8s focus-reading accommodation, manual dismissal, strict-effect cleanup. Account retains honest persistence warning. | No new displacement required. | [Recording](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/recordings/06-guest-notice.mp4): approximately 5.28s including exit in the full run. Route did not reset timer or restore notice. Manual, reload, focus and hidden-policy probes also passed. |
| 5. Tactile controls | Shared controls and audited native families | [VelocityInteractions](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/velocity-motion.tsx), [existing selector policy](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/lib/animation/velocity-policy.ts) | Compact .925, normal .95, large .985 compression in 70ms; measured radius/edge response; spring recovery with bounce .08 and 200ms target. Delegated events, cancellable WAAPI, no per-button idle loop. | One eligible active native/shared control can get Tier 1, not every idle button. Existing GlassButton keeps its own registered surface. | [Recording](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/recordings/04-buttons.mp4): Notes primary, toolbar and shell icon pressed/released. Computed .95/.925 scales, real SVG on active Notes button, disabled/loading guards. Inventory and exclusions below. |
| 6. Mobile Settings | Settings — 12 original category tabs | [Settings](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/views/settings.tsx), [URL/history helper](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/settings/settings-navigation.tsx) | Original pills/tabs and cards restored at user's request. Two columns on narrow phones, three on wider phones/tablets, four in short landscape; minimum46px tap targets and wrapped labels. Existing desktop design retained. Roomier rows, dock clearance and browser Back/forward retained. No replacement category dropdown or new Back toolbar. | Existing original tab lens/material remains bounded; no new menu surface. | [Recording](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/recordings/07-mobile-settings.mp4) and final original-design browser results. |
| 7. Bounded interactive refraction | Active buttons, lens, compact menus and sidebar zone | [glass-runtime](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/glass-runtime.ts), [shared filters](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/glass-filter.tsx), [legacy material exception](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/liquid-glass/liquid-glass.css) | Reuses shared compact filter globally; no duplicate filter IDs when dock mounts. Interactive priority, one control registration, existing area/width/budget caps unchanged. Narrow exception lets active optics win old high-specificity `-glass` blur rules. | Yes, live backdrop SVG in tested Chromium, with documented fallbacks. Not native Apple glass, and not a promise of identical optical output. | [Button evidence](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/browser/button-optical-active.png), [optics results](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/browser/results.json). |
| 8. Duplicate Resources cleanup | Notes, Practice, E-Books, Study and other feature workspaces | [dedicated Resources](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/views/resources.tsx), [ResourcesHomeLink](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/resources/resources-home-link.tsx) | Sixteen redundant presentations removed/replaced with a single navigation link; no backend, catalog, resource record or file deletion. Contextual academic sources remain. | Existing dedicated Resources backdrop moved once into shared scene. | [Recording](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/recordings/09-resources.mp4). Real anonymous existing API delivered 126 public library entries. Private uploads/reader handlers preserved, not authenticated-tested. |
| 9. Inline search | Original top-bar search, desktop/mobile | [InlineSearch](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/inline-search.tsx), [useResourceSearch](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/src/components/resources/use-resource-search.ts) | One original combobox, anchored listbox, arrows/Enter/Escape/Tab and Ctrl/⌘K focus. Removes shell CommandDialog. Reuses same permission-filtered `/api/resources` GET; 250ms debounce, abort, identity/query/grade fences and honest error states. | Shared compact portal optical allocation; fallbacks remain usable. | [Recording](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/recordings/08-inline-search.mp4), [real public search success](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/browser/search-public-success.png). No second search field or centred dialog. |

## Reference, materials and truthful optical claims

The supplied `C:/Users/Lenovo/Downloads/liquid hover refernce.mp4` was accessible: H.264, 848×224, approximately 14.47s, 60fps. A whole-video contact sheet and 10fps intermediate movement frames were inspected. The visible reference shows a moving stadium lens, widening curved-edge bends, visible backdrop detail and brief settling over stationary navigation. No actual finger is visible; exact finger coordinates or native Apple implementation cannot be inferred.

The persistent Scholar lens preserves fixed icon/text geometry and uses a wider compact displacement field. Original three preset values remain unchanged; the existing compact dock filter is shared once rather than mounted with every dock instance. Four filter IDs and eight small inline map images exist, not per-control filter trees. Motion uses existing `animate`, `createScope`, `createTimeline`, `stagger`, `waapi.animate` and `spring` APIs from installed Anime.js 4.5. Framer retains its existing page/notice/outer-opacity ownership. No competing controller writes the same lens geometry.

Material distinctions:

- **Tier 1:** Actual live SVG displacement through `backdrop-filter` for allocated, bounded surfaces on supported Chromium. Text is above the optic, not itself filtered. A button may refract already-composited material behind it; not every route has a detailed image immediately behind every control.
- **Tier 2:** Translucency, blur, hairline and specular material; this is not described as displacement. Animated menus use this during movement and restore allocated optics on settling. The rest of the large sidebar is translucent, not a full-height displaced page.
- **Tier 3:** Opaque/readable lightweight, reduced-transparency or unsupported-engine fallback. Safari/iOS and Firefox do not receive the Chromium SVG path. Their physical rendering was not tested here.

The compositor budget is unchanged: at most six high-quality optical surfaces, two balanced desktop surfaces, one balanced touch surface, none lightweight/hidden. Surface caps remain width ≤640px and area ≤180,000px². Active native controls are narrower still: ≤420px wide, ≤96px tall, ≤30,000px². Interaction priority does not create a second registration or bypass these limits. Touch control optics are released after use; route/blur/cancel/unmount clean up. Existing adaptive quality downgrades remain enabled.

The sidebar compositor problem was addressed rather than hidden: one existing background is portalled from Dashboard, Settings, Notes, E-Book library, Practice, Class 11 Flashcards and Resources into the real shared host. It extends beneath both columns. These are moved original nodes, not copied screenshots or extra video decoders. Other workspaces without a root scene retain the shared shell environment; there is no claim that all routes have a full-bleed background.

### Refraction on/off evidence

- [Real scene, refraction on](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/browser/sidebar-scene-on.png) / [off](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/browser/sidebar-scene-off.png).
- [Equal-blur SVG on](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/browser/optical-equal-blur-on.png) / [same blur, SVG removed](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/browser/optical-equal-blur-no-svg.png).
- [Dock diagnostic on](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/browser/dock-diagnostic-on.png) / [off](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/browser/dock-diagnostic-off.png).

The stripe target was temporarily inserted into the **real** scene host for diagnosis and removed afterwards. It is not a shipped background or generated app screenshot. The equal-blur pair holds blur(3px) and saturation constant while removing only the SVG URL. The 256×540 crop differs by mean absolute channel delta 1.91/255; approximately 2.60% of channels differ by >8. That numeric difference alone is not proof of optical realism (the filter also has a colour transfer); actual edge output and intermediate reference frames were inspected. The effect is controlled/subtle, not a pixel-perfect reproduction of Apple's native lens.

## Dock and drawer evidence

The recorded CDP touch gesture crosses several destinations with slight diagonal drift. Throughout the sampled drag:

- Dock rectangle remains x≈10.39, y≈722.41, 369.22×64 at 390×844.
- Lens X changes approximately 192px while committed route stays unchanged.
- Lens Y stays ≈730.41 and height stays 50px; vertical scale is exactly 1.
- All five button/icon rectangles remain fixed.
- Release adds exactly one history entry; cancellation returns to the committed lens and clears dragging.
- Rapid Home→Study→Practice taps remain available; dragging is optional.

The drawer starts absent; desktop aside is `display:none` on mobile. Close, Escape, outside tap and route navigation were exercised; body lock is released. The persistent drawer lens uses passive touch listeners and yields at 7px vertical movement without pointer capture, preserving native vertical scrolling. Its row response is a small bounded offset, not a free-floating drawer. Android bridge Escape/back integration was inspected but no physical APK/device test was performed. VoiceOver/TalkBack and hardware rotation/safe-area behaviour require device QA.

## Button coverage inventory and exclusions

The pre-edit AST inventory covered 244 TSX files and 1,768 source definitions: 1,271 native buttons, 457 shared Button, 24 GlassButton and 16 motion.button. These are **definitions**, not runtime instance counts or a claim that every native button was migrated.

The final inventory covers 249 TSX files and 1,771 definitions: 1,274 native, 457 shared Button, 24 GlassButton and 16 motion.button. The audit recognises 221 explicit/audited native definitions, including previously covered Chapter Command classes; additional existing policy families are listed in the policy source. Shared Button/GlassButton, tabs, accordion/collapsible/dialog triggers, Chapter Command primary/secondary/actions, Exam Ready toolbar/segments/quick actions/tools, E-Book reader tools and mini LAM composer reuse the delegated system unless explicitly excluded.

This pass added 55 attribute-only opt-ins:

| Family | Newly opted-in definitions | Deliberately excluded in migration |
|---|---:|---|
| Settings | 24 | 6 security/destructive/developer-related candidates; AccountSecurity and Developer panel explicitly opt out |
| Planner | 2 | 2 delete/reset-related candidates; calendar geometry retains its owner |
| AI Tools | 12 | Provider/action handlers unchanged; no live AI executed |
| Classic Resource Library | 13 | 1 import/security-sensitive candidate |
| Class 9 Flashcards navigation | 4 | Answer and card-flip ownership preserved |
| Notification Center | 0 | Existing Framer-owned notification control excluded |

Notes' existing primary and ToolbarBtn family, the action trigger's accessible name, and shared shell controls were verified in the browser. Native unreviewed controls, assessment answer choices, quiz grading/submission, flip cards, calendar cells, Framer-owned transforms, disabled/loading controls, alert-dialog confirmations, authentication/security and developer controls are not blindly converted. The dock explicitly opts out of delegated press transforms so icons remain fixed. A menu-opening press can be cancelled at the motion boundary instead of distorting its anchor while opening.

Full source-level records: [before inventory](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/inventory.json), [after inventory](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/inventory-after/inventory.json), [55-control migration and exclusions](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/control-migration.json). There is no claim that all 1,274 native definitions have identical motion or individual browser certification.

## Menu inventory

Before: 120 native selects, 45 SelectContent, 7 DropdownMenuContent, 1 PopoverContent and the shell's 1 CommandDialog presentation. Final: 120 native selects, 45 SelectContent, 7 DropdownMenuContent, 2 PopoverContent and no shell CommandDialog. The interim extra Settings category selector was removed at the user's request.

Adapters migrated: `src/components/ui/{dropdown-menu,select,popover,context-menu,menubar,hover-card,sheet}.tsx`, including submenu content. Existing Dialog already shares `useVelocityPanel`; AlertDialog safety semantics remain untouched. Native selects remain native OS/browser pickers and cannot be given a custom Anime.js popup animation. ContextMenu, Menubar and HoverCard adapters have no discovered mounted application examples in this inventory; they are not falsely reported as browser-tested routes. Some feature-local expandable panels retain their pre-existing motion instead of being force-converted.

Closed Radix content is kept with a non-visual CSS Presence clock, while Anime owns opacity/scale; there are no cloned ghost menus. Installed Select requires its own short retained-open window: actual content and focus scope finish closing together; value handlers remain immediate. Rapid Notes reopen showed exactly one real menu. Escape restored both Notes trigger and Settings Select trigger focus.

## Settings and Guest results

All original tabs: Account, Appearance, Academic, LAM, Privacy, Notifications, Data, Learning Profile, Subscription, Plugins & Connections, Update Logs, Developer. Legacy `#plugins-connections`, `?drive`, malformed hash fallback, browser Back and forward are preserved/tested. The interim in-app Back/category toolbar was removed with the rejected selector. The Developer category still requires signed server authorization; merely reaching its locked presentation does not grant access.

Seven sizes: 320×700, 360×800, 375×812, 390×844, 430×932, 844×390 and 768×1024. Final original tabs are checked for visibility, minimum target dimensions, wrapped/unclipped content and document overflow. Category tabs scroll with the original page rather than using a new sticky toolbar. Settings data and action handlers remain unchanged.

- [Before 390×844](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/before/settings-390x844.png) / [after](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/browser/settings-390x844.png).
- [Before landscape](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/before/settings-844x390.png) / [after](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/browser/settings-844x390.png).
- [Final original-tab results](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/browser/results-07-mobile-settings.json). Earlier selector hit-test results are historical and superseded.

Guest before: banner still occupied 374×123px after 5,600ms. After: removed from DOM/layout at approximately 5,283ms in the full recording (earlier independent sample 5,239ms). Navigation during countdown did not reset it. Manual close survives navigation and reload in the same browser session. A later repeat exposed an early-interaction edge: the close button could be pressed before startup readiness installed its timer controller. Manual dismissal now works independently of that controller and persists immediately. Focus-reading pause retained the notice beyond five seconds but expired safely; focus moved to Account/profile rather than a removed control. A synthetic hidden-document probe retained the notice for 5.2s and resumed remaining time. That is a deterministic policy probe, not a claim of physical mobile background-tab certification.

## Resources removal and preserved capabilities

Sixteen presentation removals/replacements, with original pre-edit lines in [cleanup inventory](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/resource-cleanup.json):

- Chapter Command workspace: overview, practice and revision ResourceShelf; embedded ResourceLibrary replaced by one Resources navigation link.
- Legacy Chapter Command: embedded ResourcesPanel replaced by that link; the unmounted legacy helper is not destructively deleted.
- Scholar Today, Intelligence, Formula Explorer, Flashcards, Notes, Study and Revision Hub: duplicate ResourceShelf removed.
- Practice: two duplicate shelves removed.
- Paused LAMTube: duplicate shelf removed; shutdown behaviour unchanged.
- E-Book library: embedded full ResourceLibrary removed; CustomEbookLibrary and reader/uploads retained.

Preserved: dedicated ClassicResourceLibrary, underlying ResourceLibrary/detail components, static public catalog, server ownership checks, saved-resource records/preferences, citations, contextual Exam Ready/lesson source references, reader, downloads and uploaded materials. No resource data or asset files were deleted. The real anonymous library returned 126 entries across 45 chapters; a separate public search GET returned HTTP200 and Built-in results. No signed-in private resource import/read/write was attempted.

## Search flow and data boundaries

Original top-bar input → local navigation/public e-book actions plus existing debounced `/api/resources?q&grade&limit=5` → unchanged server session/ownership filtering → public catalog or authenticated private scope → anchored results → existing navigation handler. Ctrl/⌘K focuses that same input. The old shell CommandPalette/CommandDialog rendering and keyboard listener were removed; reusable `ui/command` and resource command helper files remain for other purposes. No new search endpoint, anonymous private-content index or LAM request was introduced.

The fetch aborts on close/query/grade/identity changes and returned records are fenced by identity, query and grade. UI never treats unavailable lookup as successful AI or fabricated source data. Most QA deliberately blocked APIs to test that failure state. Two designated anonymous public-resource checks allowed **GET `/api/resources` only, with no auth cookie**. Source inspection confirms that absent cookie returns before DB session lookup and anonymous library search uses its existing static catalog. All mutations and provider calls stayed blocked.

## Verification and performance

Local production build, installed Chrome, disposable Guest storage, no production credentials in the browser fixtures. Nine requested journeys plus policy/optics probes passed; extra Guest/history/public-search checks passed. Recordings are encoded H.264 MP4 with `yuv420p` and fast-start, plus original WebM. [Evidence index](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/evidence-index.json) records dimensions/durations. Screenshots and actual browser output were visually inspected, including all Settings viewport layouts, not just DOM assertions.

Performance is **mixed**, not a zero-lag certification. The baseline and final harness use the same Chrome binary, Notes fixture, API blocking, video capture, 1440×900 viewport, 100 rAF samples/activity, normal and 4× CPU-throttle cases. Measurements are noisy single local samples, not standard INP, a statistical benchmark or physical-phone FPS. Frame p95 includes compositor/screen-recording effects; Event Timing maximum is explicitly diagnostic. No LCP metric is used to conceal loader duration. Loader timings were not changed.

Detailed before/final tables are in [before results](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/before/results.json) and [after results](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/after/results.json). The first after-run improved all six p95 samples; a later repeat regressed some, and is preserved as [pre-panel-cost-fix repeat](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/after-pre-panel-cost-fix.json). That repeat had normal sidebar p95 133.4ms versus baseline116.7ms and throttled dropdown250.2ms versus200ms, despite lower total throttled dropdown long-task time (4720ms versus5914ms). These regressions motivated cheaper optical treatment during portal transitions. Full live displacement is restored only after settling; budgets were not relaxed to hide cost.

Final post-optimization sample (milliseconds; lower is better):

| Activity | CPU | Before frame p95 | Final frame p95 | Before long-task total | Final long-task total | Before / final Event Timing maximum (diagnostic only) |
|---|---:|---:|---:|---:|---:|---:|
| Sidebar toggle | 1× | 116.7 | 99.9 | 105 | 0 | 872 / 496 |
| Inline search | 1× | 66.5 | 50.1 | 470 | 96 | 400 / 232 |
| Notes dropdown | 1× | 33.6 | 33.6 | 305 | 191 | 280 / 232 |
| Sidebar toggle | 4× | 180.5 | 183.6 | 2198 | 1921 | 944 / 808 |
| Inline search | 4× | 116.4 | 66.9 | 4840 | 1704 | 3072 / 928 |
| Notes dropdown | 4× | 200.0 | 116.9 | 5914 | 3635 | 2168 / 1872 |

Final normal samples had zero measured CLS. The throttled sidebar still shifted layout: 0.0410 versus baseline0.0460; all other final activity windows measured zero. This does not meet a promise of universally smooth motion. The final throttled sidebar p95 was slightly worse, while the other p95 samples improved or stayed unchanged. Every final long-task total was lower in this particular run. Heap snapshots and full frame distributions are preserved in the JSON; garbage collection and short recordings make them unsuitable for a memory-leak or percentage-saving claim. Earlier repeats are retained to expose variance, not discarded as inconvenient results.

Mobile/touch profiles are [after-only diagnostics](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/mobile-performance.json), 390×844, balanced quality, 100 rAF samples per activity:

| Activity | Frame p95 ms | Long-task total ms | Diagnostic layout-shift sum |
|---|---:|---:|---:|
| Drawer open/close | 33.3 | 173 | 0 |
| Dock touch/navigation | 33.5 | 0 | 0.0102 |
| Rapid Settings tab switching and Back | 66.7 | 530 | 0 |
| Inline search | 16.8 | 0 | 0.0088 |

No comparable pre-edit touch trace was captured, so no mobile percentage improvement is claimed. The Settings profile taps the real original tabs, then uses browser Back; it switches several differently sized panels and still involves rendering/layout work. These values are a local diagnostic, not field CLS or physical-device performance. Adaptive high→balanced→lightweight behaviour, hidden optical budget zero, reduced motion, glass-off and performance mode were tested. Existing width-based desktop rail animation remains layout work; slow-device and high-refresh performance remain limitations requiring physical hardware profiling.

### Commands and outcomes

- `bunx tsc --noEmit`: passed; production build also runs TypeScript validation.
- `bun run lint` (actual command `eslint .`): **one existing error** in unrelated untracked paused `src/components/landing/cinematic-video.tsx:120`, `react-hooks/refs`, assignment to `runRef.current` during render. Left untouched and included in safety hash comparison. No hiding by changing lint configuration.
- Scoped ESLint on changed interaction/search/Guest/Settings sources: passed.
- `bun run build`: passed, 70 static pages and existing dynamic API routes; compilation-only preflight, no migration/deployment.
- Isolated regression runner after restoring the user's Settings design: **118 files, 1,263 passed, zero failed, 16 skipped**. Skips remain skips, not claimed successes. A new regression explicitly prevents replacing the original tabs with the rejected selector.
- Focused dock/material/3.1 tests: passed. They cover horizontal geometry, shared filter IDs, category deep links, real presence/cleanup, no cloned scene, resource/API fences and preserved source capabilities; they do not substitute for browser evidence.
- `git diff --check`: passed.

Console: no uncaught page errors in recorded journeys. Intentionally blocked API requests produce expected network errors. Existing external font decode/OTS warnings and an unused CSS preload warning were observed. A missing mobile drawer description warning found during QA was fixed by adding an actual screen-reader description. Not claiming a perfectly empty console across all routes.

Failed fixture/debug runs are retained in logs: initial fixture incorrectly reset Guest state on navigation; early tests targeted a missing `data-nav-id` or the native Academic picker as if it were Radix. They were corrected using real controls. A failing button optical check exposed a genuine legacy high-specificity blur override; the narrow exception fixed it and actual computed SVG filtering was re-verified. A visual landscape occlusion survived overflow-only tests and was fixed with hit-test evidence.

## File-by-file supporting map

In addition to the linked main components:

- `src/components/liquid-glass/glass-filter.tsx`: moves compact filter definition to shared defs; preserves original preset map/values and standalone export for tests.
- `src/components/liquid-glass/glass-runtime.ts`: priority update for an existing registration only; existing caps retained.
- `src/components/liquid-glass/liquid-glass.css`: excludes only an opted-in active optical control from conflicting legacy blur recipes; idle materials unchanged.
- `src/components/liquid-glass/liquid-velocity.css`: drawer/scene/material states, horizontal compact optic, button press, retained portal Presence clock, inline search and responsive Settings styles.
- `src/components/liquid-glass/velocity-motion.tsx`: single lens controller; width-resize material gate; tactile delegated runtime; panel enter/exit/cleanup; shared APIs remain Anime.js.
- `src/components/ui/{context-menu,dropdown-menu,hover-card,menubar,popover,select,sheet}.tsx`: forwarded real refs and shared lifecycle; no mirrored content.
- `src/components/views/{dashboard,notes,practice,settings,ebook,flashcards/Class11FlashcardsView}.tsx` and `src/components/resources/classic-resource-library.tsx`: original root media moved into shared scene; existing media readiness/policies retained.
- `src/components/views/{ai-tools,planner,flashcards/Class9FlashcardsView}.tsx`: bounded attribute-only opt-ins; action logic unchanged.
- `src/components/views/{chapter-command,flashcards,formulas,intelligence,nigtube,revision-hub,study}.tsx`, `src/components/chapter-command/workspace.tsx`, `src/components/personalization/scholar-today.tsx`: redundant resource presentation cleanup only, plus dedicated navigation link where useful.
- New `guest/guest-session-notice.tsx`, `inline-search.tsx`, `settings/settings-navigation.tsx`, `resources/{resources-home-link,use-resource-search}.tsx/ts`, `liquid-glass/{scene-backdrop,use-retained-select,use-sidebar-touch}.tsx/ts`: narrowly scoped behaviours described above.
- `src/lib/animation/dock-swipe.ts`: bounded X-only direct-manipulation math; Y/height/vertical scale invariants.
- `tests/{dock-swipe.test.tsx,liquid-velocity.test.ts,liquid-velocity-3-1.test.tsx}`: geometry/filters/policies/preservation regressions.
- `scripts/liquid-velocity-3-1-*.mjs`: audit, one-time narrow patch generators, baseline/browser/policy/performance/evidence/safety harnesses. **Do not rerun one-time migration generators on the already edited tree.**

## Safety, recoverability and remaining limits

Pre-edit safety copy: `C:/Users/Lenovo/Desktop/SCHOLAR/.rollback-backups/2026-11-04-liquid-velocity-3-1`, outside this repository. It contains complete pre-edit `src/` and `tests/`, empty tracked patch, and branch/HEAD record. No `.env` or credentials are included. No broad Git reset/restore/clean or deletion was used.

[Safety comparison](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3-1/safety-final.json): 837 pre-existing source/test files still present; 396 protected files compared byte-for-byte with zero mismatches, covering server APIs, library/auth/subscription/provider code (except the intended dock geometry helper), Exam Ready, loader/readiness, account security, appearance runtime and landing/cinematic source. Dependency manifests, schemas and production configuration were not changed. Unrelated assets, APKs, reports, `NEW PROJECT/` and paused cinematic files remain.

Remaining limitations / not certified:

1. Safari, Firefox, iOS hardware and native Apple optical equivalence; they use honest fallbacks.
2. Physical Android Back/rotation/safe-area/keyboard and TalkBack/VoiceOver operation; desktop Chrome touch emulation is not a physical device.
3. Every native button definition or every feature-local menu. Shared/audited families are covered; exclusions and unverified families are explicit.
4. Authenticated account/Plus/private resources, uploads, provider teaching and all educational workflows. Their code was preserved; this UI pass did not authenticate or make paid AI calls.
5. CPU-throttled frame-time jank and local measurement variance. No blanket smoothness or INP claim.
6. Existing external-font/preload warnings and the paused cinematic component's lint failure.
7. The sidebar's whole height is not displaced, and source/colour continuity depends on real media present on the route. Diagnostic stripes are not the shipped experience.

No push, commit, deploy, database change or production modification occurred. Publication requires a separate explicit request.
