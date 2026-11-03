# Scholar Liquid Velocity 3.0 — implementation and evidence

3 November 2026. Local repository: `C:\Users\Lenovo\Desktop\SCHOLAR\Scholar-V1`. Branch **main**, unchanged HEAD **e28f7cb53ffc37ef0d9eb26e8acb460beb6222ab**. Preview: **http://127.0.0.1:3024/**. No publication.

## A. Executive summary

Implemented a visibly different **whole navigation plane**, not another selected-pill-only pass: continuous cool-neutral reflections, readable translucency, curved illuminated edges, matching header/mark, and an Anime-owned **256 → 76 px compact icon rail** that keeps the same selection lens mounted. Normal rows retain native buttons, accessible names and current-page state. No rejected Liquid Crystal stylesheet, cloned scene or full-height displacement was reintroduced.

Refined the floating mobile dock, shared primary/secondary/icon controls, tabs, portal surfaces and named existing workspace panels. Extended delegated tactile feedback to **123 audited native button definitions in nine files**, plus Notes' two custom creation actions and reusable toolbar helper. This supplements the shared Button/GlassButton families and explicitly named Chapter Command, Exam, reader and dock controls. This is not a claim that all 1,271 native button definitions were rewritten.

The existing **five-second pure-black Scholar liquid wordmark and fade-only exit are byte-for-byte preserved** across all six loader/test files. Authentic LAM, academic content, question/assessment/provider logic, permissions and saved-work behavior remain intact. React review guidance informed explicit animation ownership, per-frame work outside React, scoped lifetimes and cleanup; verification guidance informed actual-browser flow and boundary testing.

## B. Why 1.0 looked weak

Verified in source and actual before screenshots:

1. The later `.scholar-desktop-sidebar[data-sg-chrome="sidebar"]` rule in `liquid-glass.css` explicitly removed its background image. The earlier chrome recipe provided mostly a uniform dark fill over a quiet environment. A working compact filter could not make that whole column appear dimensional.
2. Most visible lighting was confined to the active lens. Idle rows and the header had little coherent material hierarchy.
3. The delegated press selector covered shared buttons, GlassButton and dock controls, but many feature-native controls did not match it. The AST inventory found **1,838 control definitions**, including **1,271 native buttons**, **457 shared Button calls**, **24 GlassButton calls** and **16 motion.button definitions**.
4. Collapse removed/recreated the sidebar rather than preserving a compact rail and its lens. The width ownership was Framer, while the lens was Anime.

The remedy extends the existing architecture: large shell = efficient Tier 2; selected compact controls = genuinely refractive Tier 1 where supported; dense reading/fallback = paint-only material. No app-wide renderer/library replacement.

## C. Exact source map

All paths below are relative to the absolute repository root above; they are exact application source locations, not demo files.

