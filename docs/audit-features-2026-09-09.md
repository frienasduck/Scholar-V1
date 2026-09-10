# Scholar feature inventory and initial code audit — 9 September 2026

This is a **code-inspection baseline**, created before product changes. “Inspected” does not mean rendered, exercised, or working. Runtime verification and fixes must be recorded separately by the main audit. No route in this document has been certified end-to-end by this inventory pass.

## Architecture and evidence

- Next.js 16 / React 19 client application. `src/app/page.tsx` dynamically loads `AppContent` with SSR disabled. `src/app/[...path]/page.tsx` re-exports it for every path.
- `src/components/app-content.tsx` chooses AuthScreen → Onboarding → AppShell from persisted Zustand and server subscription/session state.
- `src/components/app-shell.tsx` owns a 46-entry `VIEW_COMPONENTS` registry, browser `pushState`/`popstate`, desktop sidebar, mobile drawer/bottom navigation, search, footer, reminders, music, and LAM. All view modules are statically imported into this one client dependency tree.
- `src/lib/nav.ts` has 44 main navigation items, with four groups. Plus and payment views are additional routes. Nested tools generally use component state or sessionStorage targets, not separate Next pages.
- Local progress/notes/planner/social data lives in `src/lib/store.ts` and class-scoped helpers. Server authentication, subscription entitlement, quota, and intelligence APIs exist separately. Local persistence must not be described as cloud storage.
- `src/lib/subscriptions/entitlements.ts` contains the existing authoritative 18-capability registry. Class 9, selected tools, storage expansion and ad removal are Plus capabilities; Developer sessions are a separate server-side privilege source.
- `src/lib/v2/flags.ts` contains nine rollout flags. Midroll, LAM automation, offline sync, and push default off. Flags are not authorization.

## Reading the matrix

- Status **I** = implementation and wiring inspected, execution not tested. **P** = code-confirmed partial/misleading behavior. **C** = intentionally coming soon.
- Mobile **U** = unverified; **R** = inspected responsive classes exist, unverified in a browser; **Risk** = concrete sizing/interaction risk requiring browser reproduction.
- Auth **local/guest** = view opens in the shell for a guest, with local persistence. AI calls still require a server account where the API enforces it. This is not an assurance of guest AI availability.
- **A** = AI support/operation; **optional** = feature has non-AI operations too. Plus notes describe current wiring, not business recommendations.
- All rows also inherit the shared eager-import/startup, motion/background, and navigation issues described below.

## All registered feature routes

