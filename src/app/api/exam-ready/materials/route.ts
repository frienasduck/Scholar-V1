import { after } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { checkGrade } from "@/lib/personalization/server";
import { readBoundedBytes } from "@/lib/security/request-body";
import { authorized, fail, reply } from "@/lib/exam-ready/http";
import { examAccess } from "@/lib/exam-ready/access";
import { builtInMaterials, additionalReferences } from "@/lib/exam-ready/knowledge/library";
import { curriculumInventory } from "@/lib/exam-ready/coverage";
import { RESOURCE_TYPES } from "@/lib/resources/types";
import { MAX_MATERIAL_BYTES, privateMaterials, privateSummary, processMaterial, uploadMaterial, type PrivateMaterialRow } from "@/lib/exam-ready/knowledge/private-materials";
export const runtime = "nodejs";
export const maxDuration = 60;
const scopeSchema = z.object({ grade: z.coerce.number().refine(n => n === 9 || n === 11).transform(n => n as 9 | 11), subjectId: z.string().min(1).max(40), chapterId: z.string().min(1).max(60) });
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams, grade = p.get("grade") === "9" ? 9 : 11, user = await getSessionUser();
    if (!(await examAccess(user?.id ?? null)).allowed || !user && grade === 9) return reply({ message: "This curriculum's materials are not available for this session." }, 403);
    if (user) await checkGrade(user.id, grade);
    const scopes = curriculumInventory().filter(c => c.grade === grade && (!p.get("subjectId") || c.subjectId === p.get("subjectId")) && (!p.get("chapterId") || c.chapterId === p.get("chapterId")));
    const builtIn = scopes.flatMap(builtInMaterials), references = scopes.flatMap(additionalReferences), privateRows: PrivateMaterialRow[] = [];
    let privateAvailable = true;
    if (user) {
      try { for (const scope of scopes.slice(0, 16)) privateRows.push(...await privateMaterials(user.id, scope)); }
      catch { privateAvailable = false; }
      for (const r of privateRows.filter(r => r.state === "PROCESSING").slice(0, 1)) after(() => processMaterial(user.id, r.id).then(() => undefined));
    }
    const q = (p.get("q") ?? "").slice(0, 200).toLowerCase(), scope = p.get("scope");
    const type=p.get("type")??"all", origin=p.get("origin")??"all", sort=p.get("sort")??"relevant";
    if(type!=="all"&&!RESOURCE_TYPES.some(t=>t===type)||!["all","scholar","private","reference"].includes(origin)||!["relevant","title"].includes(sort))return reply({message:"Unsupported material filter."},422);
    const all = [...(scope !== "personal" ? builtIn : []), ...(scope !== "built-in" ? privateRows.map(privateSummary) : []), ...(scope !== "personal" ? references : [])].filter(r => (!q || `${r.title} ${r.description}`.toLowerCase().includes(q))&&(type==="all"||r.resourceType===type)&&(origin==="all"||origin==="private"&&r.visibility==="PRIVATE"||origin==="reference"&&r.state==="LINK_ONLY"||origin==="scholar"&&r.visibility!=="PRIVATE"&&r.state!=="LINK_ONLY"));
    if(sort==="title")all.sort((a,b)=>a.title.localeCompare(b.title));
    const limit = 8, page = Math.max(1, Math.min(Math.max(1,Math.ceil(all.length/limit)),100,Math.floor(Number(p.get("page")) || 1)));
    return reply({ domain: "EXAM_READY", resources: all.slice((page - 1) * limit, page * limit), total: all.length, page, pages: Math.max(1, Math.ceil(all.length / limit)), privateAvailable });
  } catch (e) { return fail(e); }
}
export async function POST(request: Request) {
  try {
    const user = await authorized(request, true), contentType = request.headers.get("content-type") ?? "";
    if(!contentType.startsWith("multipart/form-data")) return reply({message:"Use the Exam Ready file picker to submit a supported multipart upload."},415);
    const body = await readBoundedBytes(request, MAX_MATERIAL_BYTES + 16384);
    const form = await new Response(body, { headers: { "Content-Type": contentType } }).formData();
    const scope = scopeSchema.parse(Object.fromEntries(["grade", "subjectId", "chapterId"].map(key => [key, form.get(key)])));
    await checkGrade(user.id, scope.grade);
    const file = form.get("file");
    if (!(file instanceof File)) return reply({ message: "Select a supported file." }, 422);
    const title = String(form.get("title") ?? file.name).trim();
    const id = await uploadMaterial(user.id, scope, title, file.type, new Uint8Array(await file.arrayBuffer()));
    after(() => processMaterial(user.id, id).then(() => undefined));
    return reply({ id, domain: "EXAM_READY", message: "Stored privately in Exam Ready. Processing is resumable." }, 201);
  } catch (e) { return fail(e); }
}
