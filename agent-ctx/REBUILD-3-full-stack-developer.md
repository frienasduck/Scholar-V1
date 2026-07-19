# REBUILD-3 · full-stack-developer

## Task
Rebuild 3 view files lost in a revert: `assignments.tsx`, `workspace.tsx`, `music.tsx`. Each must use cinematic glassmorphism (looping bg video + liquid-glass panels + Instrument Serif italic display + Inter body + framer-motion staggered entrances), fill `min-h-[calc(100vh-4rem)]`, negate main padding with `-m-4 lg:-m-6`, and pass `bun run lint` with zero errors/warnings.

## Work Log
- Read `/home/z/my-project/worklog.md` (1795 lines) for full project context — confirmed Neha's Scholar premium CBSE Class 9 study OS, Next.js 16 App Router, TS strict, Tailwind 4, shadcn/ui New York, Zustand persisted store, askAI/askAIJSON helpers via `/api/ai`, exportPDF/mdToHtml, CURRICULUM with 5 subjects × ~15 chapters.
- Inspected the 3 stub files (each was a 4-line placeholder loading div) and verified app-shell.tsx imports `AssignmentsView / WorkspaceView / MusicView` and wires them at view ids `assignments`, `workspace`, `music`.
- Verified store API: `addXP`, `addCoins`, `pushActivity`, `addTask`, `toggleTask`, `addSession`, `deleteTask`, `flashcards`, `tasks`, `notes`, `decks`, `xp`, `coins`, `streak`, `mastery`, `studyProgress`; `getLevelInfo(xp)` exported; `FocusSession` type = `{id, type, duration, completedAt, subject?}`.
- Verified `shared.tsx` exports `Markdown`, `StatCard`, `SectionHeader`, `EmptyState`, `Pill`, `ProgressRing`; `Progress` component does NOT accept `indicatorClassName`.
- Confirmed all required shadcn components exist (button, badge, input, textarea, select, tabs, separator, scroll-area, dialog, dropdown-menu, slider, checkbox, switch) and their export signatures.
- Studied `past-papers.tsx` (REBUILD-1 output) as the cinematic design reference — confirmed `-m-4 lg:-m-6` root, video bg + `bg-black/55` overlay + glass panels + Instrument Serif italic display + Inter body + framer-motion staggered entrances.

### File 1 — `src/components/views/assignments.tsx` (1187 lines)
- `AssignmentsView` exported function. CSS prefix `as-`. Video URL per spec.
- 10 seed CBSE Class 9 assignments across all 5 subjects (Maths 3, Science 2, SST 3, English 1, Hindi 1) with status Pending/Submitted/Graded/Overdue, each carrying 2–4 questions of type MCQ/Short/Long with modelAnswer, maxMarks, dueAt timestamps.
- Hero "Assignment Center" (Instrument Serif italic) + 4 stat pills (Pending/Submitted/Graded/Overdue) with status-coloured icons.
- Tabs: Assignments | Calendar | Graded | AI Feedback.
- Assignments tab: status/subject/search filter bar + responsive 2-column assignment card grid with countdown (Days/Hours/Minutes left), status pill, draft indicator, Open Workspace / Export / Delete buttons.
- Calendar tab: month grid (Sun–Sat) with subject-coloured due-date dots, today ring, prev/next month nav, legend, and "due this month" clickable list.
- Graded tab: AI feedback cards with predicted grade letter, score, overall feedback, strengths/improvements split panels, Review/Export/Re-grade buttons.
- AI Feedback tab: scrollable log of every AI-graded submission with per-question breakdown.
- Workspace Dialog: full-width answer editor — MCQ as clickable option buttons (with model-answer ring after grading), Short/Long as Textarea; per-question AI feedback panel after grading; Save Draft + Submit & AI Grade + Export Report buttons.
- AI grading via `askAIJSON<AIFeedback>` with strict CBSE examiner prompt returning perQuestion[{marks, maxMarks, feedback}], overallFeedback, predictedGrade, strengths[], improvements[]. On success: status → Graded, +25 XP, +10 coins, pushActivity, toast.
- Re-grade flow for already-graded assignments (calls AI again).
- Add Assignment Dialog: title/subject/chapter/due-in-days inputs + dynamic question builder (add/remove questions, type selector, marks input, MCQ option builder with "✓ correct answer" picker, model answer Textarea).
- Export Submission via `exportPDF` with branded report (overall feedback, strengths, improvements, per-question breakdown with student/model answers + AI awarded marks).
- Auto-overdue detection every 30s tick via `useEffect` + `setInterval`.
- Persist to `localStorage["as-assignments"]`.