| Feature | Route / view | Status | Mobile | AI | Auth / data | Plus / restriction | Performance or UX evidence | Decision |
|---|---|---|---|---|---|---|---|---|
| Landing / login / registration | `/` while unauthenticated; AuthScreen state | I | R | None | Server login/register + Guest entry | Class 9 is plan-sensitive after sign-in | Client-only loading gate; no independent public landing metadata; name placeholders hardcoded | Keep, improve |
| Onboarding | Pre-shell state, no dedicated URL | I | U | None | Local onboarding/profile | Class entitlement must agree with server | Session restore and class selection need real-flow tests | Keep |
| Dashboard | `/`, alias `/dashboard` | I | Risk | Optional daily challenge | Local study data | Class 9 | Large editorial hero precedes immediate study actions; ReadyBackgroundVideo | Keep, improve hierarchy |
| Scholar Intelligence | `/intelligence` | I | R | Deterministic evidence engine, not LLM for core metrics | Local evidence + `/api/v2/intelligence/*` sync | Deeper weekly insights | Real evidence, mastery, weak topics, mistakes, revision queue, exams, daily brief; separate entitlement fetch | Keep; prioritize real evidence |
| Chapter Command Center | `/chapter-command` | I | U | Optional explanations, doubt resolution | Class-local progress/reminders | None at shell | Large multipurpose view; integrates chapter data and mistakes | Keep, improve |
| AI Tutor | `/ai-tutor` | I | Risk | Chat / streaming | Account required for API; local threads | One first-answer Plus card | Chat header/composer/long math need mobile exercise | Keep; flagship repair |
| AI Tools | `/ai-tools` | P | Risk | Twelve tools listed below | Account required for API | AISIG and Homework Scanner | Large module; absolute Plus badges overlap long names at narrow widths; Memory Predictor invents dates | Keep, improve/hide invalid prediction |
| Notes | `/notes` | I | Risk | Optional summary | Local notes/folders/versions | None | Autosave, folders, markdown preview; inline preview enforces 1fr 1fr even on phone | Keep, protect drafts |
| Flashcards | `/flashcards` | I | R | Optional generator | Local review state; AI account | Generation limits depend on shared API | Class-specific implementation, revision portal, pending generator state | Keep |
| Quiz / quiz generator | `/quiz` | I | R | Optional generator | Local attempt data, server AI quota | Extra generation allowance | Class-specific quiz flows/timers/results; actual generate-answer-score flow required | Keep |
| Planner | `/planner` | I | R | Optional planner | Local tasks | None at shell | Month/week/list, creation and editing; tiny calendar cells on phone need test | Keep |
| Focus | `/focus` | I | U | None | Local focus sessions | None | Timer lifecycle/background throttling requires real-time test | Keep |
| Resources / library | `/resources` | I | U | Optional assistant | Curriculum/local | None | Class-specific resource browsing and background video | Keep |
| Analytics | `/analytics` | I | U | None for core charts | Local attempts/sessions | None at shell | Charts and animated/video presentation; truth of empty metrics needs check | Keep |
| Achievements | `/achievements` | C | R | None | Local shell | Nav falsely presents Plus benefit | Registry points to ComingSoon; old achievements.tsx exists but is not selected | Hide unfinished promotion; preserve old code/data |
| Community / forum / Q&A / groups | `/community` | P | U | AI personas simulate replies | Local store, no real social backend in this view | No developer gate found | Copy says classmates are here, some AI; auto-generated replies and local groups | Hide from primary navigation or explicitly label preview |
| Files | `/files` | P | R | Optional auto-tag | Account; local bytes, server quota metadata | Larger quota | Upload awaits AI tags, discards tags; >20MB metadata has no bytes; read/network failures can leave spinner; delete ignores server failure | Keep; urgent reliability/data fix |
| Store | `/store` | P | R | None | Account + API authorization, local coins/purchases | Some catalog products | Downloads only generate product description/contents as markdown; no buy loading guard/network catch | Restrict unfinished goods; keep usable themes |
| Exam Prep | `/exam-prep` | I | U | Mock questions/revision | Account for AI, local content | `exam_prep` | Generator and export flows need real results; overlaps with Mock Exam but purpose differs | Keep; cross-link |
| Mind Map | `/mindmap` | P | U | Optional generation | Local | Sidebar redirects to Plus; command palette opens view | Inconsistent entry-point behavior and advertised readiness | Restrict/clarify, do not delete |
| Concept Galaxy | `/galaxy` | P | U | Optional | Local | Sidebar redirects to Plus; command palette opens view | Continuous interval motion; unsupported readiness claim in nav | Restrict/clarify |
| Formula Explorer | `/formulas` | I | U | Optional explanation/practice | Curriculum/local, account for AI | `formula_explorer` | Wide equations/interactive cards | Keep |
| Study | `/study` | I | U | Optional explanations | Curriculum/local progress | None at shell | Study action → chapter progress integration | Keep |
| E-Book | `/ebook` | I | Risk | ELAM, inline answers, OCR, questions | Local reader state; protected APIs | OCR/capability dependent | PDF/book reader, source scan, Math/Chem systems; immersion and nested scrolling | Keep; targeted lazy load |
| Question Practice | `/practice` | I | U | Optional help | Curriculum/local attempts | None at shell | Questions, review/mistake integration | Keep |
| Settings / profile | `/settings` | I | Risk | LAM configuration | Local preferences + server session | Some appearance controls, Class 9 | Ten tabs in rounded wrapping container; typography/font previews restricted in places | Keep; clearer navigation/filter |
| Friends | `/friends` | P | U | Every reply is AI roleplay | Local simulated friends/requests | No developer gate found | No AI label in main UI; request manufactured after two messages; artificial response delay | Hide preview or clearly disclose simulation |
| Nigtube | `/nigtube` | I | Risk | Summaries/quizzes/flashcards | Static video catalog + local saved/history | Ad-free entitlement | YouTube embed and search fallback; static view counts/upload times; category chip compression; actual player lifecycle test needed | Keep; remove misleading stats |
| Experiment Lab | `/lab` | I/P | Risk | Optional guidance | Local completion | None at shell | Native simulations include calipers/screw gauge/pendulum; unsupported experiments marked coming soon | Keep working simulations; label incomplete |
| Levels | `/levels` | I | U | Optional | Local progression | `levels` | Large animated route; progression scoring and rewards need integrity tests | Keep |
| Past Papers | `/past-papers` | I | U | Optional explanation | Local answers/mistakes | None at shell | Timed practice/import/review; check claims of source material | Keep |
| Answer Lab | `/answer-lab` | I | U | Evaluation/model feedback | Local answers, account for AI | None at shell | Structured feedback/rendering must be validated | Keep |
| Revision Hub | `/revision-hub` | I | Risk | Optional revision help | Local spaced repetition/mistakes | None at shell | Due/weak/forgotten/mistakes/history tabs; integrate Intelligence instead of second truth | Keep, unify evidence |
| Mock Exam | `/mock-exam` | I | Risk | Generate/evaluate | Local paper/result history + account AI | Quota/capability dependent | Generation review, timer, scoring/report, ebook question source | Keep |
| Goal Center | `/goal-center` | I | U | Optional suggested plan | Local goals/tasks | None at shell | Goal creation/completion and actual progress need test | Keep |
| Smart Reminders | `/reminders` | I | Risk | Optional suggestions/natural-language; browser speech | Class-local store | Automation/push flags separate | Today/upcoming/calendar/all/completed/templates/activity; scheduler/talk/privacy/recurrence | Keep; timezone/lifecycle checks |
| Doubt History | `/doubt-history` | P | U | Optional retry/help | Class-local history | None at shell | Seeds eight fictional past questions per profile instead of honest new-user empty history | Improve: no invented user history |
| Downloads | `/downloads` | P | U | Optional generated content | Local generated download catalog | None at shell | Static catalog generates templates; mock output can be generic instructions, not promised full paper; simulated interval progress | Improve honest labels/content |
| Assignments | `/assignments` | I | U | Optional answer/review | Seeded local assignments | `assignments` | Curated practice seeds must be distinguished from actual assigned work | Keep, clarify |
| Study Workspace | `/workspace` | P | Risk | AI-chat widget | Local widget layout | None at shell | Sixteen widgets; music is explicitly a mock equalizer with no playback | Keep; connect real music/remove inert widget |
| Study Music | `/music` | I | Risk | None; speech promo | YouTube player/local playlist | Ad-free entitlement | Persistent widget, playlist/focus view; spoken promo and overlay can obstruct controls | Keep; actual playback verification |
| Canvas | `/canvas` | I | Risk | Optional imported OCR/text | Local canvas objects/pages | None at shell | Touch drawing, pan/zoom, save/import/export; large client module | Keep; defer bundle |
| Toolbox | `/toolbox` | I | Risk | None | Local | None | Twelve actual utility types; controlled periodic table/graph scrolling | Keep; searchable entries |
| Practical Lab | `/practicals` | I | U | Optional guidance | Curriculum/local | `practical_lab` | Procedures/observations/guidance distinct from Experiment Lab | Keep; clarify distinction |
| Python Workspace | `/python` | I | Risk | Optional code assistance | Browser runtime + account AI | `python_workspace` | Pyodide/browser runtime must lazy load; stop/timeout and mobile editor exercise | Keep |
| Derivation Library | `/derivations` | I | U | Optional explanations | Curriculum/local | `derivation_library` | Math containment/accessibility | Keep |
| Scholar Plus | `/plus` | I | R | None | Guest gated in shell; server entitlement | Upgrade surface | Pricing/features/manual purchase flow need reconcile against currently usable benefits | Keep, accurate value proposition |
| Payment request / proof | `/subscription-payment` | I | R | None | Account + server payment APIs | Pending/rejected/approved states | Upload proof, reference/status, manual review; avoid falsely implying instant automated billing | Keep |
| Admin payment review | `/admin/subscriptions/payment-requests/[id]` | I | U | None | Server admin check | Admin only | Only non-shell product page discovered; review/approval tests required | Keep restricted |
| Unknown route | Any unmatched catch-all | P | U | None | Same client shell | Same session gate | Unknown paths and extra path segments silently resolve dashboard/current first segment; no true not-found behavior | Fix registry validation + branded 404 |

