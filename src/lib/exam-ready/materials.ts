import "server-only";
import { createHash } from "node:crypto";
import { builtInMaterials, findUnit, findLicensed, retrieveBuiltIn, sourcePolicyFingerprint } from "./knowledge/library";
import { privateMaterial, privateSummary, retrievePrivate } from "./knowledge/private-materials";
import type { MaterialTrace, KnowledgePassage } from "./knowledge/types";
import type { ResourceRecord } from "@/lib/resources/types";
import { boundedPassages } from "./knowledge/context";
import { KNOWLEDGE_VERSION } from "./knowledge/types";
import { currentTask, type ExamSession, type Setup } from "./model";
export class MaterialContextError extends Error {}
export function permittedResource(setup: Setup, r: ResourceRecord) {
    if ((setup.excludedResourceIds ?? []).includes(r.id)) return false;
    if (setup.materials === "personal")
        return r.visibility === "PRIVATE";
    if (setup.materials === "scholar" || setup.materials === "scholar-web" || setup.materials === "verified")
        return r.visibility === "GLOBAL";
    if (setup.materials === "custom")
        return setup.resourceIds.includes(r.id);
    return true;
}
export function matchesChapter(setup: Setup, subjectId: string | undefined, chapterId: string | undefined, r: ResourceRecord) {
    return r.mappings.some(m => m.curriculumId === "cbse" && m.grade === setup.grade && m.subjectId === subjectId && m.chapterId === chapterId);
}
export async function selectMaterials(userId: string, s: ExamSession, request = "", notebookIntent = false) {
    const task = currentTask(s), setup = s.setup;
    if (!task) throw new MaterialContextError("Choose an active chapter checkpoint.");
    const scope = { grade: setup.grade, subjectId: task.subjectId, chapterId: task.chapterId }, excluded = setup.excludedResourceIds ?? [];
    const noteId=`er-session-notes:${s.id}`;
    if(notebookIntent) {
        const sources:KnowledgePassage[] = !["scholar","scholar-web","verified"].includes(setup.materials) && !excluded.includes(noteId) && s.notes.trim() ? [{citation:{id:"S1",resourceId:noteId,title:"Your preparation notepad",publisher:"Your session",url:null,heading:`User-requested notes · first ${Math.min(6000,s.notes.length)} of ${s.notes.length} characters`},text:s.notes.slice(0,6000),version:createHash("sha256").update(s.notes).digest("hex"),objectiveIds:[],origin:"USER_UPLOAD" as const,reviewStatus:"user-provided; not independently verified"}] : [];
        return {resources:[],sources,pageRequested:false,privateAvailable:true,restricted:true,policyFingerprint:sourcePolicyFingerprint(s)};
    }
    const selectedPrivate = setup.resourceIds.filter(id => id.startsWith("er-user-") && !excluded.includes(id));
    const explicit = await Promise.all(setup.resourceIds.filter(id => !excluded.includes(id)).map(async id => {
        const unit = findUnit(id) ?? findLicensed(id);
        if (unit) return builtInMaterials(unit).find(r => r.id === id)!;
        if (!id.startsWith("er-user-")) throw new MaterialContextError("A legacy or external-section source is selected. Choose a source in the independent Exam Ready panel; it is not imported automatically.");
        return privateSummary(await privateMaterial(userId, id));
    }));
    const resources = [...new Map([...explicit, ...builtInMaterials(scope)].filter(r => permittedResource(setup, r) && matchesChapter(setup, task.subjectId, task.chapterId, r)).map(r => [r.id, r])).values()];
    const page = request.match(/\b(?:page|p\.)\s*(\d{1,4})(?:\s*(?:-|–|to)\s*(\d{1,4}))?\b/i);
    const pageStart = page ? Number(page[1]) : undefined;
    if (pageStart !== undefined && (pageStart < 1 || pageStart > 3000 || page?.[2] && Number(page[2]) < pageStart)) throw new MaterialContextError("Choose a valid page or increasing page range in your selected material (pages 1–3000).");
    const pageEnd = pageStart !== undefined ? Math.max(pageStart, Math.min(Number(page?.[2] ?? pageStart), pageStart + 4)) : undefined;
    const personal = !["scholar", "scholar-web", "verified"].includes(setup.materials) ? await retrievePrivate(userId, scope, selectedPrivate, excluded, request || task.topics?.join(" ") || task.topic, pageStart, pageEnd) : [];
    const builtIn = page ? [] : retrieveBuiltIn(scope, task.objectiveIds ?? [], setup.resourceIds, excluded, setup.materials, request);
    const sources = boundedPassages([...personal, ...builtIn].slice(0, 6).map((p, i) => ({ ...p, citation: { ...p.citation, id: `S${i + 1}` } })));
    return { resources, sources, pageRequested: !!page, privateAvailable: true, restricted: true, policyFingerprint: sourcePolicyFingerprint(s) };
}
export function materialTrace(s: ExamSession, sources: Awaited<ReturnType<typeof selectMaterials>>["sources"], used: string[]): MaterialTrace {
    return { domain: "EXAM_READY", version: KNOWLEDGE_VERSION, at: Date.now(), policy: s.setup.materials, selectedIds: [...s.setup.resourceIds], excludedIds: [...s.setup.excludedResourceIds ?? []], retrieved: sources.map(p => ({ sourceId: p.citation.resourceId, citationId: p.citation.id, version: p.version, heading: p.citation.heading, page: p.citation.page })), used: sources.filter(p => used.includes(p.citation.id)).map(p => ({ sourceId: p.citation.resourceId, citationId: p.citation.id, version: p.version })) };
}
