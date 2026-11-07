# Project Shrinking Scholar — Implementation Report

2026-11-07 · existing `Scholar-V1` working tree · branch `main`

## A. Summary

The working tree already contained a partial consolidation layer (merged route
ids, workspace tabs and legacy aliases). This task verified that foundation
against the actual code, fixed the gaps that made it incomplete, and added the
missing unified plugin system and documentation.

Changes made in this task:

1. Added the missing **Doubt Lab** primary navigation destination.
2. Added a structured **LAM plugin registry** (`src/lib/lam/plugin-registry.ts`)
   with category, description, aliases, availability, entitlement and
   attachment requirements.
3. Rebuilt the LAM **plugin browser** around grouped categories, a searchable
   list and an explicitly disabled "Coming later" section.
4. Upgraded the composer `@` selector: searchable aliases, arrow-key navigation,
   Enter/Tab selection, Escape dismissal and a removable plugin **chip**.
   Selecting a plugin no longer executes it; Send (a user action) opens it.
5. Fixed the **Doubt Lab background video** composition for a 1920×1080 source:
   centred desktop crop, full-frame portrait fit, poster fallback, reduced-motion
   fallback, muted/no-audio playback.
6. Replaced the Resources/Downloads fade with a 240 ms, direction-aware
   **anime.js slide** on a two-panel track. Downloads still lazy-loads the first
   time it is opened; visited panels stay mounted so state does not remount.
7. Added a one-time **Scholar Intelligence consent prompt** for authenticated
   accounts with no stored choice, with equal Enable / Not now actions and no
   preselection. Declining is stored so it does not repeat.
8. Added `tests/shrinking-scholar.test.ts` covering legacy routes, required
   search aliases, plugin registry integrity, Plus gates and navigation.
9. Added this report and `docs/shrinking-scholar-inventory.md`.

No feature view was deleted. No route was removed. No storage key, Prisma model,
entitlement or API was renamed. No commit, push, deployment or migration ran.

## B. Navigation map

| Old destinations | New primary destination | Modes |
|---|---|---|
| Question Practice + Quiz + Past Papers | **Question Practice** | Practice · Quizzes · Past Papers |
| Answer Lab + Doubt History | **Doubt Lab** | My Doubts · Solve a Doubt |
| Practical Lab + Experimental Lab Plus | **Experiment Lab** | Experiments · Practicals |
| LAMTube + Study Music | **Study Media** | LAMTube · Study Music (both paused) |
| Scholar Intelligence | **Settings → Scholar Intelligence** | Settings category |
| AI Tutor + AI Tools + LAM AI | **LAM AI** | Chat · Tutor · Plugins |
| Resources + Downloads | **Resources** | Library · Downloads |
| Downloads entry in Settings | Settings → Downloads | Opens Resources / Downloads |

Primary sidebar now contains: Dashboard, Group Study, Chapter Command Center,
Study, E-Book, **Question Practice**, **Doubt Lab**, **Experiment Lab**,
**LAM AI**, **Study Media**, Notes, Resources, Levels, plus the existing Revise,
Extra and More sections. Quiz, Practice, Past Papers, Answer Lab, Doubt History,
Lab, Practicals, LAMTube, Study Music, AI Tutor, AI Tools, Intelligence and
Downloads are no longer primary entries; they still resolve as legacy routes.

## C. Routing compatibility

The application uses one App Router catch-all:
`src/app/[...path]/page.tsx` → view id via `src/lib/routes.ts` →
`resolveScholarDestination` in `src/lib/shrinking-scholar.ts` →
`app-shell.tsx` dynamic view. No new router was introduced.

| Old URL / id | Resolves to | Mode |
|---|---|---|
| `/practice` | `/question-practice` | practice |
| `/quiz` | `/question-practice` | quiz |
| `/past-papers` | `/question-practice` | past-papers |
| `/answer-lab` | `/doubt-lab` | solve |
| `/doubt-history` | `/doubt-lab` | history |
| `/lab` | `/experiment-lab` | experiments |
| `/practicals` | `/experiment-lab` | practicals |
| `/nigtube`, `/lamtube` | `/study-media` | lamtube |
| `/music` | `/study-media` | music |
| `/live-tutor` | `/lam-ai` | chat |
| `/ai-tutor` | `/lam-ai` | tutor |
| `/ai-tools` | `/lam-ai` | plugins |
| `/downloads` | `/resources` | downloads |
| `/intelligence` | `/settings#intelligence` | Settings |