## Secondary feature inventory

These are component states inside the route above; they are not additional public URL routes.

| Container | Discovered user operations | Dependency / initial finding |
|---|---|---|
| AI Tools | AI PDF Studio; Mistake Analyzer; Memory Predictor; Academic Coach; One-Night Exam Mode; Homework Scanner; Daily Briefing; Chapter Builder; Life Saver; Study Companion; AISIG; Slideshow Maker | Shared `askAI`/`askAIJSON`, OCR, image APIs. Memory Predictor's random dates are not evidence. PDF history key is global `pdf-studio-history`, unlike class/profile helpers. |
| Slideshow Maker | Topic/notes/chapter generation, editing, theme/layout selection, regenerate, PPT/PDF export, narrated presentation | Huge module; server quota and schema; narration/browser voices. Must test complete export/narration. |
| E-Book | Book picker; reader/book mode; Clean PDF/Original Scan; Math/Chem datasets; page/chapter navigation; inline answer/ELAM; OCR; question bank | External/local PDF asset and AI dependencies; file ownership/output isolation deserve check. |
| Intelligence | Overview, mastery, weak topics/patterns, mistake book, revision queue, exam intelligence, daily brief, weekly report | Evidence-derived local engine and server sync; baseline capture; no fabricated analytics needed. |
| Smart Reminders | Quick add interpretation, editor, recurrence, alerts, templates, snooze, conflict preview, talk reminder, settings, custom commands, activity | Browser notifications and speech require explicit permission; push flag off means closed-app notification promises must be limited. |
| Settings | Account/profile/avatar; Academic/class/JEE/subjects; Subscription; Appearance/theme/font/density/accessibility; LAM/voice/modes; Privacy; Notifications; Update Logs; Data/export/reset; Developer | Local store + server developer/auth/Plus endpoints; each destructive control needs recovery/confirmation test. |
| Workspace | Timer, quick notes, AI chat, stats, to-do, flashcards, calculator, whiteboard, formulas, calendar, music, sticky notes, subject progress, upcoming tasks, next action, daily quote | Music explicitly mock; local widgets duplicate destinations but can link actual feature workflows. |
| Toolbox | Standard calculator, scientific calculator, unit converter, periodic table, stopwatch, countdown, world clock, graph plotter, random generators, physics calculator, chemistry calculator, math utilities | No AI requirement. Check math accuracy/units and local scroll; no giant dependency needed. |
| Community | Forum, Q&A, study groups, reply/answer, group chat | Store-backed and AI-generated; cannot be presented as real multiplayer communication. |
| Friends | All/friends/requests tabs, simulated chat, accept/reject requests | Every response uses friend persona; relationship events locally manufactured. |
| Nigtube | Catalog/subject filters, search, saved/history, playlist, playback, comments, summary/quiz/flashcards, YouTube fallback | YouTube loading/error + quota + ad state; static popularity numbers should not masquerade as live data. |
| Study Music | All Music, My Playlists, Focus Session, playlist editor, sticky mini/expanded player, shuffle/repeat/seek/volume | YouTube iframe singleton; spoken first-party promotion; bottom mobile overlap needs real test. |
| Notes | Folders/list/editor mobile tabs, create/search/pin/archive/delete, autosave, version restore, tags, Markdown preview, summary, PDF export | Existing delete confirmation and versions should be retained. Inline side-by-side preview is a phone sizing risk. |
| Files | Upload/filter/search/preview/download/delete, storage meter, attempted auto-tags | No rename/folder operation discovered here; no hosted storage upload implementation in this view. |
| Global overlays | Command palette, LAM capsule/panel, class-transition overlay, mobile sidebar, notifications/task tray, install prompt, Plus popup, music widget | Z-index stack ranges beyond 10000; keyboard/focus/dismissal and overlapping promotions need centralized coordination. |
| Monetization | Plus page, shell popup, FreeAdSlot, ScholarPlusPromo, Nigtube preroll/midroll orchestrator, music speech promo, tutor first-answer card, generation usage indicator, payment/proof/admin review | No external ad network observed in these components; use honest first-party promotion labels. Several independent promos can coincide. |