| UI location | Route | Component | Source file | Tier | Actual refraction? | Visible effect | Verified? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop sidebar shell | Workspace routes | VelocitySidebar | `src/components/liquid-glass/velocity-motion.tsx`, `src/components/liquid-glass/liquid-velocity.css` | 2 | No full-height displacement | Continuous reflected light, translucent plate, curved specular rim | Chromium + WebKit; recording 01 |
| Sidebar header/mark | Workspace routes | AppShell | `src/components/app-shell.tsx`; same stylesheet | 2 paint | No | Matching silver-blue mark and separated header | Desktop before/after |
| Navigation rows | Workspace routes | NavList | `src/components/app-shell.tsx` | 2 | Idle rows: no | Readable idle, illuminated hover, tactile press, full labels via aria/title in rail | Mouse, keyboard, rapid selection |
| Active navigation lens | Workspace routes | NavigationLens / useNavigationLens | `src/components/liquid-glass/velocity-motion.tsx` | 1 / fallback | **Yes, Chromium within budget** | Persistent gliding rim bends live backdrop | Mounted-lens optical proof; recording 01 |
| Collapse control | Workspace routes | TopBar / Button | `src/components/app-shell.tsx`, `src/components/ui/button.tsx` | 2 | No | Focus/press feedback; aria-expanded/controls; 256↔76 rail | Actual collapse/reopen and reduced motion |
| Mobile dock shell | Workspace mobile | MobileLiquidDock | `src/components/liquid-glass/mobile-liquid-dock.tsx`; `liquid-velocity.css` | 2 | No shell displacement | Floating highlighted shelf, 12 px blur, readable icons | Touch emulation; recording 03 |
| Mobile selection lens | Workspace mobile | MobileLiquidDock / NavigationLens | Same dock file; `velocity-motion.tsx` | 1 / optimized | Conditional runtime budget, **not claimed on unverified devices** | Same moving lens, bounded touch offset and cancellation | Touch/cancel/landscape/More tested |
| Primary buttons | Shared actions | Button; NotesView creation actions | `src/components/ui/button.tsx`, `src/components/views/notes.tsx` | 2 | No new per-button filter | Neutral tinted bevel, specular edge, compression and spring release | Held Notes scale **0.965**; recording 02 |
| Secondary/outline buttons | Shared actions | Button | `src/components/ui/button.tsx` | 2 | No | Quiet layered surface, edge/focus contrast | Matched secondary captures |
| Icon buttons | Toolbars/top bar | Button; audited native controls | Same Button; `src/lib/animation/velocity-policy.ts` | 2 | No | Shared focus/hover/press; disabled guard | Reader and dock interactions |
| Dialog surfaces | Notes/search/settings | DialogContent / useVelocityPanel | `src/components/ui/dialog.tsx`, `src/components/liquid-glass/velocity-motion.tsx` | 2 | No | Readable 88% plate, illuminated rim, short entrance | Settled opacity **1**, keyboard Escape; paired captures |
| Dropdown menus | Notes/actions | DropdownMenuContent / useVelocityPanel | `src/components/ui/dropdown-menu.tsx`; same motion file | 2 | No | Layered popup, bounded entry and item stagger | Real Notes menu and Escape; recording 04 |
| Tabs | Settings/shared | TabsList / NavigationLens | `src/components/ui/tabs.tsx`; same motion file | 1 lens / 2 track | Lens conditional on budget | Gliding selection over a layered track | Click/arrow-key checks; recording 04 |
| Floating controls | Dock, shared floating actions | GlassButton / Button | `src/components/liquid-glass/glass-button.tsx`, `src/components/ui/button.tsx` | 1 or 2 | Existing GlassButton Tier 1 is conditional; not a blanket claim | Same controlled hierarchy, no dozens of filters | Dock/shared actions rendered; other private instances not certified |
| LAM controls | General assistant in workspace, **not private live-tutor certification** | LamWidgetRuntime | `src/components/lam-widget.tsx`; `liquid-velocity.css` | 2 | No new refraction | Composer lighting, tactile native actions, disabled Send respected | Open/close, composer and disabled-state screenshots; no message/mic |
| Dashboard panels | `/dashboard` | DashboardView / Card | `src/components/views/dashboard.tsx`, `src/components/ui/card.tsx`; stylesheet | 2 paint | No | Consistent illuminated edges; repeated panels no longer require backdrop blur | Full dashboard captures at 11 sizes |
| Exam Ready controls | `/exam-prep` | Workspace, SetupFlow, Classroom, TeacherPanel, StudyTools | `src/components/exam-ready/{workspace,setup,classroom,teacher-panel,study-tools}.tsx`; stylesheet | 2 | No new reading-area filter | Audited action tactility; plate/toolbar edge treatment | Landing/gate rendered, source/unit coverage; **Guest creation gated in API-blocked QA** |
| Notes toolbar | `/notes` | ToolbarBtn / Editor | `src/components/views/notes.tsx` | 2 paint | No | Explicit toolbar feedback/labels; editor text remains untouched | Disposable Guest note/edit/menu, paired toolbar captures |
| Reader toolbar | `/ebook` → Continue reading | EBookView | `src/components/views/ebook.tsx`; stylesheet | 2 paint | No | Beveled tool buttons and header; zoom actions intact | Actual default Physics page, zoom in/out, matched toolbar captures |
| Settings controls | `/settings` | SettingsView / shared Button, Tabs | `src/components/views/settings.tsx`, shared UI files above | 1 lens / 2 controls | Selection lens only, conditional | Consistent tracks/actions; no data/settings logic rewrite | Actual route, keyboard tabs, light/large-text flags |
| Chapter Command controls | `/chapter-command` | ChapterCommandCenter, Action and existing ccc families | `src/components/chapter-command/workspace.tsx`; policy + stylesheet | 2 | No new academic-area filter | Named primary/secondary/mode/action feedback and plate edges | Actual workspace rendered |

