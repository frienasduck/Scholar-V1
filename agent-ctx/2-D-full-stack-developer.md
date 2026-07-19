# Task 2-D — Planner, Focus, Resources, Study Views

## Scope
Built 4 client view components for Neha's Scholar (Class 9 CBSE study OS):
- `src/components/views/planner.tsx` — PlannerView
- `src/components/views/focus.tsx` — FocusView
- `src/components/views/resources.tsx` — ResourcesView
- `src/components/views/study.tsx` — StudyView

## Key implementation notes

### Planner
- Header tabs: Month / Week / List + "New task" dialog + "AI Schedule" dialog (asks goal, calls `askAIJSON("Create a 7-day CBSE Class 9 study plan…", "academic-coach")`, bulk-adds via `addTask`).
- Month view: custom 7-col grid, subject-colored dots per day, click-to-select-day side panel.
- Week view: 7 columns Mon-Sun, task cards with subject color bar, time, priority dot, click-to-complete.
- List view: grouped by Overdue / Today / Upcoming / Completed with checkboxes, badges, delete.
- Completion: `toggleTask` + `addXP(10)` + `addCoins(3)` + `pushActivity({type:"task",…})` + toast.

### Focus
- SVG circular progress ring with indigo→teal gradient (`url(#ring-grad)`).
- Mode tabs: Pomodoro (25:00), Short Break (5:00), Long Break (15:00), Stopwatch (count up).
- Controls: Start/Pause, Reset, Skip, Focus-Mode toggle.
- Subject tag selector.
- Completion logic: pomodoro → `addSession({type:"pomodoro",duration:1500,subject})` + `addXP(15)` + `addCoins(5)` + `bumpStreak()` + `pushActivity({type:"focus",…})` + toast + auto-switch to Short Break.
- Web Audio API ambient sounds: Rain / Forest / Café — generates brown noise + amplitude modulation in an AudioBuffer, plays via looping BufferSource + BiquadFilter chain. Volume slider controls GainNode.
- Focus Mode: fixed inset overlay with calming radial-gradient background + ambient orbs, hides stats/ambient/recent sections, shows big timer + exit button.

#### Lint-rule refactors (focus.tsx)
The Next 16 / React Compiler lint rules `react-hooks/set-state-in-effect` and `react-hooks/refs` are strict. I refactored:
- Replaced the `useEffect` that reset `remaining` on mode change with an explicit `switchMode()` callback invoked from the UI (setMode + setRemaining + setRunning in one handler call).
- Replaced the `useEffect` that detected completion by checking `remaining === 0 && running` with a deferred completion inside the interval's `setRemaining` updater (`setTimeout(() => handleCompleteRef.current(), 0)`), where `handleCompleteRef` is updated in its own effect.
- `handleComplete` calls `switchMode("short")` / `switchMode("pomodoro")` for auto-advance.

### Resources
- 5-subject tabs (Maths/Science/English/SST/Hindi) with CURRICULUM colors + icons.
- Chapter grid: progress ring, summary preview, bookmark icon.
- Search bar: filters chapters across ALL subjects (global search results block).
- Bookmarked section at top (when bookmarks exist).
- Chapter detail dialog: hero with progress, concepts chips, formulas block (if any), important questions list. Actions: Generate PDF (`exportPDF` + `mdToHtml`), Create Flashcards (`addFlashcard` per concept), Start Quiz (toast), Add to Planner (`addTask` for today), Bookmark (`toggleBookmark`).

### Study
- Subject selector limited to Science + SST (per spec).
- Left: chapter list with per-chapter progress bar + checkmark when 100%.
- Right: textbook-style reader with hero (ProgressRing), Introduction, Key Concepts (cards with "Explain with AI" → `askAI(prompt, personaFor(subject))` in a dialog), Important Points (bullets), Formulas (styled block), Examples (2 questions with hidden "show approach"), Summary, Quick Revision (3 auto-generated MCQs from concepts, interactive with correct/wrong feedback).
- Mark as studied: `setStudyProgress(chapter.id, 100)` + `addXP(20)` + `addCoins(5)` + `pushActivity` + toast (only awards XP if was <100%).
- Save as Note: builds lesson markdown and calls `addNote({title, content, folder: subject.name, …})`.
- Prev/Next chapter navigation.
- AI persona: science → "dr-meera", sst → "arjun".

## Verification
- `bun run lint`: my 4 files produce 0 errors, 0 warnings.
- The only remaining lint error in the repo is `ai-tutor.tsx:477` (parsing error) — outside my scope.
- Dev log shows no `Module not found` or compile errors for planner/focus/resources/study (only for views built by sibling agents like settings/files).

## Files written (4)
- `/home/z/my-project/src/components/views/planner.tsx` (~560 lines)
- `/home/z/my-project/src/components/views/focus.tsx` (~460 lines)
- `/home/z/my-project/src/components/views/resources.tsx` (~370 lines)
- `/home/z/my-project/src/components/views/study.tsx` (~330 lines)

All views export the named component AND a default export for flexibility.
