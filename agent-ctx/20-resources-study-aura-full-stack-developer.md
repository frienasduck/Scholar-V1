# Task 20-resources-study-aura — Aura Dark Cinematic Redesign for Resources & Study Views

**Agent**: full-stack-developer
**Task ID**: 20-resources-study-aura
**Date**: 2025 session

## Objective
Redesign 2 views (`resources.tsx` + `study.tsx`) for "Neha's Scholar" using the new "Aura" dark cinematic aesthetic. Change ONLY the interface/design — preserve ALL existing functions, state, handlers, and logic. Do NOT modify any foundation files.

## Files Modified
1. `/home/z/my-project/src/components/views/resources.tsx`
2. `/home/z/my-project/src/components/views/study.tsx`

## Aura Design Applied (both views)

### Layout Structure
- **Outer wrapper**: `relative min-h-[calc(100vh-4rem)] bg-[#0c0c0c] overflow-hidden -m-4 lg:-m-6 text-white aura-font`
- **AURA_STYLE** `<style>` tag (extracted to module-level const for cleanliness) containing:
  - `@import` Inter font (400-900 weights)
  - `.aura-glass` with `::before` gradient border pseudo-element (1.4px padding, mask-composite trick)
  - `.aura-glass-card` (rgba(14,16,20,0.9) + blur(20px) + 1px white/10 border + 16px radius)
  - `.aura-font` (Inter)
  - `.aura-glass .text-muted-foreground` override (white/60)
  - `.aura-glass input/textarea/select` (white/05 bg, white/15 border, white text)
  - `.aura-glass .bg-muted` + `.aura-glass .border-border` overrides
  - `@keyframes shiny` + `.animate-shiny` (6s linear infinite gradient sweep)
  - View-specific extras: `.aura-chapter-hover`, `.aura-chapter-item`, `.aura-tab-active`, `.aura-input-bare`, `.aura-prose` (for study's Markdown renderer)
- **Fixed background video**: `fixed inset-0 z-0 pointer-events-none` with `src=` directly on `<video>` (URL: `hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4`)
- **Content layer**: `relative z-10 max-w-6xl mx-auto px-6 py-8`

### Navbar (both views)
- `motion.nav` with `initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} transition={{duration:0.6}}`
- `flex items-center justify-between py-4`
- Left: 4-quadrant SVG logo (white, w-8 h-8) + view name (`text-white font-semibold text-lg`)
- Center (desktop only, `hidden md:flex gap-8`): functional links that scroll/focus/switch
  - Resources: "Chapters" (clears search), "Bookmarks" (scrolls to #aura-bookmarks), "Search" (focuses #aura-resources-search)
  - Study: "Chapters" (scrolls to #aura-chapter-list), "Science" + "Social Science" (switch subject)
- Right: `aura-glass rounded-full px-3 py-1.5 text-xs text-white/60` glass pill with stat (icon + bold count)

### Hero section (both views)
- Eyebrow pill: `aura-glass rounded-full px-3 py-1 text-xs text-white/50 inline-flex` with pulsing emerald dot + "AI-NATIVE STUDY PLATFORM"
- `motion.h1` `text-4xl md:text-7xl font-semibold tracking-tight leading-[0.9] text-white`:
  - Resources: "Your syllabus." + `animate-shiny` "Revitalized" (gradient text)
  - Study: "Your textbook." + `animate-shiny` "Revitalized" (gradient text)
- Gradient: `linear-gradient(to right, #091020 0%, #0B2551 12.5%, #A4F4FD 32.5%, #00d2ff 50%, #0B2551 67.5%, #091020 87.5%, #091020 100%)`, 200% size, webkit-bg-clip:text, transparent fill
- Subtitle `motion.p` `mt-8 text-white/60 max-w-md text-base leading-[1.5]`

### macOS menu bar strip (below hero)
- `h-10 bg-black/40 backdrop-blur-md border-t border-b border-white/10 -mx-6`
- Inner `max-w-6xl mx-auto px-6 h-full flex items-center justify-between text-xs`
- Left: Apple logo SVG + bold "Scholar" + 6 menu items (File/Edit/View/Go/Window/Help) in `text-white/70 hover:text-white`
- Right: icon + date + time (using `toLocaleDateString`/`toLocaleTimeString` with `suppressHydrationWarning`)

### Content cards (per spec)
- All `Card className="premium-card"` → `aura-glass rounded-2xl` or `aura-glass-card` divs
- All primary text: `text-white`; muted text: `text-white/60` / `text-white/50`
- StatCards: replaced shared `StatCard` with inline custom stat cards wrapped in `aura-glass rounded-2xl p-4` (since `shared.tsx` is a protected foundation file)
- Subject tabs: inactive = `aura-glass text-white/60 hover:text-white`; active = `aura-tab-active text-white` + accent bg
- SectionHeader: replaced with inline `<div className="flex items-end justify-between gap-4 mb-4">` blocks (since `SectionHeader.title` is typed `string`, can't pass JSX)
- EmptyState: replaced with inline dark-glass empty state (`bg-white/5 border-white/10`)

## Per-view specifics

### Resources (`resources.tsx`) — Functions preserved
- ✅ `useStore` hooks: studyProgress, bookmarks, toggleBookmark, addTask, addFlashcard, pushActivity
- ✅ `activeSubject` state + `setActiveSubject` (subject tabs)
- ✅ `search` state + `filteredChapters` (within-subject) + `globalSearch` (cross-subject)
- ✅ `openChapter` state + chapter detail dialog
- ✅ `bookmarkedChapters` memo
- ✅ Stats: totalChapters, studiedCount, inProgressCount
- ✅ Handlers: `handleGeneratePDF` (exportPDF + mdToHtml), `handleCreateFlashcards` (addFlashcard + navigateTo flashcards), `handleStartQuiz` (navigateTo quiz), `handleAddToPlanner` (addTask + navigateTo planner), `handleBookmark` (toggleBookmark)
- ✅ All 5 actions in ChapterDetail: PDF, Flashcards, Quiz, Planner, Bookmark
- ✅ `ChapterCard` component (converted from Card→div with `aura-glass aura-chapter-hover rounded-xl p-4`)
- ✅ `ChapterDetail` component (DialogContent → `aura-glass-card max-w-2xl`, dark glass styling)
- ✅ Bookmarks section, Global search results, Subject tabs + Chapter grid branches
- ✅ Three-branch rendering: bookmarks (no search) / global search results (search active) / subject tabs + chapter grid (default)

### Study (`study.tsx`) — Functions preserved
- ✅ `useStore` hooks: studyProgress, setStudyProgress, addNote, addXP, addCoins, pushActivity
- ✅ `subjectId` state + `handleSwitchSubject` (resets chapterIdx to 0)
- ✅ `chapterIdx` state + `setChapterIdx`
- ✅ `explainOpen` state + `handleExplain` (askAI with personaFor, prompt, error toast)
- ✅ `goPrev` / `goNext` (with boundary toasts)
- ✅ `handleMarkStudied` (setStudyProgress(100) + XP/coins/activity + conditional toast)
- ✅ `handleSaveAsNote` (addNote with buildLessonMarkdown + activity + toast)
- ✅ `studiedCount` / `totalStudyChapters` derived stats
- ✅ Subject selector (Science + SST only via `STUDY_SUBJECTS` filter)
- ✅ Chapter list sidebar with progress rings + per-chapter progress bars (active = `bg-white/10 ring-1 ring-white/20`)
- ✅ Reader: all 7 sections preserved — Introduction, Key Concepts (with AI Explain buttons), Important Points, Formulas (conditional), Examples (with reveal), Summary, Quick Revision MCQs
- ✅ Reader wrapped in `aura-glass-card` container as per spec
- ✅ Bottom action bar: Prev/Next, Save as Note, Mark as studied (accent-colored)
- ✅ Explain dialog (DialogContent → `aura-glass-card max-w-lg`, dark glass, with loading spinner + Markdown content)
- ✅ Sub-components preserved: `Section`, `ExampleItem` (with reveal state), `MCQItem` (with picked state + correct/incorrect coloring), `buildLessonMarkdown`
- ✅ `personaFor` helper (dr-meera for science, arjun for sst)

## Styling Decisions
- Used `aura-glass-card` (heavier dark glass with blur-20px) for the Study reader + chapter list sidebar + chapter detail dialog + explain dialog (per spec: "reader should be in an `aura-glass-card` container")
- Used `aura-glass` (lighter, with gradient border via ::before) for: navbar pill, eyebrow pill, stat cards, subject tabs (inactive), chapter cards in Resources
- Hardcoded white-based colors (`text-white`, `text-white/60`, `bg-white/5`, `border-white/10`) instead of theme tokens, since the Aura bg is hardcoded `#0c0c0c` (not theme-aware)
- Subject accent colors (from `CURRICULUM`) preserved for: progress rings, concept borders, formula number badges, "Mark as studied" button bg, chapter list progress bars, Key Concepts icon, etc. — these provide the per-subject visual variety on top of the dark glass base
- Hydration safety: date/time in menu bar uses `suppressHydrationWarning` (rendered client-side after mount)

## Verification
- `bun run lint`: ✅ 0 errors, 0 warnings (after fixing initial missing `DialogContent` import in study.tsx)
- Dev server: `GET / 200` clean, no compile errors
- All original handlers/state/logic preserved 1:1 — only visual layer changed

## Notes for Future Agents
- The `aura-glass` and `aura-glass-card` classes are defined via a module-level `AURA_STYLE` const injected through a `<style>` tag in each view's main return. They're only in the DOM when the view is mounted.
- The `aura-glass::before` pseudo-element creates a gradient border using the mask-composite trick — works on any border-radius.
- For the dark hardcoded bg (`#0c0c0c`), all text colors must be explicitly white-based (not theme tokens), since the parent context isn't dark-themed, it's just dark-colored.
- Subject accent colors are preserved as the secondary visual language (progress rings, icons, buttons) on top of the dark glass base — this maintains per-subject identity without breaking the Aura aesthetic.
- `shared.tsx` is a protected foundation file, so `StatCard` and `SectionHeader` could not be modified. Inline equivalents were used instead (custom stat cards + inline section headers), giving full control of the dark glass styling.
- The `chapterName` helper in study.tsx is defined but unused (pre-existing from original code, not introduced by this redesign).
