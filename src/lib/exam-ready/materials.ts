import "server-only";
import { findResource, library, retrieve } from "@/lib/resources/service";
import type { ResourceRecord } from "@/lib/resources/types";
import { currentTask, remainingSeconds, type ExamSession, type Setup } from "./model";
export function permittedResource(setup: Setup, r: ResourceRecord) {
    if (setup.materials === "personal")
        return r.visibility === "PRIVATE";
    if (setup.materials === "scholar" || setup.materials === "scholar-web")
        return r.visibility === "GLOBAL";
    if (setup.materials === "custom")
        return setup.resourceIds.includes(r.id);
    return true;
}
export async function selectMaterials(userId: string, s: ExamSession) {
    const task = currentTask(s), setup = s.setup;
    const scope = setup.materials === "personal" ? "personal" : setup.materials === "scholar" || setup.materials === "scholar-web" ? "built-in" : "all";
    const result = await library({ grade: setup.grade, subjectId: task?.subjectId, chapterId: task?.chapterId, scope, limit: 12 }, userId);
    const explicit = await Promise.all(setup.resourceIds.map(id => findResource(id, userId)));
    if (explicit.some(r => !r))
        throw new Error("A selected material was deleted or is not available to this account.");
    const unique = new Map([...explicit.filter((r): r is ResourceRecord => !!r), ...result.resources].filter(r => permittedResource(setup, r)).map(r => [r.id, r]));
    const emergency = remainingSeconds(s) < 1800;
    const resources = [...unique.values()].filter(r => !emergency || r.resourceType !== "video").slice(0, 8);
    const readable = resources.filter(r => r.canGenerateDerivatives && r.canStoreCopy && !r.sourceMetadata?.needsOcr && ["READY", "NEEDS_REVIEW"].includes(r.state)).slice(0, 4);
    // Passing explicit vetted IDs prevents retrieve() from introducing any other source.
    const sources = readable.length ? await retrieve(userId, { grade: setup.grade, subjectId: task?.subjectId, chapterId: task?.chapterId, q: task?.topic }, readable.map(r => r.id)) : [];
    return { resources, sources, privateAvailable: result.privateAvailable, restricted: setup.materials === "personal" || setup.materials === "custom" };
}