Material recipes live in **`src/components/liquid-glass/liquid-velocity.css`**, appended to the existing system. The original shared SVG definitions, runtime, provider, material tokens and budgets were **not replaced or relaxed**. The whole sidebar is intentionally not advertised as physically ray-traced glass: its compact lens supplies real live-backdrop displacement; the large shell supplies affordable optical-looking material.

## D. Exact Anime.js map and ownership

Installed versions: Anime.js **4.5.0**, Next **16.3.6**, React **19.2.3**, TypeScript **5.9.3**, Tailwind **4.3.3**, Playwright **1.61.1**, Prisma client **6.19.3**. No dependency or lockfile changes.

| Animation | UI / trigger | Component / exact source | API | Timing | Recording |
| --- | --- | --- | --- | --- | --- |
| Sidebar selection | Choose a destination | useNavigationLens, `src/components/liquid-glass/velocity-motion.tsx` | createScope + animate, interrupted instance cancellation | 310 ms, out(4) | 01-sidebar |
| Sidebar collapse/expand | Top-bar sidebar button | VelocitySidebar, same file | createScope + animate width | 300 ms, out(3); immediate reduced motion | 01-sidebar |
| Dock selection | Native destination tap | MobileLiquidDock calls same persistent lens hook | Same Anime geometry engine | 310 ms | 03-mobile-dock |
| Button compression | Primary pointer / Space / Enter on audited family | VelocityInteractions, same file; selector in `src/lib/animation/velocity-policy.ts` | waapi.animate | 85 ms, scale 0.965 | 02-buttons |
| Button release | Up/key-up; cancellation resets | VelocityInteractions | waapi.animate + spring | 200 ms spring, bounce 0.08; checked installed returned duration | 02-buttons / 03-mobile-dock |
| Tab indicator | Click / keyboard selection | TabsList → useNavigationLens | createScope + animate | 310 ms | 04-tabs-menus-dialogs |
| Menu/dialog entry | Radix mount | useVelocityPanel, same motion file | createScope, waapi.animate; animate + stagger on max 8 items | Container 180 ms; items 130 ms + 12 ms stagger | 04-tabs-menus-dialogs |
| Route entry | Existing view change | VelocityPage, same file | createScope + createTimeline | 170 ms | 05-route-transitions |
| Dashboard reveal | Dashboard mount | useVelocityReveal, same file; DashboardView | createScope + animate + stagger | 180 ms + 18 ms offsets, max 10 targets | 01 / 05; full runtime |
| Wordmark | Startup | `src/lib/animation/launch-wordmark.ts` | Existing Anime scope/timeline/wave plus WAAPI exit | **Unchanged five-second fill and fade** | Loader regression suite; existing recordings preserved |

Closing menus/dialogs remains **Radix presence + CSS 120 ms**, not a newly invented Anime exit. Existing accordion height, native toggles and feature-specific Framer flips/choices remain their existing owners. Dock outer presence remains Framer; Anime owns its child lens and button scale. Native sidebar width is now Anime-owned, with the old Framer aside removed. No property is deliberately owned by two engines. Simple CSS handles hover/focus; no per-frame React state.

Scopes/listeners/observers/frames revert or unregister; presses clear on cancel, blur, hidden tab and route boundary. Disabled, aria-disabled, aria-busy, inert and explicit press opt-outs are excluded. No default-action interception or drag requirement. Layout utilities were evaluated but not introduced: a single bounded width tween avoids an app-wide layout-measurement engine; its measured layout cost remains a limitation below.

## E. How to see it