The URL is normalised with `history.pushState` while old route files remain
valid, so existing bookmarks do not 404 and no redirect loop is created.
The active sidebar item reflects the merged destination.

## D. Question Practice

- Wrapper: `src/components/views/question-practice.tsx`.
- Reuses the existing `PracticeView`, `QuizView` and `PastPapersView` through
  `next/dynamic`; opening Practice does not eagerly load the other two.
- Practice retains class/subject/chapter/topic selection, difficulty, question
  types, submission, feedback, explanations, session progress, results and
  history. The verified page shows 323 Physics questions and chapter cards with
  real counts.
- Quizzes retain the existing quiz engine and saved attempt state.
- Past Papers retain source filters, year/category, preview, answer keys,
  marking schemes and download behaviour.
- Activity history is still owned by each existing feature. No incompatible
  scores were merged into a single misleading statistic.

## E. Doubt Lab

- Wrapper: `src/components/views/doubt-lab.tsx`.
- History is the default mode and reuses `DoubtHistoryView`.
- Solve mode reuses `AnswerLabView` and therefore the existing answer/AI
  pipeline; no second AI runtime was built.
- Verified in the guest workspace: My Doubts shows 8 saved records with search,
  subject/source/status/date filters, starred, clusters and by-subject views.
- Background video fix in `src/components/views/doubt-history.tsx`:
  - Source probed with `ffprobe`: **1920×1080, 8.04 s**.
  - Previous `object-position: 72% 50%` pushed the focal area right and cropped
    the opposite side on portrait screens.
  - New `.dh-video`: `object-fit: cover; object-position: 50% 45%`.
  - Under `max-aspect-ratio: 4/5`, `object-fit: contain; object-position: 50% 40%`
    shows the full frame instead of cutting its sides.
  - Poster/gradient fallback behind the video; `prefers-reduced-motion` hides
    the video; remains `muted`, `loop`, `playsInline`, no audio autoplay,
    `disablePictureInPicture`, `preload="metadata"`.
- Overlay remains `bg-black/55`; content column is `relative z-10`, so the
  solving interface keeps readable contrast and no horizontal overflow is
  introduced.

## F. Experiment Lab

- Wrapper: `src/components/views/experiment-lab.tsx`.
- **Experiments** reuses `LabView` and its interactive simulations.
- **Practicals** reuses `PracticalsView`, wrapped in the existing
  `PlusGate entitlement="practical_lab"`.
- Server authority remains `src/lib/subscriptions/entitlements.ts`; the gate is
  presentation only. No entitlement was changed or bypassed.
- Legacy `/lab` and `/practicals` reach the correct mode.

## G. Study Media

- Wrapper: `src/components/views/study-media.tsx`.
- Uses the existing `SectionShutdown` UI for both modes and shows a **Paused**
  badge on each tab.
- Verified: Study Music renders "Study Music is taking a pause." with its
  licensing explanation; LAMTube uses the same shutdown state.
- No player, video generation, audio playback or paid provider is loaded.
- `/nigtube`, `/lamtube` and `/music` resolve to the correct paused mode.

## H. Scholar Intelligence

- Removed from primary navigation; `intelligence` resolves to
  `Settings → Scholar Intelligence`.
- Existing controls in `src/components/settings/scholar-intelligence-settings.tsx`
  remain: enable/disable, privacy explanation, data categories, last sync,
  view profile, clear profile.
- New `src/components/personalization/intelligence-consent-prompt.tsx`:
  - only for `access.authenticated`, never guests;
  - only while the stored consent is `null`;
  - no preselected option; Enable and Not now use equal visual weight;
  - "Not now" writes `declined`, which prevents the prompt repeating;
  - does not block the app (non-modal banner).
