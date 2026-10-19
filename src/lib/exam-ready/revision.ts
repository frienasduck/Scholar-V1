import { sessionCoverage } from "./coverage";
import type { ExamSession } from "./model";
import { remainingSeconds } from "./model";
function policyAllows(s:ExamSession,id:string) {
    if(s.setup.excludedResourceIds?.includes(id))return false;
    if(s.setup.materials==="custom")return s.setup.resourceIds.includes(id);
    const privateSource=id.startsWith("er-user-")||id.startsWith("er-session-notes:");
    return s.setup.materials==="personal"?privateSource&&(s.setup.resourceIds.includes(id)||id===`er-session-notes:${s.id}`):["scholar","scholar-web","verified"].includes(s.setup.materials)?!privateSource:!privateSource||s.setup.resourceIds.includes(id)||id===`er-session-notes:${s.id}`;
}
export function eligibleRevisionItems(s:ExamSession,available?:Map<string,string>) {
    return Object.values(s.revisionItems??{}).filter(item=>item.citations.length>0&&item.citations.every(c=>policyAllows(s,c.resourceId))&&(!available||!!item.sourceVersions?.length&&item.sourceVersions.every(source=>available.get(source.sourceId)===source.version)));
}

export function recallPlan(s:ExamSession,now=Date.now()) {
    const time=remainingSeconds(s,now), horizon=s.setup.examAt-now;
    return sessionCoverage(s).flatMap(chapter=>chapter.objectives.filter(o=>o.independentTested&&!o.demonstrated).map(o=>{
        const latest=s.attempts.filter(a=>a.objectiveId===o.id&&a.evaluation!=="self-reviewed"&&!a.assistance).at(-1);
        const delay=o.needsRepair||time<900?0:horizon>3*86400000&&s.setup.blocks.length?86400000:15*60000;
        const at=Math.max(now,(latest?.at??now)+delay);
        return {objectiveId:o.id,topic:o.topic,at:Math.min(at,s.setup.examAt-1),type:o.needsRepair?"immediate repair":time<900?"immediate exam recall":delay===86400000?"spaced review":"short-term retrieval",independentRequired:true};
    }));
}

/** A session-derived briefing, not an invented congratulatory readiness claim. */
export function revisionBriefing(s: ExamSession,available?:Map<string,string>) {
    const coverage = sessionCoverage(s), lines = ["## Final preparation briefing", "This records your actual preparation, not a prediction of exam success."];
    for (const chapter of coverage) {
        const tested = chapter.objectives.filter(o => o.tested), gaps = chapter.objectives.filter(o => o.needsRepair), untested = chapter.objectives.filter(o => !o.tested);
        lines.push(`### ${chapter.title}`, `${tested.length}/${chapter.objectives.length} objectives checked; ${chapter.demonstrated} demonstrated through application and later retrieval.`, `Scope: ${chapter.sourceGuidance.warning}`);
        if (gaps.length) lines.push("Revisit first: " + gaps.map(o => o.topic).join("; "));
        if (untested.length) lines.push("Not yet assessed: " + untested.map(o => o.topic).join("; "));
    }
    const lessonAllowed=(l:typeof s.lessons[string])=>l.citations.length>0&&l.citations.every(c=>policyAllows(s,c.resourceId))&&(!available||!!l.materialTrace?.used.length&&l.materialTrace.used.every(source=>available.get(source.sourceId)===source.version));
    const studied = Object.values(s.lessons).filter(l => l.quality?.status === "validated-structure"&&lessonAllowed(l));
    const archived = eligibleRevisionItems(s,available).filter(item => coverage.some(c => c.objectives.some(o => o.id === item.objectiveId)));
    const formulas = [...new Set([...archived.flatMap(l => l.formulas), ...studied.flatMap(l => l.formulas)])].slice(0, 20);
    if (archived.length) lines.push("### Studied concepts", ...archived.slice(-12).map(item => `**${item.topic}**\n${item.summary}`));
    if (formulas.length) lines.push("### Formulas from your studied lessons", ...formulas.map(f => `- ${f}`));
    const recent = [...new Map(s.attempts.filter(a => a.evaluation !== "self-reviewed").map(a => [a.questionId, a])).values()].filter(a => !a.correct).slice(-8);
    if (recent.length) lines.push("### Your actual mistakes", ...recent.flatMap(a => [`**${a.topic}** — ${a.errorCategory ?? a.mistake ?? "Review the method"}`,Object.values(s.lessons).some(l=>lessonAllowed(l)&&l.questions.some(q=>q.id===a.questionId))?`${a.expected}\n\n${a.explanation}`:"The old solution is not reproduced without current permitted source context. Revisit the source or ask for a newly supported repair."]));
    const worked = archived.filter(item => item.example).slice(-3);
    if (worked.length) lines.push("### Worked examples from your preparation", ...worked.map(item => item.example!));
    const recall = coverage.flatMap(c => c.objectives.filter(o => o.tested && !o.demonstrated).slice(0, 2).map(o => `Without your notes, explain ${o.topic}. State the conditions and give a different application.`)).slice(0, 6);
    if (recall.length) lines.push("### Active recall", ...recall.map(q => `- ${q}`));
    const planned=recallPlan(s);if(planned.length)lines.push("### Next retrieval opportunities",...planned.slice(0,6).map(item=>`- ${item.topic}: ${item.type}${item.type==="spaced review"?` after ${new Date(item.at).toISOString()}`:""}. Use a different question without hints; scheduled review is not proof of retention.`));
    if (s.important && s.notes.trim()) lines.push("### Your selected revision notes", s.notes.slice(0, 6000));
    lines.push("### Exam strategy", "Allocate time in proportion to marks. Check units, signs, assumptions and the question's domain. If a problem stalls, secure the questions you can solve and return. Unchecked topics remain a preparation gap.");
    return lines.join("\n\n");
}