### File 2 — `src/components/views/workspace.tsx` (920 lines)
- `WorkspaceView` exported function. CSS prefix `ws-`. Video URL per spec.
- Customisable canvas: hero + toolbar (Add Widget dropdown, Reset Layout, Edit/Done toggle).
- 12 functional widgets in `WIDGET_REGISTRY` (Notes, Flashcards, Pomodoro Timer, Calculator, Whiteboard, AI Chat, Formula Sheet, To-Do, Calendar, Quick Stats, Music, Sticky Notes), each with title/icon/accent metadata.
- Default layout: `[timer, notes, ai-chat, quick-stats, todo]` per spec.
- Edit Mode: per-widget header shows ↑/↓ reorder buttons + ✕ remove button (arrow-based reorder is reliable on touch + lint-clean).
- Add Widget dropdown: lists only widgets NOT currently on canvas, with full icon + title + accent.
- Reset Layout: restores default 5-widget layout.
- Layout persists to `localStorage["ws-layout"]` (lazy useState initializer for SSR-safe hydration).
- Responsive grid: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4` (1→2→3→4 columns).
- Widget details:
  1. **Notes** — Textarea with debounced 600ms autosave to `ws-notes`, "Autosaved HH:MM:SS" indicator.
  2. **Flashcards** — pulls `flashcards` from store; click-to-flip with rotateY animation, Next + Shuffle buttons, count badge.
  3. **Pomodoro Timer** — 25:00 countdown with circular SVG progress ring, Start/Pause + Reset; on completion: +5 XP, `addSession({type:'pomodoro', duration:1500, ...})`, pushActivity, toast.
  4. **Calculator** — display + 4×4 button grid (0-9, ., +−×÷, =, C, ⌫); safe eval via `Function("use strict")` after stripping non-arithmetic chars.
  5. **Whiteboard** — HTML5 canvas with pointer events (pointerdown/move/up/leave/cancel, pointer capture), 6-colour palette, brush size selector (Thin/Med/Bold/Thick), Clear button; autosaves toDataURL PNG to `ws-whiteboard`; restores on mount.
  6. **AI Chat** — mini chat with `askAI`, user/assistant bubbles, typing indicator (3 bouncing dots), Enter-to-send, scroll-to-bottom on new message.
  7. **Formula Sheet** — pulls formulas from `CURRICULUM` (module-level `ALL_FORMULAS`), shows 4 random formulas with subject/chapter, Shuffle button.
  8. **To-Do** — add/check/delete with Checkbox + ✕ remove, pending count, autosave to `ws-todo`, Enter-to-add.
  9. **Calendar** — current month mini-grid with today highlight, prev/next month nav, weekday header.
  10. **Quick Stats** — XP/Streak/Coins/Level stat tiles + level progress bar (`getLevelInfo`).
  11. **Music** — lofi mock player with 24-bar CSS equalizer animation (paused when not playing), 3 mock tracks, prev/play/pause/next circular controls.
  12. **Sticky Notes** — 5 colour palette auto-rotated, add/edit/save/cancel/delete with text editing inline, autosave to `ws-sticky-notes`.

### File 3 — `src/components/views/music.tsx` (603 lines)
- `MusicView` exported function. CSS prefix `mu-`. Video URL per spec (same as assignments).
- 8 curated tracks with exact YouTube IDs from spec (Lo-Fi jfKfPfyJRdk, Classical jgpJVI3tDbY, Nature eKFTSSKCzWA, Binaural w5jA8G0kS6E, Ambient 4xDzrJKXOOY, Piano 4Tr0otuiQUU, Rain mPZkdNFkNpro, Deep Focus 5qap5aO4i9A). Each track has id, title, category, duration, youtubeId, description, accent, emoji.
- Hero "Study Music" (Instrument Serif italic) + "Soundtrack your focus" subtitle.
- Tabs: All Music | My Playlists | Focus Session.
- All Music tab:
  - Now Playing panel: track emoji avatar, category badge, duration, title (Instrument Serif), description, 12-bar CSS visualizer with gradient bars (paused when not playing), play/pause + skip back/forward circular controls, volume slider + mute toggle.
  - Hidden YouTube iframe (CSS `hidden` class) with `autoplay=1&controls=0&modestbranding=1&rel=0&enablejsapi=1&playsinline=1&loop=1&playlist=ID`; volume/mute/play/pause controlled via `postMessage` to iframe.contentWindow using YouTube IFrame Player API commands.
  - Track list: 8 clickable glass cards with current-playing ring + animated green pulse indicator.
- My Playlists tab:
  - Create Playlist dialog: name input, 8 emoji picker, multi-select track checkboxes (select all / clear all toggle), create button.
  - Playlist cards (3-col grid) showing emoji, name, track count, creation date, stacked emoji avatars of first 5 tracks.
  - Open-playlist view: list of playlist tracks as clickable rows (jumps to All Music tab + plays).
  - Delete playlist button.
  - Persist to `localStorage["mu-playlists"]` (lazy useState initializer for SSR-safe hydration).
- Focus Session tab:
  - 15/25/45/60 minute preset buttons.
  - On start: +3 XP, toast, sets focusRunning + focusLeft = mins × 60.
  - 1-second tick interval; on completion: auto-pauses YouTube iframe via postMessage, +10 XP, pushActivity, success toast.
  - Stop button to abort session.
  - Circular SVG progress ring with countdown (MM:SS) in Instrument Serif.
  - Companion card: "Soundtrack the session" with 4 quick-pick track buttons (Lo-Fi, Binaural, Piano, Focus) + headphones tip.
- Mobile-first responsive throughout (grid-cols-1 → md:grid-cols-2 → lg:grid-cols-3).

## Lint & TypeScript
- `bun run lint` → **EXIT 0** (0 errors, 0 warnings across the entire project). ✅
- `bunx tsc --noEmit` → 0 errors in any of the 3 rebuilt files (only out-of-scope errors in `examples/` and `skills/` folders, exactly as documented in REBUILD-1 worklog).
- Dev server: clean compiles with `GET / 200` responses; `curl http://localhost:3000/` → HTTP 200, 35056 bytes.

