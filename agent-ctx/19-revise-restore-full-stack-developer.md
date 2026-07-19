# Task 19-revise-restore — Cinematic Video Backgrounds for 5 Revise Views

**Agent**: full-stack-developer
**Date**: 2025 session
**Task**: Restore cinematic video backgrounds to 5 "Revise" views that lost them.

## Files Modified
1. `src/components/views/flashcards.tsx`
2. `src/components/views/quiz.tsx`
3. `src/components/views/exam-prep.tsx`
4. `src/components/views/planner.tsx`
5. `src/components/views/focus.tsx`

## Approach
- For each view, wrapped ONLY the main "home/browse" return in a cinematic structure (left early-return phases like study mode, taking quiz, results alone — they have their own immersive designs).
- Structure: cinema wrapper (`relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6`) → `<style>` tag (cinema-glass CSS with Inter + Instrument Serif fonts) → `<video>` (CloudFront MP4 at opacity-40) → `bg-black/50` overlay → content wrapper (`relative z-10 p-4 md:p-8 lg:p-12`) → hero headline → original content.
- Converted premium-card Cards to cinema-glass divs (8 Cards total) within main view returns + sub-components rendered in scope. Preserved template-literal classNames (focusMode/isToday conditionals).
- Video URL used (same for all 5): `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4`

## Hero Headlines Added
- flashcards: `Master with <em>Spaced</em> Repetition`
- quiz: `Test Your <em>Knowledge</em>`
- exam-prep: `Exam <em>Readiness</em> Dashboard`
- planner: `Plan Your <em>Success</em>`
- focus: `Focus <em>Deeply</em>`

## Cards Converted (8 total)
- exam-prep: 7 Cards (readiness ring, rank prediction, 2× mock test, generated-questions, 2× PYQ, question banks, time mgmt)
- planner: 3 Cards (MonthView calendar + side panel, WeekView day cell)
- focus: 3 Cards (timer, ambient sounds, recent sessions)
- flashcards: 2 Cards (All-caught-up, DeckPanel)
- quiz: 2 Cards (Start-a-quiz setup, Recent attempts)

## Cards Left as premium-card (in early-return phases)
- flashcards study mode: uses `<div className="... premium-card ...">` (not Card component) — untouched
- quiz taking phase: `<Card className="premium-card p-5 sm:p-7">` — untouched
- quiz ResultsScreen: `<Card className="premium-card p-6 sm:p-8 relative overflow-hidden">` + per-question review Card — untouched

## Verification
- `bun run lint`: 0 errors, 0 warnings across the repo
- All 5 views compile cleanly
- No functions/state/handlers/logic modified — only visual wrapper + Card→div className swaps + headline additions

## Notes for Future Agents
- The cinema-glass CSS class is defined via a `<style>` tag inside each view's main return. It's only in the DOM when the main view is mounted. For sub-phases that use early returns (quiz taking/results, flashcards study mode), the CSS class is NOT defined, which is why Cards in those phases were left as premium-card.
- The cinema wrapper uses `-m-4 lg:-m-6` to escape the app-shell's content padding and fill the viewport edge-to-edge with the video bg.
- For focus.tsx, the cinema wrapper coexists with the focusMode full-screen branch: when focusMode is on, the inner `view-enter relative fixed inset-0 z-50` div floats above the cinema wrapper (covering the video), and the focus-mode gradient bg + ambient orbs render correctly.
