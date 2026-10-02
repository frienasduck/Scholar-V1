import { currentTask, elapsedMs, remainingSeconds, subjectChapter, type Action, type ExamSession, type Setup, type Task, type TaskKind } from "./model";
export function strategy(minutes: number, untilExam: number) { return Math.min(minutes, untilExam) <= 30 ? "emergency" : Math.min(minutes, untilExam) <= 90 ? "rapid repair" : untilExam <= 420 ? "deep preparation" : untilExam <= 4320 ? "spaced preparation" : "long-horizon preparation"; }
export function plan(setup: Setup, seconds: number, attempts: ExamSession["attempts"] = [], version = 1, now = Date.now()): Task[] {
    if (seconds < 1)
        return [];
    const mode = strategy(seconds / 60, (setup.examAt - now) / 60000), emergency = mode === "emergency", short = seconds <= 5400;
    const drafts: (Omit<Task, "seconds"> & {
        weight: number;
    })[] = [];
    const add = (c: Setup["chapters"][number], kind: TaskKind, weight: number, title: string, reason: string, priority: Task["priority"] = "high", topics?: string[]) => {
        const chapter = subjectChapter(setup, c.subjectId, c.chapterId)!;
        const id = `v${version}-${drafts.length}`, previous = drafts.at(-1)?.id;
        const coverage = topics?.length ? topics : chapter.concepts.length ? chapter.concepts : [chapter.title];
        const objective = kind === "diagnostic" ? `Check your starting understanding of ${chapter.title}; this is a diagnostic, not a repeated lecture.` : kind === "practice" ? `Solve new ${chapter.title} questions using the concepts you just studied. Attempt first, then review the reasoning.` : kind === "recall" ? `Retrieve ${chapter.title} from memory before viewing explanations.` : kind === "mistakes" ? `Repair recorded errors and check common traps in ${chapter.title}, without restarting the chapter.` : kind === "mock" ? "Take a timed final check across your selected chapters, then review the results." : kind === "break" ? "Take a short optional reset." : `Learn and check: ${coverage.join("; ")}.`;
        drafts.push({ id, subjectId: c.subjectId, chapterId: c.chapterId, topic: coverage.length === 1 ? coverage[0] : `${chapter.title} · ${kind === "diagnostic" ? "baseline" : "chapter coverage"}`, topics: coverage, kind, title: `${title} · ${chapter.title}`, objective, reason, priority, status: "pending", prerequisite: previous, checkpoint: "Answer an inline question before moving on. Completing a card alone does not demonstrate mastery.", weight });
    };
    const ranked = [...setup.chapters].sort((a, b) => {
        const weakness = (c: typeof a) => { const evidence = attempts.filter(t => t.subjectId === c.subjectId && t.chapterId === c.chapterId); return evidence.length ? 1 - evidence.filter(t => t.correct).length / evidence.length : (6 - c.confidence) / 5; };
        return weakness(b) - weakness(a);
    });
    if (setup.diagnostic && attempts.length === 0 && !emergency)
        add(ranked[0], "diagnostic", .3, "Quick calibration", "Self-reported confidence guides the starting point; answers calibrate it.");
    for (const c of ranked) {
        const answers = attempts.filter(a => a.subjectId === c.subjectId && a.chapterId === c.chapterId), accuracy = answers.length ? answers.filter(a => a.correct).length / answers.length : null;
        const known = accuracy !== null ? accuracy >= .8 : c.confidence >= 4;
        const kind: TaskKind = emergency ? "revise" : known ? "recall" : c.confidence <= 2 || accuracy !== null && accuracy < .4 ? "learn" : "repair";
        const concepts = subjectChapter(setup, c.subjectId, c.chapterId)!.concepts;
        const groups = !emergency && !known && !short && concepts.length ? concepts.map(topic => [topic]) : [concepts];
        for (const topics of groups)
            add(c, kind, (known ? .65 : 1.4 + (5 - c.confidence) * .2) / groups.length, emergency ? "High-yield recall" : groups.length > 1 ? topics[0] : kind === "learn" ? "Teach from foundations" : kind === "repair" ? "Repair the gaps" : "Verify what you know", emergency ? "Short time: essential formulas, definitions and traps first. No long videos." : known ? "Confirm knowledge with retrieval rather than rereading." : "Follow the curriculum concepts in order before adding harder applications.", "critical", topics);
    }
    if (!emergency)
        for (const c of ranked) add(c, "practice", 1, "Apply and check", "Use fresh problems, not the preceding worked example. Difficulty follows checked answers.");
    if (mode === "spaced preparation" || mode === "long-horizon preparation") {
        const cycles = Math.min(3, Math.max(1, Math.floor((setup.examAt - now) / 86400000)));
        for (let cycle = 1; cycle <= cycles; cycle++)
            for (const c of ranked) {
                add(c, "recall", .45, `Spaced recall · cycle ${cycle}`, "Retrieve the concept again after a gap; correct recall matters more than rereading.");
                if (!short)
                    add(c, "practice", .6, `Mixed application · cycle ${cycle}`, "Return to the topic with a new problem and check transfer, not just recognition.");
            }
    }
    if (!short)
        add(ranked[0], "break", .18, "Optional reset", "A short, skippable reset after focused work. Skip if your deadline is close.", "optional");
    add(ranked[0], "mistakes", .6, "Repair repeated mistakes", attempts.some(a => !a.correct) ? "Return to the errors you actually made before the final check." : "Check common traps; new mistakes will appear here.");
    add(ranked[0], "mock", short ? .65 : 1.2, emergency ? "Mini check · 2–5 questions" : "Chapter mock and review", "Use Scholar’s existing Mock Exam runner, then return for analysis.", "critical");
    // Integer allocation conserves the actual remaining budget, even for tiny replans.
    const total = drafts.reduce((sum, t) => sum + t.weight, 0);
    let left = seconds;
    const tasks = drafts.map((t, i) => { const n = i === drafts.length - 1 ? left : Math.max(0, Math.floor(seconds * t.weight / total)); left -= n; const { weight: _w, ...task } = t; return { ...task, seconds: n }; }).filter(t => t.seconds > 0);
    if (tasks[0])
        tasks[0].status = "active";
    if (setup.blocks.length) {
        let b = 0, used = 0;
        const blocks = [...setup.blocks].filter(x => x.start + x.minutes * 60000 > now).sort((a, b) => a.start - b.start), scheduled: Task[] = [];
        for (const task of tasks) {
            let remaining = task.seconds, part = 0;
            while (remaining > 0 && b < blocks.length) {
                const block = blocks[b], start = Math.max(now, block.start), capacity = Math.floor((block.start + block.minutes * 60000 - start) / 1000) - used;
                if (capacity <= 0) {
                    b++;
                    used = 0;
                    continue;
                }
                const duration = Math.min(remaining, capacity);
                scheduled.push({ ...task, id: `${task.id}-b${part++}`, seconds: duration, scheduledAt: start + used * 1000, status: "pending", prerequisite: scheduled.at(-1)?.id });
                remaining -= duration;
                used += duration;
            }
        }
        if (scheduled[0])
            scheduled[0].status = "active";
        return scheduled;
    }
    return tasks;
}
export function createSession(id: string, setup: Setup, now = Date.now()): ExamSession {
    if (setup.examAt <= now)
        throw new Error("Choose an exam time in the future.");
    const available = setup.blocks.length ? setup.blocks.reduce((sum, b) => sum + Math.max(0, Math.min(b.minutes * 60000, b.start + b.minutes * 60000 - Math.max(now, b.start))) / 60000, 0) : setup.minutes;
    if (setup.blocks.length && available < 1) throw new Error("Add a future study block before the exam.");
    const minutes = Math.max(1, Math.min(setup.minutes, Math.floor((setup.examAt - now) / 60000), Math.floor(available)));
    const config = { ...setup, minutes };
    return { id, revision: 0, setup: config, status: "paused", createdAt: now, updatedAt: now, clock: { elapsedMs: 0, runningSince: null }, taskSince: now, taskElapsedMs: 0, tasks: plan(config, Math.floor(minutes * 60), [], 1, now), attempts: [], notes: "", important: false, history: [{ at: now, reason: "Initial time-aware plan", version: 1 }], planVersion: 1, lessons: {}, chat: [] };
}
export function replan(s: ExamSession, seconds: number, reason: string, now = Date.now()) {
    const completed = s.tasks.filter(t => t.status === "done" || t.status === "skipped").slice(-120);
    s.planVersion++;
    const replacement = plan(s.setup, seconds, s.attempts, s.planVersion, now);
    const teaching = (kind: TaskKind) => ["learn", "repair", "revise"].includes(kind);
    const unfinished = replacement.filter(t => !completed.some(c => c.chapterId === t.chapterId && c.subjectId === t.subjectId && (c.kind === t.kind || teaching(c.kind) && teaching(t.kind)) && (c.title === t.title || teaching(t.kind) && (!c.topics || (t.topics ?? [t.topic]).every(topic => c.topics!.includes(topic))))));
    const total = unfinished.reduce((n, t) => n + t.seconds, 0);
    let left = seconds;
    if (!s.setup.blocks.length && total > 0)
        for (let i = 0; i < unfinished.length; i++) {
            const t = unfinished[i], duration = i === unfinished.length - 1 ? left : Math.floor(seconds * t.seconds / total);
            t.seconds = duration;
            left -= duration;
        }
    unfinished.forEach((t, i) => { t.status = i === 0 ? "active" : "pending"; t.prerequisite = i ? unfinished[i - 1].id : completed.at(-1)?.id; });
    s.tasks = [...completed, ...unfinished];
    s.history = [...s.history, { at: now, reason, version: s.planVersion }].slice(-60);
    s.taskElapsedMs = 0;
    s.taskSince = now;
}
/** Rescale the unfinished path without recreating tasks or losing cached lessons. */
function rebalancePath(s: ExamSession, seconds: number, reason: string, now: number) {
    const completed = s.tasks.filter(t => t.status === "done" || t.status === "skipped");
    let remaining = s.tasks.filter(t => t.status === "active" || t.status === "pending");
    if (seconds <= 1800) remaining = remaining.filter(t => t.kind !== "break");
    const total = remaining.reduce((sum, t) => sum + t.seconds, 0);
    let left = seconds;
    remaining.forEach((t, i) => { const duration = i === remaining.length - 1 ? left : total ? Math.floor(seconds * t.seconds / total) : 0; t.seconds = duration; left -= duration; });
    remaining = remaining.filter(t => t.seconds > 0);
    remaining.forEach((t, i) => { t.status = i === 0 ? "active" : "pending"; t.prerequisite = i ? remaining[i - 1].id : completed.at(-1)?.id; });
    const cursors = new Map<number, number>();
    if (s.setup.blocks.length) for (const t of remaining) {
        const block = s.setup.blocks.find(b => (t.scheduledAt ?? now) >= b.start && (t.scheduledAt ?? now) < b.start + b.minutes * 60000);
        if (block) {
            const start = Math.max(now, t.scheduledAt ?? block.start, cursors.get(block.start) ?? block.start);
            t.scheduledAt = start;
            t.seconds = Math.min(t.seconds, Math.max(0, Math.floor((block.start + block.minutes * 60000 - start) / 1000)));
            cursors.set(block.start, start + t.seconds * 1000);
        }
    }
    s.tasks = [...completed, ...remaining.filter(t => t.seconds > 0)];
    s.tasks.filter(t => t.status === "active" || t.status === "pending").forEach(t => { t.status = "pending"; });
    const next = s.tasks.find(t => t.status === "active" || t.status === "pending");
    if (next) next.status = "active";
    s.planVersion++;
    s.history = [...s.history, { at: now, reason, version: s.planVersion }].slice(-60);
    s.taskElapsedMs = 0;
    s.taskSince = now;
}
export function transition(input: ExamSession, action: Exclude<Action, {
    type: "answer";
}>, now = Date.now()): ExamSession {
    const s = structuredClone(input), task = currentTask(s), previousUpdatedAt = s.updatedAt;
    s.updatedAt = now;
    if (action.type === "notes") {
        s.notes = action.text;
        s.important = action.important;
        return s;
    }
    if (action.type === "pause" || action.type === "complete") {
        s.clock.elapsedMs = elapsedMs(s, now);
        s.clock.runningSince = null;
        s.taskElapsedMs += s.status === "active" ? Math.max(0, now - s.taskSince) : 0;
        s.status = action.type === "pause" ? "paused" : "completed";
        return s;
    }
    if (s.status === "completed")
        throw new Error("This session is complete. Start a new session to prepare again.");
    if (action.type === "resume") {
        if (s.status !== "active") {
            if (now - previousUpdatedAt > 30 * 60000 || s.tasks.filter(t => t.status === "pending" || t.status === "active").reduce((n, t) => n + t.seconds, 0) > remainingSeconds(s, now))
                rebalancePath(s, remainingSeconds(s, now), "Rebalanced after time away", now);
            s.clock.runningSince = now;
            s.taskSince = now;
            s.status = "active";
        }
        return s;
    }
    if (action.type === "replan") {
        s.clock.budgetMs = Math.min(43200 * 60000, elapsedMs(s, now) + action.minutes * 60000);
        s.setup.minutes = Math.ceil(s.clock.budgetMs / 60000);
        replan(s, remainingSeconds(s, now), action.reason, now);
        return s;
    }
    if (action.type === "settings") {
        if (action.setup.grade !== s.setup.grade)
            throw new Error("A session cannot change grade.");
        const chaptersChanged = JSON.stringify(s.setup.chapters) !== JSON.stringify(action.setup.chapters);
        s.setup = action.setup;
        s.clock.budgetMs = action.setup.minutes * 60000;
        if (chaptersChanged) replan(s, remainingSeconds(s, now), "Chapters or confidence changed", now);
        else rebalancePath(s, remainingSeconds(s, now), "Materials, style or availability changed; mission order retained", now);
        s.lessons = {};
        return s;
    }
    if (action.type === "next" && task?.kind === "mock" && s.mock?.verified) {
        task.status = "done";
        s.clock.elapsedMs = elapsedMs(s, now);
        s.clock.runningSince = null;
        s.status = "completed";
        return s;
    }
    if (task)
        task.status = action.type === "skip" ? "skipped" : "done";
    const actual = s.taskElapsedMs + (s.status === "active" ? Math.max(0, now - s.taskSince) : 0);
    const performance = task ? s.attempts.filter(a => a.evaluation !== "self-reviewed" && (a.taskId ? a.taskId === task.id : a.chapterId === task.chapterId && a.subjectId === task.subjectId && a.at >= s.taskSince)) : [];
    const gap = performance.find(a => !a.correct && s.attempts.filter(x => !x.correct && x.evaluation !== "self-reviewed" && x.subjectId === a.subjectId && x.chapterId === a.chapterId && x.topic === a.topic).length >= 2);
    if (task && gap && !s.tasks.some(t => t.title.startsWith("Targeted repair") && t.subjectId === gap.subjectId && t.chapterId === gap.chapterId && t.topic === gap.topic)) {
        const repair: Task = { ...task, id: `repair:${task.id}`, kind: "repair", topic: gap.topic, topics: [gap.topic], title: `Targeted repair · ${gap.topic}`, objective: `Use a different explanation to repair ${gap.topic}, then attempt a fresh check.`, reason: "Two checked answers revealed this specific gap. This is a bounded repair, not a chapter restart.", status: "pending", seconds: Math.min(300, Math.max(1, Math.floor(remainingSeconds(s, now) * .15))), scheduledAt: undefined };
        s.tasks.splice(s.tasks.findIndex(t => t.id === task.id) + 1, 0, repair);
    }
    if (task && (Math.abs(actual / 1000 - task.seconds) > 60 || performance.length > 0))
        rebalancePath(s, remainingSeconds(s, now), Math.abs(actual / 1000 - task.seconds) > 60 ? (actual / 1000 > task.seconds ? "Task overtime: compressed lower-priority work" : "Finished early: returned time to the remaining path") : performance.filter(a => a.correct).length / performance.length < .6 ? "Checkpoint gaps: targeted repair without restarting" : "Strong checkpoint: continued mission order", now);
    else {
        const next = s.tasks.find(t => t.status === "pending");
        if (next)
            next.status = "active";
        s.taskElapsedMs = 0;
        s.taskSince = now;
    }
    if (!currentTask(s)) { s.clock.elapsedMs = elapsedMs(s, now); s.clock.runningSince = null; s.status = "completed"; }
    return s;
}
export function recordAnswer(s: ExamSession, q: import("./model").Question, answer: string, correct: boolean, evaluation: import("./model").Attempt["evaluation"], now = Date.now()) {
    if (s.attempts.some(a => a.questionId === q.id))
        throw new Error("This question has already been answered.");
    const kind = currentTask(s)?.kind;
    s.attempts.push({ id: `a-${s.attempts.length}`, taskId: currentTask(s)?.id, questionId: q.id, subjectId: q.subjectId, chapterId: q.chapterId, topic: q.topic, correct, answer, expected: q.answer, explanation: q.explanation, at: now, kind: kind === "diagnostic" ? "diagnostic" : kind === "recall" ? "recall" : "practice", evaluation, ...(!correct ? { mistake: /unit/i.test(answer + q.explanation) ? "units / dimensional reasoning" : /sign/i.test(q.explanation) ? "sign convention" : "concept / application gap" } : {}) });
    s.attempts = s.attempts.slice(-250);
    s.updatedAt = now;
    // Finish this checkpoint before adapting. An answer must not replace the
    // active task and throw away the lesson that supplied its feedback.
    return s;
}
