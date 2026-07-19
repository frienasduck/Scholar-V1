---
Task ID: REBUILD-1
Agent: full-stack-developer
Task: Rebuild Past Papers, Answer Lab, Revision Hub, Mock Exam views

Work Log:
- Read /home/z/my-project/worklog.md for project context (Neha's Scholar premium CBSE Class 9 study OS — Next.js 16 App Router, TS strict, Tailwind 4, shadcn/ui New York, Zustand persisted store, askAI/askAIJSON helpers, exportPDF/mdToHtml, CURRICULUM with 5 subjects × ~15 chapters, shared StatCard/Markdown/etc.).
- Inspected the 4 stub files (each was a 4-line placeholder loading div).
- Studied exam-prep.tsx as a cinematic design reference — confirmed pattern: `<div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">` to negate main's `p-4 lg:p-6`, video bg + dark overlay + glass panels + Instrument Serif italic display + Inter body + framer-motion staggered entrances.
- Verified app-shell.tsx imports `PastPapersView / AnswerLabView / RevisionHubView / MockExamView` and wires them at view ids `past-papers`, `answer-lab`, `revision-hub`, `mock-exam`.
- Confirmed store API: `addXP(n)`, `addCoins(n)`, `pushActivity({type,text,icon})`, `setStudyProgress(chapterId, v)`, `studyProgress` and `mastery` keyed records.
- Confirmed Progress component does NOT accept `indicatorClassName` (only `className` + `value`) — kept all Progress usages compatible.

Rebuilt all 4 view files in /home/z/my-project/src/components/views/:

1. **past-papers.tsx** (949 lines) — `PastPapersView`:
   - Video: pp-…204221…e73d-4ab0-9c65-79c18c66fd50.mp4 (per spec), CSS prefix `pp-`, dark overlay bg-black/55.
   - Hero with italic serif title "Past Papers & Question Bank" + 4 stat pills (Questions / Subjects / Timed Sessions / Mistakes Tracked).
   - 24 hand-crafted CBSE Class 9 questions — Maths 6, Science 7, SST 6, English 5 — each with board/subject/chapter/difficulty/year/type/marks/question/options/answer/explanation.
   - Filter bar: Board (CBSE), Subject, Chapter (auto-populated from question set), Difficulty, Year, Type, plus keyword search Input.
   - Tabs: Question Bank | Timed Practice | Mistake Tracker | AI Similar.
   - Question Bank: staggered entrance cards with subject/difficulty/year/type pills, MCQ options shown (correct highlighted), answer+explanation card, "AI Similar Questions" button per question that calls askAIJSON to generate 3 variants (stored by qid in state, surfaces in AI Similar tab).
   - Timed Practice: Dialog with 15-min countdown, 10 MCQs sampled from question bank, radio answer selection, auto-submit on 0:00 or manual Submit, instant marking + per-question review with correct/incorrect highlighting, awards +5 XP +2 coins per correct, wrong answers auto-saved to mistake tracker.
   - Mistake Tracker: localStorage `pp-mistakes` (load on mount, save on append, max 100), shows each mistake with question, chosen vs correct answer, explanation, clear-all button, empty state.
   - AI Similar tab: shows AI-generated variants grouped by parent question with answers + explanations.
   - Export Practice button (top-right) → exportPDF with filtered question list, filters applied, all answers + explanations.
   - Responsive mobile-first: stat pills grid-cols-2 → md:grid-cols-4; question options grid-cols-1 → sm:grid-cols-2; filters grid-cols-2 → lg:grid-cols-6.

2. **answer-lab.tsx** (766 lines) — `AnswerLabView`:
   - Video: pp-…204103…f607742e…, CSS prefix `al-`.
   - Hero italic serif "Answer Writing Lab" + 3 stat pills (Questions / Evaluated / Avg Score).
   - 12 hand-crafted descriptive questions across 6 subjects (English 2, History 2, Biology 2, Economics 2, Geography 2, Civics 2) — each with marks/keywords[]/modelAnswer/hint.
   - Tabs: Practice | History | Tips.
   - Practice: 2-column layout — left = question picker (ScrollArea with all 12 questions, subject+marks badges, line-clamp preview); right = question card (with hint + expected keyword chips) + answer editor (Textarea rows=12) + Upload Handwritten button (file input accept image/*, FileReader→base64 preview, max 3MB) + Reset + Evaluate with AI button.
   - AI Evaluation: askAIJSON with detailed prompt → returns {predictedMarks, breakdown{structure,grammar,keywords,content,presentation}, keywordsHit[], keywordsMissed[], strengths[], improvements[], modelAnswer}. Renders score header, criteria breakdown (5 Progress bars), keywords hit/missed chips, strengths/improvements bulleted lists, AI model answer card, Rewrite Suggestion panel with "Generate Rewrite" button.
   - Awards +8 XP +4 coins per evaluation, logs to history with `hasImage` flag.
   - History tab: localStorage `al-history` (max 50), shows subject/marks/pct/keyword chips/timestamps, clear-all button, empty state.
   - Tips tab: 6 tip cards (Structure, Keywords, Word Count, Examples, Presentation, Read Question Twice) with icons and accent colors.
   - Export Eval button (inside result panel) → exportPDF with question, your answer, marks, breakdown table, strengths/improvements, keywords, model answer.
   - Rewrite suggestion: askAIJSON returning `{rewritten: string}` with fallback handling.

3. **revision-hub.tsx** (740 lines) — `RevisionHubView`:
   - Video: pp-…230229…7c9bc431…, CSS prefix `rh-`.
   - Hero italic serif "Revision Hub" + 4 stat pills (Due Today / Weak Chapters / Day Streak / Sessions Logged).
   - 14-day Revision Streak dot grid (localStorage `rh-streak` as ISO date strings, max 30 entries) — gradient-filled active dots with orange glow, 14-day grid with weekday labels.
   - Topics Due Today: deterministic hashLastRevised(chapterId) gives stable per-chapter last-revised timestamp spread over past 35 days; spaced-repetition intervals [1, 3, 7, 14, 30] days per box (box = floor(progress/20)+1); surfaces chapters where elapsed ≥ interval, sorted by days overdue; shows box label, days overdue badge, progress bar, Start Revision button.
   - Weak Chapters: subjects with mastery < 50% surface their 2 least-studied chapters; each card has mastery badge, progress bar, Revise Now button.
   - Forgotten Concepts tab: AI prediction via askAIJSON — sends 6 worst overdue chapters with summaries + daysSince; returns `{forgotten:[{concept,chapter,reason,lastRevised}]}`. Predict button on the hero card; loading/empty states.
   - One-Click Revision Session Dialog: askAIJSON returns `{points[5], keyTerms[6], takeaway}` for the selected chapter; renders 5-point summary, key terms chips, essence callout; "I remember" / "Need review" footer buttons that bump studyProgress (+8 or +4), log to `rh-sessions` localStorage (max 50), update streak, award +10 XP +5 coins, push activity.
   - History tab: shows all logged sessions with outcome badge (Remembered/Need Review), chapter title, subject, timestamp; clear button.
   - Export Plan button → exportPDF with due-today list (top 12), weak chapters list, spaced-repetition strategy, current streak.

4. **mock-exam.tsx** (1168 lines) — `MockExamView`:
   - Video: pp-…131748…f2ca2a28…, CSS prefix `me-`.
   - Hero italic serif "Mock Exam Center" + 4 stat pills (Mocks Taken / Avg Score / Best Score / Leaderboard rank).
   - Tabs: Generate | Past Mocks | Leaderboard.
   - Generate tab: Exam Configuration card with 6 controls (Subject from CURRICULUM, Difficulty easy/medium/hard, Pattern balanced/mcq-heavy/descriptive-heavy, Duration 30/60/90/120 min, Num Questions 5/10/15/20/25, subject preview tile). "Generate AI Mock Exam" button calls askAIJSON with detailed prompt specifying 3-section split (MCQ 1m, short 2m, long 4m) → returns `{title, subject, sections[{name,type,marksPerQ,questions[]}]}`.
   - Paper preview card: shows title, section breakdown, total marks, Start Exam / Discard buttons.
   - Exam Runner: 2-column layout — left = question card (section/type/marks/difficulty pills, MCQ RadioGroup or short/long Textarea), Prev/Next nav with "Q X of Y" progress, timer (turns red+pulse <60s), Submit Exam button on last question; right = question palette (per-section grid of numbered buttons colored by answered status, legend, Submit Now button).
   - Auto-submit on timer expiry. Auto Evaluation: MCQs instant (awarded = marks if response===answer, else 0); short/long via sequential askAIJSON calls with prompt `{marks, feedback, keywordsHit, keywordsMissed}` and fallback to keyword-count ratio if AI fails.
   - Results Dialog: score header (big % circle, marks/total, time, verdict), per-section breakdown (3 Progress bars), difficulty analysis (per-difficulty Progress bars), Rank Prediction panel (AI askAIJSON returning classRank/classSize/schoolRank/schoolSize/percentile/verdict — fetched after submit, can be re-triggered), per-question review (color-coded by score, shows your answer + AI feedback + correct answer + explanation). Export Result button → exportPDF with full paper review + rank table.
   - Awards +15 XP +8 coins on submit, pushes activity.
   - Past Mocks tab: localStorage `me-history` (max 20), shows mock cards with subject/difficulty/time/pct/View button → reopens Results Dialog.
   - Leaderboard tab: simulated Indian CBSE Class 9 leaderboard (10 student names with avatar emojis + schools), user (Neha Salah 🌟) inserted at rank based on best score, rank highlighting, medals for top 3, color-coded scores, "Your rank: #X of N" header.
   - All Progress components use only `className` + `value` (no `indicatorClassName` — fixed during TS check).

Stage Summary:
- 4 view files rebuilt from scratch and saved:
  • /home/z/my-project/src/components/views/past-papers.tsx — 949 lines
  • /home/z/my-project/src/components/views/answer-lab.tsx — 766 lines
  • /home/z/my-project/src/components/views/revision-hub.tsx — 740 lines
  • /home/z/my-project/src/components/views/mock-exam.tsx — 1168 lines
  Total: 3,623 lines of cinematic, fully-featured TypeScript React.
- Each view self-contained: own CSS prefix (pp-/al-/rh-/me-), own background video URL, own localStorage keys (pp-mistakes, al-history, rh-streak, rh-sessions, me-history), no shared state between views beyond the Zustand store + askAIJSON/exportPDF helpers.
- All 4 views render inside the existing app-shell (no navbar/footer added); root div uses `-m-4 lg:-m-6` to negate main's padding for full-bleed video background.
- All 4 views use the same cinematic glassmorphism pattern: autoplay-muted-loop-playsInline video → bg-black/55 overlay → z-10 content → Instrument Serif italic display + Inter body → framer-motion staggered entrances + hover lifts → responsive mobile-first.
- AI integrations via askAIJSON: AI Similar Questions (past-papers), AI Evaluation + Rewrite (answer-lab), AI Revision Summary + Forgotten Concepts Prediction (revision-hub), AI Paper Generation + per-question descriptive evaluation + Rank Prediction (mock-exam).
- XP/Coins awarded per spec: +5 XP/+2 coins per correct timed question, +8 XP/+4 coins per answer evaluation, +10 XP/+5 coins per revision session, +15 XP/+8 coins per mock exam submission.
- Verification:
  • `bun run lint` → EXIT 0 (0 errors, 0 warnings).
  • `bunx tsc --noEmit` → 0 errors in any of the 4 rebuilt files (only out-of-scope errors in examples/ and skills/ folders).
  • Dev server log shows clean recompiles with GET / 200 responses.
- Fixed mid-build issues:
  • Removed `indicatorClassName` prop from all Progress components (not supported by the local shadcn/ui Progress — only accepts `className` + `value`).
  • Replaced inferred discriminated union with explicit `LeaderEntry` interface + typed `peers: LeaderEntry[]` and `all: LeaderEntry[]` to fix the `unknown` → `ReactNode` error in the Mock Exam leaderboard.
- Foundation untouched: store.ts, ai.ts, curriculum.ts, nav.ts, shared.tsx, pdf.ts, ui/*, app-shell.tsx — not modified. No new dependencies added.