1. Open the preview, wait for the preserved loader, choose **Explore/Continue as Guest**, then wait for its real workspace reveal.
2. Desktop: Dashboard → Group Study → Scholar Intelligence → Chapter Command Center → Notes → Dashboard. Watch the **same** lens move, then use the top-left collapse button. The rail keeps icons/current selection. Hover, Tab and rapidly choose destinations.
3. Notes: hover/focus **New Note**, hold the pointer to see compression, release to create a disposable local note. Use toolbar actions, Preview and Actions menu. Ctrl+K opens search; Escape closes it.
4. Settings: click a visible shared tab and use arrow keys. Only the selection carrier moves; text stays readable.
5. Mobile: open the bottom menu, tap Home/Study/Practice/AI, then More. The dock is touch-native, with a moving lens and no drag-to-navigate. Rotation and cancellation were tested.
6. E-Book: Continue reading opens the default Physics scan; use zoom/page tools. The toolbar responds; the page itself is not refracted or automatically animated.
7. General LAM: open the existing assistant, complete its normal introduction, inspect composer/actions and disabled empty Send. No AI request is required to observe the control refinement.

## F. Coverage and preserved boundaries

Audit artifacts: `test-artifacts/liquid-velocity-3/control-inventory.json` and `control-migration.json`. The migration changed **only explicit data attributes** in nine feature files; `verification/source-safety.json` proves stripping those attributes reproduces the normalized pre-edit source exactly, including every handler, provider call and assessment condition. Notes has separate, narrow creation-action/toolbar markup improvements.

Included: shared primary/outline/secondary/ghost/destructive families (destructive/link semantics retained), icon actions, navigation, shared tab triggers, dialog/dropdown/accordion/collapsible triggers, audited ccc action families, Exam actions/segments/toolbars, LAM native controls, reader tools, practice actions and a revision-mode helper. Existing states/loading/error/success remain truthful; no synthetic completion was added.

Deliberately unchanged: MCQ answer-content scale, formula/reading surfaces, calendar date grids, flip cards and Framer-owned Choice controls, custom public auth/marketing native controls and unaudited native families. They are not silently swept into a dangerous global `main button` selector. Shared controls used in these areas still inherit the material; their feature behavior is preserved. Not all native buttons in Scholar have been converted.

| Route / area | Implemented beyond the sidebar | Actual browser scope / remaining limit |
| --- | --- | --- |
| Dashboard | Named dash panels, shared actions, retained bounded reveal | Desktop/mobile; 11 sizes |
| Notes | Custom New Note actions, toolbar, shared dialogs/menus | Created/edited disposable local note; no account note |
| E-Book | Native reader tools/controls and header material | Real default Physics scan and zoom; private uploads/OCR not certified |
| Exam Ready | Named plates/actions plus 68 native action definitions across five files | Landing and policy-gated controls rendered; setup/classroom styles source/unit-checked, not passed off as a live study session |
| Chapter Command | ccc panel/action/mode families | Real default chapter workspace; no teaching call |
| Practice | Six action opt-ins; shared controls | Question bank rendered; academic option transforms explicitly excluded |
| Flashcards | Revision-mode helper, shared controls | Default collection; existing flip behavior retained |
| Planner / Resources / Mock | Shared controls and Card material where actually used | Routes opened; no AI schedule/paper generation/private library operation |
| Settings | Shared control/tab material | Keyboard/flags; no account/data mutation |
| General LAM | Native controls/composer chrome | Open/close/disabled state only; no microphone/message/provider configuration |
| Group Study | Shared controls where mounted, preserved entry | In-app/public entry checked; no authenticated multi-user room certification |
| Public homepage | Existing hero/form/navigation/footer/cinematic work retained; shared primitives still available | Inspected, not claimed as a native-control redesign |
| Private live-tutor / files / subscription workflows | No bypass or feature rewrite | Policy/security unit coverage; not live-account certified |

**Guest Exam boundary:** the visual harness blocks every API, including Guest capability discovery. Preparation creation therefore remains disabled. The attempted setup capture stopped at that native guard; no attribute was forced, no capability success fabricated, no provider/auth/Plus configuration changed. Existing guide/teaching/setup logic was not altered. This is not evidence of a completed live-AI Exam Ready journey.

