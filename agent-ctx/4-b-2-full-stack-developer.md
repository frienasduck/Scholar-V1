# Task 4-b-2 — Smart Reminder Center (full-stack-developer)

## Assignment
Build the `RemindersView` for Neha's Scholar — a cinematic glassmorphism Smart Reminder Center that generates context-aware reminders from live store data (mastery, studyProgress, tasks, streak, flashcards), merges them with AI-generated reminders, and supports snooze / dismiss / custom / DND / category filters.

## File
- `/home/z/my-project/src/components/views/reminders.tsx` (overwritten completely, 1561 lines)

## What was built
1. **Cinematic hero** — staggered Framer Motion entrance, Instrument Serif italic title "Smart Reminders", subtitle with student's name, 4 stat pills (Active / Due Today / Snoozed / Dismissed) + DND toggle + "Refresh Smart Reminders" + "Create Reminder" actions.
2. **Rule-based reminder engine** (`buildRuleReminders`):
   - Revision: chapters with `studyProgress > 0` and deterministic `hashDaysAgo(chapterId)` >= 7 days → "You haven't revised X in N days."
   - Exams: tasks with `type="exam"` within 14 days → "Your X exam is in N days."
   - Forgetting curve: subjects with `mastery < 50%` cross-referenced with a studied chapter → "You're likely to forget X tomorrow."
   - Streak risk: `streak > 0 && lastStudyDay !== today` → "Streak at risk — study 1 chapter today…"
   - Flashcards due: Leitner box < 3 or lastReviewed >= 1 day → "N flashcards due for review."
3. **AI refresh** — `askAIJSON` with full store snapshot (mastery, studyProgress, tasks, streak, flashcards, dueFlashcards) → returns `{ reminders: [{ id, type, priority, title, detail, action }] }`. Merged with rule reminders, deduped by normalised title, sorted by priority then recency. Clears snooze/dismiss state on AI reminders so they re-surface.
4. **Reminder cards** — glass cards with color-coded urgency (red/amber/blue by priority), type icon, priority + type + critical + custom + DND + snooze-until pills, title, detail, relative timestamp, actions: Snooze 1h / 3h / Tomorrow, Dismiss, Take Action (toast + XP/coins reward).
5. **Category filter chips** — All / Revision / Exams / Streak / Flashcards / Custom (apply to all tabs).
6. **Custom reminders** — Dialog with title, message, datetime-local, repeat (none/daily/weekly), category. Saved to `localStorage("sr-custom")`. `nextOccurrence()` computes next due for repeating reminders. Custom tab + active feed both show them; delete supported.
7. **Snooze & dismiss** — `localStorage("sr-state")` persists `{ snoozedUntil, dismissedAt }` per reminder ID. Snoozed tab shows sleeping reminders with "Wake now" + countdown. Dismissed tab shows dismissed with per-card + bulk "Restore all" / "Clear all". 30-second tick auto-wakes expired snoozes.
8. **Tabs** — Active / Snoozed / Dismissed / Custom (with live count badges).
9. **DND toggle** — Switch in header, persisted to `localStorage("sr-dnd")`. Non-critical reminders get muted (opacity-55) + "DND" pill; critical reminders always show.

## Style fidelity
- Background video (autoplay/muted/loop/playsInline, object-cover, z-0) + `bg-black/55` overlay.
- Unique `sr-` prefix for all CSS classes (`sr-glass`, `sr-glass-strong`, `sr-serif`, `sr-sans`, `sr-tw`, `sr-tm`, `sr-tf`, `sr-scroll`, `sr-pulse`).
- Inline `<style>` block with @import for Instrument Serif + Inter.
- shadcn override selectors (`[data-slot="dialog-content"]`, `[data-slot="tabs-list"]`, etc.) so Dialog/Tabs render correctly on the video.
- Framer Motion staggered entrance on hero, `whileHover={{ y: -2 }}` on cards, `AnimatePresence mode="popLayout"` for card exit animations.
- Responsive: mobile-first, `flex-wrap` action rows, horizontal-scroll TabsList.

## Lint result
`bun run lint` → **0 errors, 0 warnings** (after fixing a `<div>...</motion.div>` mismatch and removing a stale eslint-disable comment).

## Notable implementation details
- `useStore.getState()` used inside `buildRuleReminders()` (pure function called from `useMemo`) to read live store without subscribing to every field individually — memo deps still trigger recompute on the relevant slices.
- Deterministic `hashStr`/`hashDaysAgo` (FNV-1a) so "days since last revised" is stable across renders (same pattern as revision-hub).
- AI prompt asks for 4-6 reminders with strict JSON shape; response is sanitised (type/priority validated against allowed unions, fallbacks for missing fields).
- `takeAction` awards +2 XP / +1 coin and pushes an activity entry, mirroring planner.tsx's reward pattern.
