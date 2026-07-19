# Task 5-cortis-simulator — Cortis Simulator fullscreen K-pop management sim

**Agent**: full-stack-developer
**Task**: Build Cortis Simulator (fullscreen K-pop group management game) and wire into GamesView.

## Files
- Created `src/components/cortis-simulator.tsx` — ~1100-line `"use client"` component exporting `CortisSimulator({ onClose })`.
- Edited `src/components/views/games.tsx` — added import + `cortisOpen` state + replaced featured-banner Play handler with `setCortisOpen(true)` (when unlocked) + re-purposed coming-soon modal into unlock prompt + rendered `<CortisSimulator>` at end of GamesView.

## Key implementation notes
- Pure `applyActivity(s, activity, selectedMember)` function — no setState in updater, returns new GameState.
- Auto-save: `useEffect([state])` writes localStorage (side effect only, no setState) + 8s interval mount-effect using `stateRef`.
- Random events + Red Red modal triggered via `setTimeout` from event handlers (not effects) → React Compiler compliant.
- Esc handler: closes modals first, then `onClose()` prop.
- Completion rewards (`addCoins(500) + addXP(500)`) fire once via `rewardedRef` guard inside a `useEffect` watching `state.ended && endingType === "legend"`.
- 5 members with exact names/stats per spec; 19 activities; 10 random events; 16-bar animated equalizer + 8-line lyrics for "Red Red"; 8-region popularity + 5-type fan breakdown; 3 endings (legend/disbandment/bankruptcy).

## Lint / type status
- `bun run lint` → exit 0 (clean across whole project).
- `bunx eslint` on both files → no output (clean).
- `bunx tsc --noEmit` → no errors in my files.
- Dev server compiles successfully after changes.