## G. Visual evidence and acceptance

Root: `C:\Users\Lenovo\Desktop\SCHOLAR\Scholar-V1\test-artifacts\liquid-velocity-3`.

[Open all before/after screenshots, six recordings and raw validation](C:/Users/Lenovo/Desktop/SCHOLAR/Scholar-V1/test-artifacts/liquid-velocity-3/visual-index.md).

Original production baseline and final production sweeps are in **`before/`** and **`after/`**. Supplemental matched, settled captures are in **`comparison-before/`** and **`comparison-after/`**: dashboard, entire sidebar, active item, collapsed state, primary focus/press, secondary, Notes/editor toolbar, dropdown, dialog, tabs, Settings, Chapter Command, Exam landing, E-Book library/reader/toolbar, LAM/disabled control and mobile dashboard/dock.

Supplemental baseline came from an **isolated exact pre-edit source snapshot**, not an old remote branch or synthetic UI. It initially used development compilation for those screenshots; the final performance comparison uses production builds on both sides. Same Chrome, viewport, dark theme, Guest input and blocked API policy. The development framework debug widget alone was hidden. Date/video/cache frames, hover and font timing can vary; whole-page pixel identity is not claimed. `comparison-results.json` records actual held scale **0.965** and settled dialog opacity **1**. The academic scan remains sharp in the reader capture.

Six actual, normal-speed screen-recorded MP4s (raw WebM sessions also retained):

- `recordings/01-sidebar.mp4` — actual route sequence, hover, rail collapse/expand and rapid selections.
- `recordings/02-buttons.mp4` — native Notes action hover/focus/hold/release.
- `recordings/03-mobile-dock.mp4` — native taps, cancellation, More, keyboard-state branch and landscape.
- `recordings/04-tabs-menus-dialogs.mp4` — actual shared controls.
- `recordings/05-route-transitions.mp4` — real section navigation.
- `recordings/06-lightweight.mp4` — functioning, coherent zero-refraction fallback.

These are QA recordings, **not resumed cinematic LAM marketing production**. Full sessions preserve startup waits; excerpts are for inspecting interactions, not proving loading speed. The first main sweep could begin its Guest diagnostic sample while the reload overlay was still present; those numbers are not used as perceived-ready measurements. The quiescent profile explicitly waits for overlay removal.

The sidebar excerpt trims the initial startup wait at normal playback speed. A transient gray capture/compositor interval during its layout change remains visible; the recording is not a perfect-frame-rate claim. A final supplemental production-to-production pair also captures the actual Planner primary action and shared top-bar secondary action; its Radix trigger retains the shared Button class even though the outer slot reads `dialog-trigger`. The task dialog contained no disabled control, so no disabled state was fabricated; the real empty LAM Send is the disabled-state evidence. The initial supplemental attempt read a now-inert background trigger through an accessible-role locator after opening the modal; the harness was corrected to record its metadata before opening, with no application change.

Optical proof uses the **actual mounted NavigationLens**, not a substitute demonstration component: temporarily place a striped live backdrop beneath it, compare its filter off/on, restore normal appearance. Edge mean RGB difference **27.15**, center **4.47** (0–255 scale). See `verification/actual-lens-optics-{off,on}.png`, `optical-proof.json`, and normal sidebar captures. This is a signed-edge approximation, not a full physical Snell-law renderer.

Visual gate: whole sidebar clearly differs from the old flat plane; header/rows/lens belong together; the lens demonstrably occupies intermediate positions; compact rail stays usable; dock is more dimensional and readable; actual custom Notes press is visible; academic text remains undistorted; fallback has designed edges instead of an unstyled black rectangle. The remaining feature/platform/performance limits below are not treated as passed gates.

## H. Performance — measured, not universal claims

Windows, Chrome **156.0.8078.76**, local production builds; 1440×900, Quick optional preparation, same Guest preferences, all APIs blocked. No production RUM/Lighthouse or standardized INP claim. The preserved wordmark imposes a deliberate five-second minimum: **SVG wordmark content may not be represented in LCP candidates, so low LCP does not mean the website becomes usable in 152 ms.** Real reveal timing is separately recorded.