## Lint Fixes Applied Mid-Build
- Removed unused `useCallback`, `useRef` from assignments.tsx imports; removed unused `BookOpen`; added `X` icon import (used in Add Assignment MCQ option remove button).
- Fixed JSX parsing error in workspace.tsx (line 158): `<WIDGET_META[w].icon ...>` → extracted `const M = WIDGET_META[w]; const Icon = M.icon;` then `<Icon .../>` (TSX doesn't allow computed member access as JSX tag).
- Fixed 5 `react-hooks/set-state-in-effect` errors in workspace.tsx by converting all `useEffect(() => setState(loadFromStorage()))` patterns to lazy `useState(() => loadFromStorage())` initializers with `typeof window === "undefined"` SSR guards (main layout, Notes text, Todo items, Sticky notes, Formula Sheet shown). Removed the now-unused `loaded` state.
- Moved `ALL_FORMULAS` from a `useMemo` inside FormulaSheetWidget to a module-level IIFE constant + helper `pickFormulas(n)`, eliminating the dependent setState-in-effect.
- Removed unused `// eslint-disable-next-line no-new-func` directive above the calculator's `Function()` call (no rule was actually firing).
- Fixed a stray `});` typo (extra `}`) introduced during the Sticky Notes useState conversion.

## Stage Summary
- 3 view files rebuilt (2,710 lines total, was 12 lines combined):
  - `src/components/views/assignments.tsx` — 1187 lines (was 4) — AssignmentsView
  - `src/components/views/workspace.tsx` — 920 lines (was 4) — WorkspaceView
  - `src/components/views/music.tsx` — 603 lines (was 4) — MusicView
- All 3 views share cinematic glassmorphism design: video bg + `bg-black/55` overlay + liquid-glass panels (unique CSS prefix per view: `as-` / `ws-` / `mu-`) + Instrument Serif italic display + Inter body + framer-motion staggered entrances + hover lifts + responsive mobile-first.
- All 3 views use `-m-4 lg:-m-6` to negate main's padding and fill `min-h-[calc(100vh-4rem)]`.
- Features delivered:
  - **Assignments**: 10 mock CBSE assignments, 4 stat pills, 4 tabs (Assignments/Calendar/Graded/AI Feedback), AI grading via askAIJSON with per-question marks + overall feedback + predicted grade + strengths/improvements, calendar month grid with due-date dots, filters (status/subject/search), workspace dialog (Save Draft / Submit & AI Grade), Add Assignment dialog with question builder, Export Submission report PDF, +25 XP / +10 coins per AI-graded submission, localStorage `as-assignments` persistence.
  - **Workspace**: 12 functional widgets (Notes, Flashcards, Pomodoro Timer, Calculator, Whiteboard, AI Chat, Formula Sheet, To-Do, Calendar, Quick Stats, Music, Sticky Notes), Add Widget dropdown, Edit mode (↑↓ reorder + ✕ remove), Reset Layout, default layout `[timer, notes, ai-chat, quick-stats, todo]`, responsive 1→2→3→4 columns, localStorage `ws-layout` persistence (+ `ws-notes`, `ws-todo`, `ws-sticky-notes`, `ws-whiteboard` for widget-local data).
  - **Music**: 8 curated YouTube tracks (exact IDs per spec), Now Playing panel with hidden YouTube iframe (controls=0) + 12-bar CSS visualizer + play/pause/skip/volume via postMessage API, track list as glass cards, 3 tabs (All Music/My Playlists/Focus Session), create-playlist dialog with emoji picker + multi-select tracks, focus timer (15/25/45/60 min) with auto-stop + +3 XP on start + +10 XP on complete, localStorage `mu-playlists` persistence.
- Self-contained: only 3 view files modified. No changes to lib/, ui components, prisma, app-shell, or other views. No new dependencies added.
