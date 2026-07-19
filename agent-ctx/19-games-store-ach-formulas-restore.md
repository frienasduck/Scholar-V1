# Task 19-games-store-ach-formulas-restore — Work Record

**Status**: ✅ COMPLETE  
**Agent**: subagent (cinematic-bg-restorer)  
**Started**: 2025-01  
**Finished**: 2025-01

## Objective
Restore cinematic video backgrounds (video + dark overlay + glass cards) to 4 views that had regressed to plain layouts: `games.tsx`, `store.tsx`, `achievements.tsx`, `formulas.tsx`. Preserve ALL existing functions, state, and handlers.

## What was done (per file)
For each of the 4 files, applied the same 4-step transformation:

1. **Wrap main return** in cinematic layout:
   ```tsx
   <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
     <style>{`…cinema-glass CSS…`}</style>
     <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-40">
       <source src="<VIDEO_URL>" type="video/mp4" />
     </video>
     <div className="absolute inset-0 z-0 bg-black/50" />
     <div className="relative z-10 p-4 md:p-8 lg:p-12">
       <h1 className="cinema-font-serif text-4xl text-white mb-6">…<em>…</em>…</h1>
       <div className="space-y-6 view-enter">…existing content…</div>
     </div>
   </div>
   ```

2. **Hero headlines** added per view:
   - games: "Play, Learn, and *Earn* Rewards"
   - store: "Power Your *Study*"
   - achievements: "Level Up *Faster*"
   - formulas: "Master Every *Formula*"

3. **Video URLs** (per spec):
   - games: `hf_20260210_031346_d87182fb-b0af-4273-84d1-c6fd17d6bf0f.mp4`
   - store: `hf_20260328_065045_c44942da-53c6-4804-b734-f9e07fc22e08.mp4`
   - achievements: `hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4`
   - formulas: same URL as achievements

4. **Card → cinema-glass div conversions**:
   - `<Card className="premium-card…">` → `<div className="cinema-glass rounded-2xl…">`
   - `</Card>` → `</div>`
   - Removed unused `import { Card }` from each file.

## Per-file Card conversion counts
| File | Cards converted |
|------|------------------|
| games.tsx | 1 (catalog item card) |
| store.tsx | 2 (catalog item card, submitted-requests card) |
| achievements.tsx | 5 (Level card, Lucky Wheel card, Badge card [template-literal className], Milestone card, Leaderboard card) |
| formulas.tsx | 2 (search/filters card, formula item card) |

## Files touched
- `/home/z/my-project/src/components/views/games.tsx`
- `/home/z/my-project/src/components/views/store.tsx`
- `/home/z/my-project/src/components/views/achievements.tsx`
- `/home/z/my-project/src/components/views/formulas.tsx`

(No foundation files modified.)

## Issues encountered & resolved
- **Initial lint failure**: After first edit pass, `formulas.tsx` had a JSX parse error (`Unexpected token at line 305`). Root cause: missing one closing `</div>` for the new outer `relative min-h-…` wrapper. Added the missing `</div>` — lint now passes cleanly (0 errors).
- **Unused import warning**: Each file had `import { Card }` left over after converting all Card usages. Removed the import line in each of the 4 files to keep ESLint clean.
- **Pre-existing community.tsx errors**: ESLint initially reported `'Card' is not defined` errors in `community.tsx` — these turned out to be stale/false positives caused by the formulas.tsx parse error breaking ESLint's run. After fixing formulas.tsx, those errors disappeared.

## Verification
- `cd /home/z/my-project && bun run lint` → ✅ clean (0 errors, 0 warnings)
- Dev server log shows `GET / 200` (page compiles and renders)
- grep confirms zero remaining `<Card`, `</Card>`, or `<Card className="premium-card` in any of the 4 target files.

## What was NOT changed (per task rules)
- No functions, state, handlers, hooks, or game sub-components modified.
- For games.tsx: only the `GamesView()` main return was wrapped. Individual game components (`MemoryMatchGame`, `WordHuntGame`, `FormulaInvadersGame`, `ZombieMathsGame`, `PlaceholderGame`) left untouched.
- No foundation files modified.