- Consent remains profile-scoped in `src/lib/v2/intelligence/consent.ts`.
  Previous use is not treated as consent; the key is separate and starts null.
- Disabled behaviour is enforced, not just hidden:
  - `IntelligenceView` returns a consent gate unless consent is `granted`.
  - `loadSyncState` returns `"off"` unless `isIntelligenceEnabled` is true.
  - `syncEvidence` returns `"off"` and refuses to sync without consent.
  - `clearIntelligenceProfile` removes only derived intelligence keys and the
    consent choice; quizzes, notes, practice and account records are untouched.

## I. Unified LAM AI

- Wrapper: `src/components/views/lam-ai.tsx`; modes Chat / Tutor / Plugins.
- Chat reuses the real `LiveTutorView` conversational implementation, including
  streaming, personality, memory, sessions, attachments and voice. LAM's
  existing mark, avatar and identity are preserved.
- Tutor reuses the real `AITutorView`; no second AI runtime.
- Plugins reuse the real `ToolContent` router in
  `src/components/views/ai-tools.tsx`.
- Desktop conversation history remains in LAM's existing Sessions panel rather
  than a new permanent sidebar; this avoids duplicating session storage.
- Composer now supports the registry-backed `@` selector and a removable chip.
  The chip is presentation only; the plugin opens only when the student sends.
- Chat context uses the existing `scholar:lam-context` events. Context is
  updated by real page context, not invented, and can be inspected in the
  Learning awareness panel.

## J. Plugin inventory

Available means a real `ToolContent` implementation exists. Tests below are the
automated registry/alias tests; live execution was not possible without an
authenticated account (guest gate blocks LAM AI).

| Plugin | Availability | Source adapter | Backend | Inputs | Entitlement | Test |
|---|---|---|---|---|---|---|
| PDF Generator | Available | `ai-pdf-studio` | `/api/ai` via `askAI`/`askAIJSON` | prompt, optional text/PDF | Free | registry + alias pass |
| Mistake Analyzer | Available | `mistake-analyzer` | `/api/ai` | prompt, optional text/PDF | Free | registry + alias pass |
| Memory Predictor | Available | `memory-predictor` | `/api/ai` | none | Free | registry pass |
| Academic Coach | Available | `academic-coach` | `/api/ai` | prompt, optional file | Free | registry + alias pass |
| One-Night Exam Prep | Available | `one-night-exam` | `/api/ai` | prompt, optional file | Free | registry + alias pass |
| Homework Scanner | Available | `homework-scanner` | `/api/ocr` + `/api/ai` | image required | `homework_scanner` | gate test pass |
| Daily Briefing | Available | `daily-briefing` | `/api/ai` | none | Free | registry pass |
| Chapter Builder | Available | `chapter-builder` | `/api/ai` + PDF export | prompt, optional file | Free | registry pass |
| Life Saver Button | Available | `life-saver` | `/api/ai` | none | Free | registry pass |
| Study Companion | Available | `study-companion` | `/api/ai` | none | Free | registry pass |
| AISIG | Available | `aisig` | `/api/ai` + `/api/ai-image` | prompt | `aisig` | gate + alias pass |
| Slideshow Generator | Available | `slideshow-maker` | `/api/ai/slideshow` | prompt, optional notes | `slideshow_generation_plus` quota | registry + alias pass |
| Concept Explainer | Planned | — | — | — | — | disabled |
| Flashcard Maker | Planned | — | — | — | — | disabled |
| Revision Planner | Planned | — | — | — | — | disabled |
| Document Summarizer | Planned | — | — | — | — | disabled |
| Weekly Review | Planned | — | — | — | — | disabled |
| Citation Helper | Planned | — | — | — | — | disabled |
| Notes Formatter | Planned | — | — | — | — | disabled |
| Study Guide Builder | Planned | — | — | — | — | disabled |

The browser never advertises a planned entry as Available; planned cards are
`aria-disabled`, non-clickable and labelled "Planned".

## K. Attachments

Existing infrastructure was reused (`src/lib/lam/attachments.ts`):

