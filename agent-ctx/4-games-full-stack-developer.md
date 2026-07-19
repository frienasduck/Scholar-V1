# Task 4-games — Formula Invaders & Zombie Maths mini-games

**Agent**: full-stack-developer
**Task**: Implement two fully-playable mini-games (Formula Invaders, Zombie Maths) in `src/components/views/games.tsx`

## What was built

### 1. Formula Invaders (`FormulaInvadersGame`)
- Space-Invaders-style math shooter rendered as DOM (absolute positioning + framer-motion explosions)
- 20 CBSE Class 9 problems tagged by difficulty 1-4 (polynomials, linear equations, algebraic identities, Heron's, surface areas, percentages, square roots)
- `pickFIProblem(wave)` scales problem difficulty with wave (max difficulty = `min(4, 1 + floor(wave/2))`)
- Enemies descend in rows (1-3 rows, 5 per row) moving side-to-side; on edge hit they reverse + descend (3x faster during wrong-answer penalty)
- Player cannon at bottom (🚀) moves with ←/→ or A/D; aim is cosmetic, bullets auto-target nearest enemy
- 4 answer choice buttons; click or press 1/2/3/4 to fire; Space/↑ fires currently-selected
- Correct answer → destroys lowest alive enemy + 💥 explosion + score (10 × wave + combo bonus) + new problem
- Wrong answer → `wrongPenalty = 1800ms` (enemies descend 3x faster on next edge hit) + toast with correct answer
- Combo system: consecutive correct answers build combo, x3+ triggers special toast
- Wave clear when all enemies destroyed → next wave spawns (more rows, faster speed, harder problems) + toast
- 3 lives (hearts in HUD), game over when any enemy reaches player line
- On game over: `recordGameResult("formula-invaders", score, min(50, floor(score/10)))` + `pushActivity({type:"game", text:"Played Formula Invaders — scored X", icon:"🚀"})` (fired once via `recordedRef`)
- Game over screen: score, coins earned, "Play again" (resets state) + "Close" (calls `onClose`)

### 2. Zombie Maths (`ZombieMathsGame`)
- Survival typing game: zombies approach from right toward defender (🛡️ NEHA) on left
- 3 zombie types color-coded: 🟢 slow-easy, 🟡 medium-medium, 🔴 fast-hard (each with 10 problems)
- Type probability shifts with wave (wave 1 mostly slow, wave 3+ mostly medium/fast)
- Each zombie has equation badge (e.g. "3x = 12 = ?"); player types answer in input + Enter to shoot nearest
- Answer normalization (trim, lowercase, −→-, ²→^2) so "x^2-1" matches "x²−1"
- Correct → zombie rotates+fades+explodes via framer-motion exit animation, removed after 400ms
- Wrong → input flashes red 450ms, zombie keeps coming
- 3 lives; zombie reaching x≤6% breaches (-1 life), toast warning
- Wave system: clear 5 zombies → next wave (faster spawn, faster zombies, harder pool) + toast
- Spawn rate decreases per wave (`max(1200, 2800 - wave*220)` ms)
- On game over: `recordGameResult("zombie-maths", defeated, min(60, defeated*3))` + `pushActivity({type:"game", text:"Defeated X zombies!", icon:"🧟"})` (fired once via `recordedRef`)
- Game over screen: defeated count, coins earned, "Play again" + "Close"

## Architecture (React Compiler compliant)

Both games use the same pattern to satisfy `react-hooks/refs` and immutability rules:

- **Single React state object** (`useState<FIState>` / `useState<ZState>`) holds all game state — rendered directly, no ref reads during render
- **`stateRef`** mirrors state via `useEffect(() => { stateRef.current = state; }, [state])` — used by rAF loop and event handlers for synchronous reads/writes (allowed: refs in effects/handlers, not render)
- **Game loop** uses `requestAnimationFrame` inside `useEffect([])`; each frame reads `stateRef.current`, computes next state **immutably** (all `.map()`/spread, no mutation), writes `stateRef.current = next`, calls `setState(next)`
- **Event handlers** (`fireAnswer`, `shoot`, `moveLeft`, `moveRight`, keyboard) use the same immutable pattern — read ref, compute new state, write ref + setState, then fire side effects (toasts, setProblem)
- **Keyboard handler** uses `fireAnswerRef` / `selectedAnswerRef` synced via `useEffect` so the listener registers once (`[]` deps) instead of re-registering every frame
- **Game-over recording** uses a `recordedRef` + `useEffect` watching `state.over` — fires `recordGameResult` + `pushActivity` exactly once, no setState in effect
- **Helpers** (`spawnWaveData`, `spawnZombieInto`, `createFIState`, `createZState`, `pickFIProblem`) are pure module-level functions outside the component

## Wiring into GamesView

- Added `formula-invaders` and `zombie-maths` branches to the modal switch (around line 1500)
- Subtitle updated: "8 games · 2 fully playable now" → "8 games · 4 fully playable now"
- The existing `handlePlay` already routes all non-featured games to `setActiveGame(g)`, and the unlock flow (`purchaseItem` + `unlockGame`) already works for the 200/300-coin costs — no changes needed there
- `GameDef` interface has no `playable` field, so none added

## Lint / type status
- `bun run lint` → exit 0 (0 errors, 0 warnings across whole project)
- `npx tsc --noEmit` → 0 errors in games.tsx
- Dev server compiles cleanly, all GET / return 200

## Files modified
- `src/components/views/games.tsx` (only file touched; foundation files untouched per instructions)
