export type StudyPlanContext = { subject?: string; chapter?: string; weakTopics?: string[]; timezone?: string; chapters?: string[]; examDateText?: string };
export type ProposedStudyPlan = { id: string; subject: string; examAt: string; deadlineKind?: "exam" | "study"; timezone: string; assumptions: string[]; tasks: { title: string; date: string; time: string; type: "study" | "revision" | "exam"; priority: "medium" | "high"; note: string }[] };
const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const amountPattern = "\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";
const amount = (text: string) => numberWords[text] ?? Number(text);
export function isPlanningDateReply(message: string) {
  return /\b(?:\d{1,4}|today|tonight|tomorrow|next|weekend|sunday|monday|tuesday|wednesday|thursday|friday|saturday|january|february|march|april|may|june|july|august|september|october|november|december|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(message);
}
export function planningContext(message: string, current: StudyPlanContext, curriculum: { name: string; chapters: { title: string }[] }[]): StudyPlanContext {
  const subject = curriculum.find(item => message.toLowerCase().includes(item.name.toLowerCase()) || (item.name.toLowerCase() === "mathematics" && /\bmaths?\b/i.test(message))) ?? curriculum.find(item => item.chapters.some(chapter => message.toLowerCase().includes(chapter.title.toLowerCase()))) ?? curriculum.find(item => item.name.toLowerCase() === current.subject?.toLowerCase());
  const explicit = subject?.chapters.filter(item => message.toLowerCase().includes(item.title.toLowerCase())).map(item => item.title) ?? [];
  const sameSubject = !subject || subject.name.toLowerCase() === current.subject?.toLowerCase();
  return { ...current, subject: subject?.name ?? current.subject, chapter: explicit[0] ?? (sameSubject ? current.chapter : undefined), chapters: explicit.length ? explicit : subject?.chapters.map(item => item.title), weakTopics: sameSubject ? current.weakTopics : [] };
}
export function dateParts(date: Date, timezone: string) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date).map(part => [part.type, part.value]));
  return { year: +values.year, month: +values.month, day: +values.day, hour: +values.hour, minute: +values.minute, second: +values.second };
}
export function zonedDate(year: number, month: number, day: number, hour: number, minute: number, timezone: string) {
  const target = Date.UTC(year, month - 1, day, hour, minute); let value = target;
  for (let i = 0; i < 3; i++) { const p = dateParts(new Date(value), timezone); value += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second); }
  const date = new Date(value), p = dateParts(date, timezone);
  if (p.year !== year || p.month !== month || p.day !== day || p.hour !== hour || p.minute !== minute) throw new Error("That date or local time does not exist. Please specify another time.");
  return date;
}
/** Calendar-aware parsing, no Date.parse guessing or ignored month names. */
export function parseExamDate(message: string, now = new Date(), timezone = "Asia/Kolkata"): { date?: Date; assumptions: string[]; clarification?: string } {
  try {
    const current = dateParts(now, timezone); const lower = message.toLowerCase();
    let year = current.year, month = current.month, day = current.day; let explicitYear = false, found = false;
    const assumptions: string[] = [];
    const iso = lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    const monthNames = months.map(name => `${name}|${name.slice(0, 3)}`).join("|");
    const named = lower.match(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`));
    const reversed = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})(?:,?\\s+(20\\d{2}))?\\b`));
    if (iso) { year = +iso[1]; month = +iso[2]; day = +iso[3]; explicitYear = true; found = true; }
    else if (named || reversed) { const match = named || reversed!; month = months.findIndex(name => name.startsWith(named ? match[1] : match[2])) + 1; day = +(named ? match[2] : match[1]); if (match[3]) { year = +match[3]; explicitYear = true; } found = true; }
    else {
      const relative = lower.match(new RegExp(`\\b(?:in|(?:for\\s+)?(?:the\\s+)?next)\\s+(${amountPattern})\\s+(days?|weeks?)\\b`));
      const weekday = lower.match(/\b(?:next|before|by|on)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
      const partial = lower.match(/\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/);
      let offset = /\btomorrow\b/.test(lower) ? 1 : /\b(today|tonight)\b/.test(lower) ? 0 : null;
      if (relative) offset = amount(relative[1]) * (relative[2].startsWith("week") ? 7 : 1);
      if (weekday) { const target = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(weekday[1]); const today = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); offset = (target - today + 7) % 7 || 7; }
      if (offset !== null) { const shifted = new Date(Date.UTC(year, month - 1, day + offset)); year = shifted.getUTCFullYear(); month = shifted.getUTCMonth() + 1; day = shifted.getUTCDate(); found = true; }
      else if (partial) { day = +partial[1]; if (day < current.day) { month++; if (month > 12) { month = 1; year++; } } found = true; assumptions.push("No month supplied: using the next occurrence of that day."); }
    }
    if (!found) return { assumptions, clarification: /\bweekend\b/i.test(lower) ? "Which day and time this weekend should the plan finish? Please specify Saturday or Sunday and a time." : "When should your plan finish or when is your exam? Please give a date such as November 25, or say in 3 days." };
    if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return { assumptions, clarification: "That calendar date is invalid. Please check the day and month." };
    const clock = lower.match(/\b(?:at\s+)(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/); let hour = 9, minute = 0;
    if (clock) { hour = +clock[1]; minute = +(clock[2] || 0); if (clock[3]) { if (hour < 1 || hour > 12) throw new Error("Use a valid exam time."); hour = hour % 12 + (clock[3] === "pm" ? 12 : 0); } if (hour > 23 || minute > 59) throw new Error("Use a valid exam time."); }
    else if (!/\b(test|exam)\b/i.test(message) && /\bbefore\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.test(lower)) { hour = 0; assumptions.push("Before the named day means finishing before midnight at its start."); }
    else if (!/\b(test|exam)\b/i.test(message) && /\b(today|tonight)\b/.test(lower)) { hour = 22; assumptions.push("Study deadline time not supplied: using 10:00 PM today."); }
    else assumptions.push("Deadline time not supplied: using 9:00 AM; edit the saved plan in Planner if needed.");
    let date = zonedDate(year, month, day, hour, minute, timezone);
    if (!explicitYear && date <= now && (named || reversed)) { date = zonedDate(year + 1, month, day, hour, minute, timezone); assumptions.push("No year supplied: using the next upcoming occurrence."); }
    if (date <= now) return { assumptions, clarification: "That exam date is in the past. Please give a future date." };
    if (!explicitYear) assumptions.push(`Using ${dateParts(date, timezone).year}.`);
    return { date, assumptions };
  } catch (error) { return { assumptions: [], clarification: error instanceof Error ? error.message : "Please specify the exam date and timezone." }; }
}
export function proposeStudyPlan(message: string, context: StudyPlanContext = {}, now = new Date()): { plan?: ProposedStudyPlan; clarification?: string } | null {
  const examRequest = /\b(test|exam)\b/i.test(message);
  const studySubject = /\b(physics|chemistry|mathematics|maths|biology|english|computer science|chapters?|study|revision)\b/i.test(message) || Boolean(context.subject || context.chapter);
  const explicitPlan = /\b(plan|schedule|prepare|preparation|finish)\b/i.test(message) && studySubject;
  const upcomingExam = examRequest && /\b(?:tomorrow|next|in|on|today|at)\b/i.test(message) && !/\?/.test(message);
  const availabilityRequest = studySubject && /\bi have\b/i.test(message) && /\b(hours?|minutes?|hrs?)\b/i.test(message);
  if (!explicitPlan && !upcomingExam && !availabilityRequest) return null;
  const timezone = context.timezone || "Asia/Kolkata";
  const parsed = parseExamDate(context.examDateText || message, now, timezone); if (!parsed.date) return { clarification: parsed.clarification };
  const subject = message.match(/\b(physics|chemistry|mathematics|maths|biology|english|computer science)\b/i)?.[1] || context.subject || "your studies";
  const chapter = context.chapter || "the exam syllabus";
  const weak = (context.weakTopics || []).slice(0, 3);
  const titles = ["Learn the core concepts", "Solve worked and independent questions", "Practice MCQs", "Resolve doubts with LAM", "Recall formulas and revisit mistakes", "Take a timed mock and review"];
  const gap = parsed.date.getTime() - now.getTime();
  if (gap < 30 * 60_000) return { clarification: "Your exam is less than 30 minutes away. Use a quick final review rather than scheduling a full preparation plan." };
  const chapters = context.chapter ? [chapter] : (context.chapters || []).slice(0, 8);
  const coverage = chapters.length ? chapters.join(", ") : chapter;
  const budgetMatch = message.toLowerCase().match(new RegExp(`\\b(${amountPattern})[ -]*(hours?|hrs?|minutes?|mins?)\\b`));
  const budgetMinutes = budgetMatch ? amount(budgetMatch[1]) * (budgetMatch[2].startsWith("h") ? 60 : 1) : undefined;
  if (budgetMinutes !== undefined && budgetMinutes < 12) return { clarification: "With less than 12 study minutes, choose one focused review rather than a six-stage plan." };
  const blockMinutes = Math.min(budgetMinutes ? Math.floor(budgetMinutes / 6) : gap < 24 * 3600_000 ? 15 : 30, Math.max(2, Math.floor(gap / 60_000 / 8)));
  const contiguous = /\b(today|tonight)\b/i.test(message) || gap < 24 * 3600_000;
  let previousAt = now.getTime() + 5 * 60_000 - (blockMinutes + 1) * 60_000;
  const tasks = titles.map((title, i) => {
    let target = now.getTime() + (contiguous ? (5 + i * (blockMinutes + 1)) * 60_000 : gap * (i + .3) / 7);
    if (!contiguous) {
      const day = dateParts(new Date(i === 5 ? parsed.date!.getTime() - 86_400_000 : target), timezone);
      target = zonedDate(day.year, day.month, day.day, 18, 0, timezone).getTime();
    }
    const latest = parsed.date!.getTime() - (6 - i) * (blockMinutes + 1) * 60_000;
    const at = new Date(Math.max(previousAt + (blockMinutes + 1) * 60_000, Math.min(target, latest)));
    previousAt = at.getTime();
    const p = dateParts(at, timezone);
    return { title: `${subject} · ${title}`, date: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`, time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`, type: (i === 5 ? "exam" : i === 4 ? "revision" : "study") as "study" | "revision" | "exam", priority: (i > 3 ? "high" : "medium") as "high" | "medium", note: `Chapter coverage: ${coverage}. ${weak.length ? `Prioritize known weak areas: ${weak.join(", ")}.` : "No measured weak-area history supplied; use practice to identify gaps."} ${i === 3 ? "Open LAM with the specific question you could not solve." : i === 5 ? "Use Scholar Mock Exam; review wrong answers before the deadline." : "Use Scholar Study, Resources and Question Practice for these chapters."} Suggested block: ${blockMinutes} minutes. Deadline: ${parsed.date!.toISOString()}. Timezone: ${timezone}.` };
  });
  return { plan: { id: `lam-plan:${now.getTime()}`, subject, timezone, deadlineKind: examRequest ? "exam" : "study", examAt: parsed.date.toISOString(), assumptions: [...parsed.assumptions, budgetMinutes ? `Using ${budgetMinutes} requested study minutes as a total budget; blocks fit the deadline.` : "No study budget supplied: using six short suggested blocks.", contiguous ? "Short study blocks start in five minutes; adjust to your availability." : "No daily availability supplied: using 6:00 PM local study windows, bounded by your deadline.", "Suggested times are editable in Planner after saving; availability and existing planner conflicts have not been checked."], tasks } };
}
