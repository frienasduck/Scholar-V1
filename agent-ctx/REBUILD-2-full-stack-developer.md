---
Task ID: REBUILD-2
Agent: full-stack-developer
Task: Rebuild Goal Center, Reminders, Doubt History, Downloads views

Work Log:
- Read /home/z/my-project/worklog.md (full project context — Neha's Scholar premium CBSE Class 9 study OS, Next.js 16 App Router, TS strict, Tailwind 4, shadcn/ui New York, Zustand persisted store, askAI/askAIJSON helpers, exportPDF/mdToHtml, CURRICULUM with 5 subjects × ~15 chapters, shared StatCard/Markdown/etc.).
- Inspected the 4 stub files (each was a 4-line placeholder loading div).
- Studied past-papers.tsx as the cinematic design reference — confirmed pattern: `<div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">` to negate main's `p-4 lg:p-6`, video bg + dark overlay + glass panels + Instrument Serif italic display + Inter body + framer-motion staggered entrances.
- Verified app-shell.tsx imports `GoalCenterView / RemindersView / DoubtHistoryView / DownloadsView` and wires them at view ids `goal-center`, `reminders`, `doubt-history`, `downloads`.
- Confirmed store API: `addXP(n)`, `addCoins(n)`, `pushActivity({type,text,icon})`, `chatThreads`, `tasks`, `flashcards`, `studyProgress`, `quizAttempts`, `streak`, `mastery`.
- Confirmed Progress component does NOT accept `indicatorClassName` (only `className` + `value`) — kept all Progress usages compatible.

Rebuilt all 4 view files in /home/z/my-project/src/components/views/:

1. **goal-center.tsx** (1085 lines) — `GoalCenterView`:
   - Video: …204103_f607742e…, CSS prefix `gc-`, dark overlay bg-black/55.
   - Hero italic serif "Goal Center" + 4 stat pills (Active Goals / Goals Achieved / Avg Progress / On-Track).
   - 5 goal types with icons + accents: Marks Target (Target/indigo), Exam Target (Award/emerald), Daily Study Target (Flame/amber), Weekly Goal (Rocket/violet), Monthly Goal (Trophy/pink).
   - 5 seeded goals (Maths 90+ midterm, daily 3h study, weekly 5 Science chapters, top-5 rank, 80% mastery).
   - Multi-step create dialog (4 steps): Title → Type → Target/Deadline/Subject → Milestones. Progress dots, Next/Back nav, conditional disables.
   - Goal cards: type icon, title, subject+type+status pills, days-left countdown, progress bar with status-colored %, milestone checklist (clickable toggles that auto-update progress), +/- progress buttons, AI Check-in button per goal.
   - AI Check-in (askAIJSON): returns likelihood% (color-coded), status, suggestions array, next milestone. Renders inline expandable panel with violet glass styling.
   - Weekly progress chart: 7 animated bars (Mon-Sun) with indigo→violet gradient + glow.
   - Tabs: Active Goals | Achieved | AI Insights. Achieved tab shows trophy cards. AI Insights tab runs global forecast (askAIJSON returns avg likelihood, status, 5 prioritized suggestions, top milestone) with 80px SVG progress ring.
   - Confetti celebration on 100% (80 emoji spans, falling animation, 3s).
   - Export Goal Report button → exportPDF with mdToHtml of all goals + AI forecast.
   - Awards +5 XP on create, +20 coins on achieve.
   - Responsive mobile-first; localStorage `gc-goals` for persistence.

2. **reminders.tsx** (768 lines) — `RemindersView`:
   - Video: …230229_7c9bc431…, CSS prefix `sr-`.
   - Hero italic serif "Smart Reminders" + 4 stat pills (Active / Urgent / Snoozed / Dismissed).
   - Auto reminder feed generated from store data: revision overdue (tasks type=revision past date, urgent if >1d overdue), exam deadlines (tasks type=exam with days-left priority), forgetting curve (studyProgress >30% chapters), streak at risk (alert if streak≥1), flashcards due (cards in box <5), quiz stale reminder.
   - AI Refresh button (askAIJSON): returns 4-6 personalized reminders with title/message/category/priority/dueOffsetMin. AI reminders tagged `sr-ai-` prefix for replacement on re-run. Awards +2 XP.
   - Category filter chips: All / Revision / Exams / Streak / Flashcards / Custom (with icons + accent colors).
   - Custom reminder dialog: title, message, datetime-local, repeat (none/daily/weekly), category, priority.
   - Snooze (1h/3h/Tomorrow) and Dismiss actions per reminder. Restore from dismissed. Delete custom reminders.
   - DND toggle (Switch) with persistent state.
   - Tabs: Active | Snoozed | Dismissed | Custom.
   - Pulse ring animation on overdue reminders.
   - localStorage persistence: `sr-custom` for custom reminders, `sr-state` for state overrides + snoozes + DND.

3. **doubt-history.tsx** (934 lines) — `DoubtHistoryView`:
   - Video: …204221_5339e40b…, CSS prefix `dh-`.
   - Hero italic serif "Doubt History" + 4 stat pills (Total Doubts / Resolved / Open / Starred).
   - Unified doubt index: merges chatThreads from store + 8 seeded mock doubts + localStorage `dh-doubts`. Each thread auto-classified into subject by keyword (math/science/sst/english/hindi) and status (resolved if any assistant message, open otherwise).
   - Powerful search bar across question + answer text.
   - Filters: Subject chips (5), Source chips (AI Tutor/Custom/Quiz/Class), Status chips (resolved/open), Date range (7d/30d/90d/all).
   - Doubt cards: subject-colored icon, question (clickable to open detail dialog), answer preview (line-clamp-2), star toggle, status badge, source badge, time-ago. 8 source icons mapped.
   - Doubt detail dialog: full Q&A, inline answer editor (add/edit answer with save → resolves doubt), AI Related Doubts (askAIJSON returns 3 conceptually related indices, clickable to navigate).
   - Smart Clusters tab (askAIJSON): groups doubts by underlying concept (not subject), returns topic + description + doubt indices. Renders cluster cards with linked doubt list.
   - Quick add doubt dialog: question, optional answer, subject, source, chapter. Awards +5 XP per doubt logged.
   - Export Doubt Book button → exportPDF with mdToHtml grouped by subject with full Q&A.
   - Star toggle (persisted).
   - Tabs: All Doubts | Starred | Smart Clusters | By Subject.

4. **downloads.tsx** (926 lines) — `DownloadsView`:
   - Video: …204103_f607742e… (same as goal-center per spec), CSS prefix `dl-`.
   - Hero italic serif "Downloads & Offline" + 4 stat pills (Catalog Items / Downloaded / Storage Used / Mode).
   - 20-item catalog: 3 Notes, 3 Formula Sheets, 3 Flashcard Decks, 3 Videos, 2 Chapter Summaries, 2 Mock Papers, 2 Mind Maps, 2 Audio — each with subject, chapter, byte size, description.
   - 8 item types with distinct icons + accents (Notes/FileText/indigo, Formula Sheets/Sigma/violet, Flashcard Decks/BookOpen/emerald, Videos/Video/rose, Chapter Summaries/FileStack/amber, Mock Papers/ClipboardList/pink, Mind Maps/Network/teal, Audio/Headphones/purple).
   - Download simulation: setInterval (~200ms tick, +8-26% per tick, ~2s total). Progress bar with live % and color-coded gradient. On completion: persists to localStorage `dl-downloaded`, awards +2 XP, pushes activity, auto-opens the file via Blob.
   - `handleOpen` generates REAL downloadable files: Notes & Formula Sheets as .txt (text/plain), Flashcard Decks as .json (application/json with title/subject/cards array), Chapter Summaries as .md (text/markdown), Videos/Mock Papers/Mind Maps/Audio as .html (text/html with styled player page). Uses Blob + URL.createObjectURL + anchor click. Filename = slugified title + extension.
   - Offline mode toggle (Switch) — disables AI features and new downloads when on.
   - Storage meter: 500MB limit, amber >70%, red >90%. Big SVG circular progress ring (128px) with color-coded fill + glow. Per-type breakdown bars. Quick actions: Clear All, Export Manifest.
   - Search + Type/Subject filters.
   - AI Recommendations (askAIJSON): uses mastery data, returns 5 catalog item IDs most helpful for weakest subjects, not already downloaded. Renders as a recommendation card list with quick-download buttons.
   - Export Manifest button → exportPDF with mdToHtml listing all downloaded items + full catalog.
   - Tabs: Library | Downloads | Storage.
   - localStorage persistence for downloaded state.

All 4 views share the same cinematic glassmorphism pattern from REBUILD-1 spec:
- `<div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">` root
- Inline `<style>` with @import for Instrument Serif + Inter fonts
- `.PREFIX-glass` and `.PREFIX-glass-strong` liquid-glass classes per spec
- `.PREFIX-serif` for Instrument Serif italic display, `.PREFIX-body` for Inter
- Input/textarea/select forced to dark theme inside glass
- Custom scrollbar styling
- Video bg: autoplay muted loop playsInline, absolute inset-0, object-cover, opacity-50
- Dark overlay: `absolute inset-0 z-0 bg-black/55`
- Content on z-10 with `p-4 md:p-8 lg:p-12`
- framer-motion: hero fade-up, stat pills staggered, cards staggered with whileHover y:-2 lift, AnimatePresence on lists

Stage Summary:
- 4 view files rebuilt from scratch and saved:
  • /home/z/my-project/src/components/views/goal-center.tsx — 1085 lines (was 4)
  • /home/z/my-project/src/components/views/reminders.tsx — 768 lines (was 4)
  • /home/z/my-project/src/components/views/doubt-history.tsx — 934 lines (was 4)
  • /home/z/my-project/src/components/views/downloads.tsx — 926 lines (was 4)
  Total: 3,713 lines of cinematic, fully-featured TypeScript React.
- Each view self-contained: own CSS prefix (gc-/sr-/dh-/dl-), own background video URL, own localStorage keys, no shared state between views beyond the Zustand store + askAIJSON/exportPDF helpers.
- All 4 views render inside the existing app-shell (no navbar/footer added); root div uses `-m-4 lg:-m-6` to negate main's padding for full-bleed video background.
- AI integrations via askAIJSON: AI Check-in + AI Forecast (goal-center), AI Refresh (reminders), AI Clusters + AI Related Doubts (doubt-history), AI Recommendations (downloads).
- XP/Coins awarded per spec: +5 XP create goal / +20 coins achieve goal (goal-center), +2 XP AI refresh (reminders), +5 XP per doubt logged (doubt-history), +2 XP per download (downloads).
- Real downloadable files via Blob + anchor click for all 8 item types in downloads (Notes .txt, Formula Sheets .txt, Flashcards .json, Chapter Summaries .md, Videos/Mock Papers/Mind Maps/Audio .html).
- Verification:
  • `bun run lint` → EXIT 0 (0 errors, 0 warnings).
  • `bunx tsc --noEmit` → 0 errors in any of the 4 rebuilt files (only out-of-scope errors in examples/ and skills/ folders).
  • Dev server: clean recompiles with 200 responses (`✓ Compiled in XXXms`).
- Self-contained: only 4 view files modified. No changes to lib/, ui components, prisma, app-shell, or other views. No new dependencies added.