Cleaner **production-to-production profile**, no video encoder or concurrent test suite: one cold context and three same-context dashboard reloads per version. Warm frame sampling includes real collapse/expand during a bounded 120-frame window, not an invented FPS score. Raw values: `quiescent-profile.json`.

| Measurement | Pre-edit | 3.0 |
| --- | ---: | ---: |
| Public cold browser LCP candidate, one sample | 512 ms | 152 ms |
| Public cold CLS | 0.00310 | 0.00034 |
| Public cold long-task total | 838 ms | 817 ms |
| Warm dashboard LCP median (3) | 1008 ms | 628 ms |
| Warm dashboard LCP range | 160–1,316 ms | 124–704 ms |
| Warm dashboard CLS median | 0.00280 | 0.02751 |
| Warm long-task total median | 92 ms | 89 ms |
| Actual event-duration diagnostic median, **not INP** | 200 ms | 192 ms |
| Collapse/expand frame p95 median | 49.9 ms | 50.0 ms |
| Frames over 34 ms per 120, median | 6 | 9 |
| Warm overlay removed, navigation-relative median | 5722.6 ms | 5684.9 ms |

**Mixed result, not a universal speed claim.** Warm loading/event medians improved in this small local sample; CLS increased but remained below 0.1. Layout-motion p95 stayed around 50 ms on both versions, and the count of slow frames increased 6→9. One 3.0 event maximum was 208 ms, so no universal sub-200-ms or 60-FPS claim. Cold LCP was not replicated enough to infer a statistical improvement. Source snapshot build had no copied environment/credential files; APIs and Guest preferences were controlled, but cache/font/media/build differences remain possible confounders.

Recorded/throttled exploratory samples remain in `before/results.json` and `after/results.json`, including regressions: 4× CPU with 150 ms latency, 200,000 B/s down and 90,000 B/s up produced LCP **8,672 → 8,876 ms**, long tasks **5,232 → 5,833 ms** and frame p95 **33.4 → 50 ms** in one pair. Those throttled targets are **not met**. Recording/other browser activity and cache/font/video variance make those samples noisy; they are not hidden or replaced with an unqualified speed claim.

No new libraries/lockfiles. Stylesheet source: **7,196 → 19,560 bytes**, gzip of that source **2,023 → 4,633 bytes** (+2,610). This is not a minified delivered-CSS bundle delta. Observed decoded public script resources in the cleaner profile: **2,084,313 → 2,089,894 bytes** (+5,581); build identifiers/environment/caches may affect this route sample, so it is not a formal whole-bundle audit. No full-height displacement, per-button observers, cloned app scenes, persistent ambient motion or dozens of new compositor layers were introduced. Repeated named panels are paint-only; original optical budgets remain enforced.

## I. Tests and compatibility

- Final application production build passed (70 static pages); standalone TypeScript passed. `final-build.log`, `typescript.log`.
- Final isolated suite: **1,242 passed, 0 failed, 16 skipped**, 116 files; all live-service flags disabled. Focused final glass/loader tests: **14 passed**, 193 assertions. `unit-results-final.json`.
- Actual `bun run lint` remains **one pre-existing error** in untouched `src/components/landing/cinematic-video.tsx:120` (`react-hooks/refs`). A new test-only children-prop lint error was corrected; final scoped lint passed. No lint ignore/config workaround was added. `lint-final.log`, `scoped-lint-final.log`.
- Playwright startup/wordmark: **11 passed** (six browser flows plus five source guards). Five-second normal/reload behavior, actual session/profile boundaries, hidden pause, reduced motion and cleanup remain valid. `loader-tests.log`.
- Actual sidebar milestone passed: required sequence, moving persistent lens, width 256↔76, rapid interruption/alignment and reduced-motion immediate rail. `sidebar-milestone/results.json`.
- Real UI sweep: all **11 requested sizes** (320×700, 360×800, 375×812, 390×844, 430×932, 768×1024, 844×390, 1024×768, 1366×768, 1440×900, 1920×1080), no horizontal body overflow or uncaught page errors. Touch cancellation, More/Escape and keyboard-hidden-dock flag tested. Headless flags are not a physical software-keyboard test.
- Source safety confirms six loader/test files unchanged and nine feature migrations attribute-only. No assessment option or Framer Choice was swept into new scale behavior.

