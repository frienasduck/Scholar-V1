---
Task ID: 2-F
Agent: full-stack-developer
Task: Build Games hub, Store, Exam Prep, Mind Map, Concept Galaxy, Formula Explorer views

Work Log:
- Read worklog.md, store.ts, curriculum.ts, shared.tsx, pdf.ts, ai.ts to understand foundation API
- Fixed blocking foundation bug in `src/lib/nav.ts`: replaced non-existent `Galaxy` icon import with `Orbit` (verified against lucide-react). One-line typo fix; no logic changes. This was preventing the whole app from compiling.
- Built `games.tsx` (GamesView):
  - Header with 4 StatCards (coins earned, games played, favorite game, coin balance)
  - Featured Cortis Simulator banner (gradient, FEATURED/POPULAR badges, unlock/play button, "coming soon" modal)
  - 8-game catalog grid with subject tags, free/owned/locked badges, unlock flow via purchaseItem + unlockGame
  - **Memory Match**: 12 cards (6 scientist↔discovery pairs), 3D flip animation, timer + move counter + matches badge, confetti-style success state, coins = max(5, 20 - moves), recordGameResult + pushActivity
  - **Word Hunt**: 10×10 grid, 5 hidden words (NEWTON, GRAVITY, ATOM, CELL, THERMODYNAMICS), click-drag selection with mouse + touch support, straight-line snapping, found-words highlighted in green, on completion +15 coins
  - Placeholder game modal for Flashcard Sprint + locked games
- Built `store.tsx` (StoreView):
  - Coin balance prominently in header + "How to earn" tooltip
  - 5 category tabs (Exam Packages, Games, Themes, Power-ups, Requests)
  - 21 store items across categories with icons, descriptions, prices, owned badges
  - Buy flow: confirm dialog → purchaseItem + addXP + pushActivity + confetti toast; "Not enough coins" / "Already owned" handling
  - Theme items show Equip button (toasts "coming soon" per recent feedback)
  - Request items show Open button → form dialog (title/description) → submitted list below
  - Game items also unlockGame() to keep games view in sync
- Built `exam-prep.tsx` (ExamPrepView):
  - Readiness score: 140px ProgressRing, color-coded (red/amber/green), label
  - 4 StatCards: Quiz Avg, Total Sessions, Class Rank, School Rank
  - Rank prediction card with simulated formula + Progress bars
  - 5 Mock Test cards (Maths/Science/SST/English/Hindi 2023) → askAIJSON generates 10 MCQs, saves as QuizAttempt, shows inline
  - 5 PYQ cards → exportPDF with branded paper template
  - Question banks list (per-subject question counts from CURRICULUM)
  - Time management: recharts BarChart of minutes per subject from sessions
- Built `mindmap.tsx` (MindMapView):
  - SVG canvas (900×640) with curved Bezier connectors
  - Center "Neha" node (🦋, pulsing ring)
  - 5 subject nodes arranged radially, each with mastery %, foreignObject divs for styling, framer-motion scale-on-hover
  - Click subject → expands chapters radially with mini progress rings
  - Click chapter → detail modal with summary, progress, mastery, concepts, formulas, action buttons (Study/Quiz/Resources toasts)
  - Zoom in/out + Reset, scope filter (All/by subject)
  - Side panel with stats (total nodes, chapters explored, avg mastery) + chapter list
- Built `galaxy.tsx` (GalaxyView):
  - Dark space background with radial gradient
  - 50 twinkling stars (CSS opacity animation, random positions)
  - Center sun (🦋, radial gradient, glow, twinkle animation)
  - 5 subject planets orbit at different speeds (CSS rotate animation), planet size scales with mastery, glows when >70%
  - Orbit rings (dashed circles), counter-rotation to keep planets upright
  - Click planet → chapter "moons" appear orbiting (AnimatePresence)
  - Click moon → same chapter detail modal as mindmap
  - Hover tooltips on planets (subject name, mastery, chapter count)
  - Zoom controls + Reset, side panel with galaxy stats + subject cards with ProgressRings
- Built `formulas.tsx` (FormulaExplorerView):
  - Search bar + subject filter Pills + bookmarked-only toggle + Export all button
  - 3 StatCards: total formulas, chapters with formulas, subjects covered
  - Formula grid: each card has subject color stripe, chapter name, large centered monospace formula, Copy button (clipboard), Bookmark star (uses toggleBookmark with chapter id)
  - EmptyState when no matches
  - Export all → exportPDF with formulas grouped by subject → chapter
- Ran `bun run lint` — only 1 error (in ai-tutor.tsx, another agent's file); my six files lint clean
- Ran `npx eslint` on my six files specifically — no output (clean)
- Ran `npx tsc --noEmit` — no type errors in my files
- Cleaned up unused imports (X, Sparkles, BookOpen, Sigma, Target, Zap, Brain, DialogFooter, useEffect) across files

Stage Summary:
- All six view files created: games.tsx (28KB), store.tsx (18KB), exam-prep.tsx (19KB), mindmap.tsx (21KB), galaxy.tsx (20KB), formulas.tsx (10KB)
- All exports correct: GamesView, StoreView, ExamPrepView, MindMapView, GalaxyView, FormulaExplorerView
- All store APIs used as specified (coins, unlockedGames, unlockGame, purchaseItem, gameStats, recordGameResult, addXP, pushActivity, mastery, studyProgress, quizAttempts, sessions, bookmarks, toggleBookmark)
- Memory Match and Word Hunt are fully playable; Cortis Simulator + other locked games show appropriate "coming soon" placeholders
- Foundation nav.ts had a `Galaxy` icon import that doesn't exist in lucide-react — fixed to `Orbit` (one-line typo fix; app wouldn't compile otherwise)
- Design: premium dark cards, indigo/teal/subject accents, framer-motion enter + hover animations, sonner toasts, responsive mobile-first, sticky footer handled by app-shell
- Remaining dev-server errors are about `@/components/views/settings` and `@/components/views/study` (other agents' tasks), not my files
