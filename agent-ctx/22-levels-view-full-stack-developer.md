# Task 22-levels-view — LEVELS view (vertical progression map)

**Agent**: full-stack-developer
**Task ID**: 22-levels-view
**File created**: `/home/z/my-project/src/components/views/levels.tsx`
**File edited**: `/home/z/my-project/src/components/app-shell.tsx` (registered view)
**Date**: 2025 session

## Objective
Build a next-generation "LEVELS" view for Neha's Scholar — a massive vertical progression map (Duolingo redesigned in 2032, Apple-level polish, glassmorphism) with 30 nodes across 3 themed worlds, animated SVG paths, 10 node types, 5 node states, AI-powered node dialog with rewards, floating +XP animations, confetti on milestones, and a bottom floating action bar.

## Files Modified
1. **Created** `src/components/views/levels.tsx` — single `"use client"` component exporting `LevelsView`. ~700 lines.
2. **Edited** `src/components/app-shell.tsx` — added import, registered `levels: LevelsView` in `VIEW_COMPONENTS`, added per-view gradient `levels: "bg-gradient-to-br from-amber-500/5 via-background to-teal-500/5"`.

Foundation files (store, ai, curriculum, nav, shared, ui) untouched.

## What was built

### Global styling (injected via `<style>` tag)
- Google Fonts import (Inter + Instrument Serif)
- `.lv-glass` with mask-composite `::before` gradient border (exact spec CSS)
- `.lv-glass-strong` (rgba(20,20,20,0.9) + blur(20px))
- `.lv-font` / `.lv-serif` typography helpers
- `.lv-scroll` custom scrollbar for dialog AI response area

### Outer layout
- `relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden`
- **Aurora background**: 4 absolutely-positioned blur orbs (purple, indigo, teal, fuchsia) with staggered pulse animations + a subtle SVG noise grain overlay
- Content layer: `relative z-10 flex flex-col min-h-[calc(100vh-4rem)] lv-font`

### Hero section
- "Your Learning *Journey*" — large Instrument Serif heading with "Journey" rendered as an italic gradient text (amber→fuchsia→teal)
- Subtitle: "Progress through an endless adventure of knowledge — 30 levels across 3 worlds..."
- Small eyebrow chip with Sparkles icon: "LEARNING PATH"

### Profile stats bar
- 5 responsive glass pills (`StatPill` component) in a 2/3/5-col grid: Level (Crown/amber), XP (Zap/indigo), Coins (Coins/yellow), Streak (Flame/rose), Current World (Trophy/world-color)
- Below: secondary glass strip with Level progress bar (intoLevel/needed), Avg mastery %, Levels done count

### Vertical Progression Map
- **3 themed worlds** with banner cards:
  - **Foundation Forest** 🌲 (teal/green) — Nodes 1–10
  - **Algebra Alps** 🏔️ (indigo/violet) — Nodes 11–20
  - **Science Galaxy** 🪐 (purple/fuchsia) — Nodes 21–30
- Each world banner: emoji tile, "WORLD N" eyebrow, italic serif name, subtitle, X/10 count, animated gradient progress bar
- **Node generation**: deterministic 30-node array, types distributed in a fixed pattern (each world ends in a boss; treasure/checkpoint/mystery interspersed), titles pulled from CURRICULUM chapters rotated across all 5 subjects (Maths/Science/English/SST/Hindi)
- **Winding path**: nodes alternate left/right (`justify-start`/`justify-end`); each world has an absolutely-positioned `<svg>` overlay (viewBox `0 0 100 100`, `preserveAspectRatio="none"`) drawing two paths:
  - Dim full path (rgba 0.07) — locked segments
  - Bright unlocked path (linearGradient world colors + Gaussian-blur glow filter) — segments leading into the current node
  - Both paths use `vectorEffect="non-scaling-stroke"` so stroke width stays crisp
  - Path geometry: cubic Bezier with control points at vertical midpoint → smooth S-curves between alternating positions
- **State derivation** from store `xp`: `currentGlobalIdx = min(floor(xp / 50), 29)`. Nodes < currentIdx are completed (or "perfect" if treasure/boss/every-5th), the current index is "current", everything after is "locked".

### 10 node types (each with unique icon, color, glow, label)
📖 Lesson (blue) · 🎯 Quiz (rose) · ⚔️ Boss Battle (red) · 🏁 Checkpoint (green) · 🎁 Treasure (amber) · ⚡ Flashcards (yellow) · ▶️ Video Lesson (fuchsia) · 🤖 AI Tutor (violet) · 🔧 Mini Project (teal) · ❓ Mystery (purple)

Each node metadata stored in `NODE_TYPES` map: `{ icon: emoji, LucideIcon, color: hex, glow: "r,g,b", label }`.

### 5 node states (visual differentiation)
- **Locked**: `opacity-40 grayscale`, lock icon, `cursor-not-allowed`, no click handler
- **Unlocked** (treated as completed-or-current): full color, colored box-shadow glow
- **Current**: pulsing animated ring around card (`motion.div` with opacity+scale keyframes, infinite 2s loop), "START" badge in node color
- **Completed**: green check circle overlay (top-right), faded
- **Perfect Score**: gold `ring-2 ring-amber-400/70` border + amber star icon overlay

Each `NodeCard`:
- `lv-glass rounded-3xl p-4` 16rem/18rem wide
- Type chip (colored pill with emoji + label)
- Icon tile (gradient bg, lucide icon)
- Title (line-clamp-2)
- Subject · difficulty footer
- Rewards footer (XP + coins, separated by border-top)
- Hover: `y: -3, scale: 1.02`; Tap: `scale: 0.98` (framer-motion)