| Platform | Rendering policy | Actual verification |
| --- | --- | --- |
| Desktop Chromium | Bounded live-backdrop refraction on selected compact surfaces; high/balanced/paint-only modes | **Chrome 156 tested**, actual optical proof, controls, contrast/readability branches, light/large-text flags, glass-off and reduced motion |
| WebKit engine | Optimized non-refractive material | **Installed Playwright WebKit 26.5 tested**, normal/rail/dialog/reduced/light/glass-off; not a claim of Safari hardware certification |
| Firefox | Conservative non-refractive fallback | **Not rendered/certified**: matching cached revision absent; explicitly installed binary then failed to launch (`spawn UNKNOWN`). No security boundary was bypassed or browser installed |
| Android-like touch Chromium | Optimized shelf; at most one compact refractive lens if runtime permits | Touch emulation passed; **physical Android WebView untested**, no APK rebuild |
| iOS browsers / Safari | Non-refractive readable fallback by engine gate | **Physical devices/Safari untested**; WebKit engine test is not equivalent |
| Reduced motion / glass off | Immediate state changes; no decorative motion / no refraction | Real policy branches tested; no screen-reader/physical high-contrast certification claimed |

Developer-only baseline warnings included existing LAM image aspect-ratio and missing dialog-description warnings; these were not hidden as production crashes. Initial capture attempts caught QA mistakes: Guest init must preserve the state written by the real reload; a direct Group Study document is not the in-app shell; and Exam onboarding/disabled capability are real guards. Failed attempts are not counted as successful product flows.

## J. Research, safety and known limitations

Read the official [Anime React lifecycle](https://animejs.com/documentation/getting-started/using-with-react/), [scope](https://animejs.com/documentation/scope/), [timeline](https://animejs.com/documentation/timeline/), [spring](https://animejs.com/documentation/easings/spring/), [layout](https://animejs.com/documentation/layout/) and [WAAPI](https://animejs.com/documentation/web-animation-api/) references, alongside installed 4.5.0 behavior. Studied [Suthar's edge physics](https://github.com/sohumsuthar/liquid-glass), [dpawlikowski's replicated-scene composition](https://github.com/dpawlikowski/liquid-glass), [kwlck's live-backdrop controls](https://github.com/kwlck/liquid-glass-web), and [liquidglass.dev](https://liquidglass.dev/docs/). Checked all four actual MIT LICENSE files, including [gentpan's underlying source](https://github.com/gentpan/liquidglass/blob/main/LICENSE). No third-party code, photographs, skill installers or new libraries were copied/installed. Scholar keeps its own existing architecture and provenance.

Safety snapshot, taken before application edits:

`C:\Users\Lenovo\Desktop\SCHOLAR\.rollback-backups\2026-11-03-liquid-velocity-3`

Contains the initial working-tree patch, selective pre-edit source copies and README. The supplemental `preview-source` reconstructs the real pre-edit application outside tracked source; it contains directory junctions to existing node_modules/public, **not independent copies of those directories**. No credentials/env files were copied. Recover selectively from the top-level copied files, not by overwriting the current project or following junctions with destructive commands. Completed temporary QA servers were stopped; the current preview remains on 3024.

**No commit, push, deployment, production/domain/settings change, database operation/migration, real account setup, secret change, package installation or billable AI request occurred.** Existing loader work, Freebuff rollback, educational assets/reports, paused cinematic files, APKs, scratch projects and unrelated untracked work remain. No existing source, assets or user artifacts were deleted. The index and HEAD remain unchanged.

Remaining limits: not every native control is migrated; private/authenticated/live-AI and multi-user flows are not certified; Guest setup cannot be certified with capability requests blocked; Firefox/physical Safari/Android/iOS/IME/screen-reader checks remain outstanding. Actual layout-animation p95 still has headroom and throttled loading targets are not universally met. This is a substantial local material/control implementation ready for review, **not an assertion that all Scholar features, platforms and performance goals are universally complete**.