- Accepted: `.txt`, `.md`, `.markdown`, `.csv`, `.json`, `.pdf`; 15 MB per file;
  up to four files per message; PDF text extraction up to 30 pages and 6,000
  excerpt characters.
- Images are not advertised as accepted by the composer because the text reader
  cannot inspect them. The Homework Scanner has its own image pipeline.
- File chips show name, pages/characters, removal, busy and error states.
- Text is composed into the message only when the student sends. No provider is
  called on file selection.
- Attachment content is sent with the authenticated request; no storage URL or
  cross-user path is exposed.

## L. Resources and Downloads

- `src/components/views/resources.tsx` now renders a two-panel track (200%
  width) with Library and Downloads at 50% each.
- Downloads enters from the right; returning to Library slides back. Duration
  240 ms with anime.js `inOut(2)`, reduced-motion sets the transform directly.
- The inactive panel is `inert` and `aria-hidden`; tab roles and
  `aria-selected` are retained.
- Downloads is `next/dynamic` with `ssr: false` and is mounted only after the
  first open; it remains mounted afterwards so progress does not reset.
- Verified: clicking Downloads selected the tab and swapped to the real
  `DownloadsView` (372 catalog items, storage stats, download actions).
- Settings already had a Downloads entry (`DownloadsSettings`) that opens
  `resources` in downloads mode; no second download manager was added.
- Existing `dl-downloaded` / `dl-offline` storage keys are unchanged.

## M. Search aliases

`src/components/inline-search.tsx` uses `searchScholarAliases` and shows the
destination detail (for example "Question Practice · Quizzes"). Legacy terms
verified by test:

| Query | Destination |
|---|---|
| Question Practice / Practice Questions | Question Practice · Practice |
| Quiz / Quizzes | Question Practice · Quizzes |
| Past Papers / PYQ / Previous Year Questions / Question Bank | Question Practice · Past Papers |
| Answer Lab / Solve a Doubt | Doubt Lab · Solve a Doubt |
| Doubt History / Doubt Lab / My Doubts | Doubt Lab · My Doubts |
| Practical Lab / Experimental Lab / Experimental Lab Plus | Experiment Lab · Practicals |
| Experiment Lab / Lab | Experiment Lab · Experiments |
| LAMTube / Study Media | Study Media · LAMTube (paused) |
| Study Music | Study Media · Study Music (paused) |
| LAM AI / AI Chat | LAM AI · Chat |
| AI Tutor | LAM AI · Tutor |
| AI Tools / PDF Generator / Mistake Analyzer / Academic Coach / One Night Exam Prep / AISIG / Slideshow Generator | LAM AI · Plugins + plugin id |
| Resources / Library | Resources · Library |
| Downloads / My Downloads / Saved Files | Resources · Downloads |
| Scholar Intelligence / Personalization / Learning Intelligence | Settings · Scholar Intelligence |

Selecting a result sets the mode, Settings category or plugin target in
`sessionStorage` before navigation. Old URL query parameters are not stripped or
rewritten; the existing view code remains responsible for its own parameters.

## N. Data preservation

| Area | Status |
|---|---|
| Prisma schema / database | Unchanged; no migration executed |
| Quiz / practice / past-paper history | Existing view state and keys reused |
| Doubt records | Existing `DoubtHistoryView` data reused |
| LAM conversations and sessions | Existing `/api/lam/live/sessions` and storage reused |
| Attachments | Existing reader and limits reused |
| Downloads | Existing `dl-downloaded`, `dl-offline` keys reused |
| Scholar Intelligence | Existing consent and derived keys reused; clear removes only derived keys |
| Entitlements | No entitlement added, renamed or removed |
| Asset URLs / domain | Unchanged; `https://scholarofficial.vercel.app` not touched |

Migration needed: none. The new plugin registry is client-side metadata; it
stores no student data.

## O. Visual evidence

Captured from the running local application at `http://localhost:3000`:

![Question Practice — merged modes](evidence-question-practice.png)

![Doubt Lab — My Doubts with the real saved history](evidence-doubt-lab.png)

![Study Media — both services paused](evidence-study-media.png)