### Node click → Dialog
Uses shadcn `Dialog`. Custom `DialogContent` with `lv-glass-strong` dark glass:
- **Header**: gradient bg in node's glow color, type chip + difficulty chip + world chip, large lucide icon tile, italic serif title, "Node X of 30" subtitle, description
- **Body**:
  - Reward chips (XP, coins, + "Bonus badge" for treasure, "World clears" for boss)
  - **AI Forecast panel** (glass): auto-fires `askAIJSON` on dialog open; shows Est. time / Success probability / Difficulty in 3-col grid, plus italic AI recommendation quote. Loading spinner while fetching. Graceful fallback on error.
  - **AI Explain panel** (glass): "Explain this topic" button → calls `askAI` with structured prompt → renders Markdown response in a 14rem-tall scrollable area with custom scrollbar
- **Footer**: Cancel button + full-width gradient "Start {Type}" button (Play icon + ChevronRight) with colored glow shadow

### Start button behavior
On click:
1. Captures button's `getBoundingClientRect()` and triggers floating reward animation at that position
2. Calls `addXP(node.xp)`, `addCoins(node.coins)`, `pushActivity({ type, text, icon })`
3. Shows `toast.success` with XP/coins gained
4. For boss/treasure/checkpoint nodes: spawns **28-particle confetti burst** from screen center (golden-angle distribution, randomized colors, framer-motion animate to random offsets with rotation), plus a special milestone toast ("🏆 World cleared!" / "🎁 Bonus rewards!")
5. Closes dialog

### Floating +XP animation
`FloatingReward` component — fixed-position motion.div at the button's screen coords, animates upward (y: -80px) with opacity keyframes [0→1→1→0] and a subtle scale bounce. Renders amber "+XP" pill + yellow "+coins" pill stacked. Auto-clears after 2s via setTimeout.

### Confetti
`Confetti` component — 28 motion.div particles, each with golden-angle distribution (id × 137.5°), random distance, random color from 6-color palette, animates x/y/scale/rotate over 2s. Auto-clears after 2.3s.

### Bottom floating bar
Fixed at `bottom-4 left-1/2 -translate-x-1/2 z-40`, max-w-md. `lv-glass-strong rounded-full` container with 6 glass circle buttons:
- ▶️ Continue (green) → scrolls to current node via ref + opens its dialog after 700ms
- 🤖 AI Tutor (violet) → `navigateTo("ai-tutor")`
- 🔍 Search (blue) → `navigateTo("resources")`
- 📝 Notes (amber) → `navigateTo("notes")`
- ⏱️ Timer (indigo) → `navigateTo("focus")`
- ⚡ Flashcards (yellow) → `navigateTo("flashcards")`

Each: `lv-glass`-style colored bg, hover lift + scale, tap shrink, hover-revealed tooltip label above.

### Finale card
At the bottom of the map: glass card with 🎓 emoji, italic serif "Journey's End", dynamic message ("You've reached the summit" if completed, else "Only X levels to go").

## Verification
- `bun run lint` → exit 0, zero errors, zero warnings across the entire project ✅
- `bunx tsc --noEmit` → no errors in `levels.tsx` or `app-shell.tsx` (only pre-existing errors in `nigtube.tsx`, `examples/`, `skills/` which are out of scope) ✅
- All lucide-react icons used (Sparkles, Lock, Check, Star, Play, Zap, Trophy, Coins, Flame, ChevronRight, X, Loader2, BookOpen, Target, Gift, Wrench, HelpCircle, Video, Bot, Search, NotebookPen, Timer, Crown) verified to exist ✅
- All foundation imports verified: `useStore`, `getLevelInfo` from `@/lib/store`; `CURRICULUM` from `@/lib/curriculum`; `askAI`, `askAIJSON` from `@/lib/ai`; `navigateTo` from `@/lib/nav-event`; `Markdown` from `@/lib/shared`; `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription` from `@/components/ui/dialog` ✅
- Dev server compiles cleanly (✓ Compiled in 159ms most recent) ✅
- Registered in `app-shell.tsx`: import added, `levels: LevelsView` in `VIEW_COMPONENTS`, `levels` gradient in `viewBg` ✅

## Design notes
- Glassmorphism: `lv-glass` with mask-composite `::before` for the gradient border (exact spec'd CSS). All cards, banners, stat pills, dialog panels use it.
- Typography: Inter for body, Instrument Serif italic for the hero "Journey", world names, and dialog title — gives editorial premium feel.
- Color: NO blue-only palettes. Each world has its own identity (teal/indigo/purple) but node types span the full color wheel (blue lesson, rose quiz, red boss, green checkpoint, amber treasure, yellow flashcards, fuchsia video, violet AI tutor, teal project, purple mystery).
- Aurora background: 4 staggered pulse-animated blur orbs in purple/indigo/teal/fuchsia + subtle SVG noise grain for film texture.
- Animations: framer-motion throughout (hero enter, node stagger-by-index whileInView, current-node infinite pulse ring, hover lift, tap shrink, floating reward, confetti burst, world-banner progress fill).
- Responsive: stats grid 2/3/5 cols, node cards 16rem mobile / 18rem desktop, world banner wraps, bottom bar fits 6 circles on mobile.
- Accessibility: dialog has DialogTitle + DialogDescription for screen readers, buttons have aria-labels, keyboard accessible.

## Stage Summary
- One premium vertical progression map view delivered, fully wired to Zustand store (xp, coins, streak, mastery, addXP, addCoins, pushActivity), CURRICULUM data, AI helpers (askAI + askAIJSON), and the global nav-event system.
- 30 hand-distributed nodes across 3 themed worlds, 10 node types, 5 visual states, AI-powered dialog with forecast + explain, floating +XP animation, confetti on milestones, bottom floating action bar with 6 navigation shortcuts.
- Foundation files untouched. Lint clean, types clean, dev server healthy.