## Prioritized concrete findings

1. **Data reliability / blocking wait — Files:** `FilesView.handleUpload` awaits the AI tag request inside the file loop while `uploading` stays true; tags are then discarded. A large file over 20MB can be registered and counted without storing any bytes. FileReader lacks error handling; network errors bypass resetting busy state. Server quota registration precedes local save; delete silently ignores network/API failure before removing the only local copy. Repair before expanding file advertising.
2. **Invented academic data — Memory Predictor:** `ai-tools.tsx` chooses `Math.floor(Math.random() * 14)` for last-study time, feeds it to AI as actual history, and labels progress as mastery. Replace with measured evidence or honest unavailable state. Doubt History likewise seeds fictional past questions.
3. **Misleading feature access — unfinished benefits:** sidebar `item.plus` always opens Plus for Achievements/Mind Map/Galaxy, including Plus users; command palette navigates directly. Achievements resolves Coming Soon. Stop selling unavailable screens as delivered benefits and centralize route/access policy.
4. **Startup bundle:** all view imports are eagerly reachable from AppShell, including AI tools/slides, canvas, charts, lab and Python. Defer feature modules with one shared loading/retry surface. Existing outer dynamic import only moves the entire heavy tree behind “Loading Scholar…”.
5. **Navigation quality:** unknown URL/extra segments silently render dashboard; route buttons don't expose `aria-current`; topbar profile is a noninteractive div; sidebar has ~44 items and persistent animated NEW badges; search indexes only destinations and two hardcoded Class 11 ebooks.
6. **Mobile sizing:** topbar still includes coin/streak chips without narrow-screen hiding or guaranteed input shrink; notes preview enforces two columns; settings tab container is a pill with wrapping items; AI tool Plus badges use absolute positioning; content-specific filters can shrink labels. Whole-page `overflow-x:hidden` masks overflow instead of correcting child constraints.
7. **Background lifecycle:** ReadyBackgroundVideo preloads auto, loops and plays with no visibility, offscreen, save-data, or reduced-motion policy; most other views embed raw autoplay video too. Keep posters and video identity, pause hidden and constrained sessions; do not globally remove ambience.
8. **Errors and accessibility:** ViewErrorBoundary prints raw `error.message` to users. Command palette hides close button despite being mobile. Several icon controls have title only. Unused LockedSection returns before useCallback when devMode toggles, violating hook ordering if reused.
9. **Social truth:** Friends silently simulates people, requests and typing with AI; Community includes AI tags but no real social transport. Primary-navigation promotion of these surfaces undermines trust. Preserve experimental code/data while hiding or explicitly labeling simulation.
10. **Store deliverable quality:** non-theme products download only description/bullet contents as `.md`, not the actual promised study asset. Restrict incomplete products or supply real assets. Network failure/busy-state handling missing in purchase handler.
11. **Professional public presence:** footer hardcodes Ishan/Neha, doubles labels on phone, has no support/legal/account navigation, and claims v5.0 despite later changelog. Robots allows everything; no sitemap, canonical/OG metadata, or branded error pages discovered.
12. **Fonts/motion:** root loads Inter/JetBrains/Poppins/Source Serif plus view-injected remote font imports (including another Inter). Many all-caps NEW pulse badges and always-on effects survive in the primary nav. Remove duplicate font work and use existing reduced-motion preferences consistently.
13. **Promotion coordination:** FreeAdSlot claims sponsor space but is a house promotion. App-open popup can overlap first-answer, music, or player promotions; `localStorage` access there lacks a failure guard. Confirm ad-free users never receive transient promo before entitlement loading completes.

## Runtime verification still required

The main audit should append separate evidence for signed-out, Guest, Free, Plus, and Developer sessions; login/register/logout/restore; provider text/JSON/image/voice/OCR; complete quiz/flashcard/slideshow results; file persistence; notes autosave; protected APIs; media play/error/fallback; search keyboard navigation; sheets/dialogs; and responsive widths 320–1920. Paid/provider calls and destructive data operations should use authorized test fixtures, never manufacture successful test reports.

No product feature was removed or changed by this inventory. No existing data was modified. Android is excluded.