The Resources/Downloads switch was additionally verified from the accessibility
snapshot: the Downloads tab became selected and the full Downloads view (372
catalog items, storage stats, download actions) replaced the library. A PNG
capture of that state could not be written because the preview window was not
being drawn at capture time.

The live search was likewise verified in the browser: typing `Quiz` opened a
12-option listbox whose top result was **Quiz — Question Practice · Quizzes**,
followed by Practice and Past Papers aliases. No search result 404s.

## P. Testing

Executed in the existing working tree:

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | **Pass**, exit 0 |
| ESLint (changed files) | `npx eslint src/lib/lam/plugin-registry.ts src/components/views/lam-ai.tsx …` | **Pass**, exit 0 |
| Focused tests | `bun test tests/shrinking-scholar.test.ts` | **12 pass, 0 fail**, 161 assertions |
| Dev server | `bun run dev` | Next.js 16.3.6 ready; `/` HTTP 200 |
| Question Practice | browser `/question-practice` | Practice default; 3 tabs; real 323-question Physics bank |
| Doubt Lab | browser `/doubt-lab` | My Doubts default; 8 records; filters and tabs render |
| Resources | browser `/resources` | 126 real resources; Library default |
| Resources → Downloads | browser click | Downloads selected; real Downloads view rendered |
| Live search aliases | browser: typed `Quiz` in Search Scholar | 12 options; top result **Quiz → Question Practice · Quizzes**; Practice/Past Papers aliases present |
| Study Media | browser `/study-media` | Both tabs Paused; Study Music shutdown notice renders |
| Legacy routes | unit resolver + route list | All 14 legacy ids resolve to canonical + mode |

Not run:

- Production `next build` was not run while the dev preview was live, to avoid
  corrupting the shared `.next` directory.
- No authenticated browser session was available. LAM AI plugin execution,
  attachment upload, Plus gates and the consent prompt were therefore verified
  by TypeScript, ESLint, registry/gate tests and source inspection, not by a live
  signed-in flow. The sign-in redirect alone would not have counted as a test.
- No paid AI request was made.

## Q. Performance

- Each workspace mode keeps `next/dynamic`; only the selected mode's code loads.
- Downloads is mounted on first open only, not at application startup.
- Study Media loads no player or generation runtime.
- The new registry is a small metadata module (no heavy dependencies).
- Resources keeps the Library mounted when Downloads opens; this trades a small
  amount of retained DOM for no remount flash. It does not load Downloads early.

No before/after timing measurement was taken, so no speed improvement is
claimed.

## R. Limitations

1. **Authenticated LAM AI flow not live-tested.** The local browser was a guest;
   LAM AI is intentionally guest-gated. Plugin opening, chip submission,
   attachment send and Plus authorization need a signed-in manual pass.
2. **Image Analysis is not implemented anywhere in the current tree.** It was
   not fabricated as a plugin. AISIG is the real AI Study Image Generator and is
   registered as such.
3. **Eight additional plugin ideas are Planned, not Available.** Only tools with
   an existing implementation were exposed as working. No fake plugin cards were
   added.
4. **LAM AI has no permanent desktop conversation sidebar.** Existing session
   history is available in the Sessions panel; a sidebar would require a new
   session-state layer and was not introduced.
5. **The downloads screenshot is missing**, though the rendered Downloads view
   was verified from a fresh accessibility snapshot.
6. **Repeated resource discovery panels in other workspaces were not removed.**
   They were audited only; deleting contextual academic sources without a
   feature-by-feature review would risk losing legitimate references.
7. Footer links still use legacy labels (AI Tools, AI Tutor, Quiz). They resolve
   through the compatibility map by design and were not broken.

## S. Safety

- No `git reset --hard`, `git clean`, `git restore .`, force push, commit or push.
- No deployment; the official domain was not changed.
- No database migration, schema change or destructive data operation.
- No secret change and no credential printed.
- No authentication or subscription bypass.
- No paid AI testing call.
- No student history deleted.
- No duplicate storage system or global state provider added.
- Liquid Velocity, the wordmark loader and the existing visual system were not
  replaced.
