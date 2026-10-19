import { createHash } from "node:crypto";
import { chapterManifest, curriculumInventory } from "../coverage";
import { arithmetic } from "../assessment";
import type { ExamSession } from "../model";
import { originalUnits } from "./originals";
import licensedData from "./licensed-sources.json";
import type { LicensedSource } from "./ingestion";
import { syllabusAlignment } from "./syllabus-alignment";
import { KNOWLEDGE_VERSION, type KnowledgeMaterial, type KnowledgePassage, type Scope, type TeachingUnit } from "./types";

export const sameScope = (a: Scope, b: Scope) => a.grade === b.grade && a.subjectId === b.subjectId && a.chapterId === b.chapterId;
export const unitObjectives = (u: TeachingUnit) => u.topicIndexes.map(i => chapterManifest(u.grade, u.subjectId, u.chapterId).objectives[i]?.id).filter((id): id is string => !!id);
export const unitVersion = (u: TeachingUnit) => createHash("sha256").update(JSON.stringify(u)).digest("hex").slice(0, 24);
const legacyCheckObjectives: Record<string, number> = { inertia: 0, "net-force": 1, friction: 3, work: 2, rolling: 4, shapes: 2, orbitals: 7, quotient: 2, coefficients: 3, "first-law": 0, calorimetry: 1, equations: 4, roots: 4, alias: 1 };
export function checkObjectiveIndex(unit: TeachingUnit, index: number) {
  return unit.checkObjectiveIndexes?.[index] ?? legacyCheckObjectives[unit.id.replace(/^er-original-\d+-[a-z]+-[a-z]+\d+-/, "")] ?? unit.topicIndexes[0];
}
export function validateUnit(u: TeachingUnit) {
  if (u.explanation.length < 600 || !u.conditions || !u.examples.length || !u.checks.length || !u.references.length || !unitObjectives(u).length || unitObjectives(u).length !== u.topicIndexes.length) throw new Error(`Incomplete teaching unit: ${u.id}`);
  for (const value of [...u.examples.flatMap(e => e.calculations ?? []), ...u.checks.flatMap(q => q.numeric ? [q.numeric] : [])]) {
    if (Math.abs(arithmetic(value.expression) - value.value) > Math.max(1e-9, Math.abs(value.value) * value.tolerance)) throw new Error(`Incorrect calculation in ${u.id}`);
  }
  if(u.checkObjectiveIndexes && u.checkObjectiveIndexes.length!==u.checks.length) throw new Error(`Missing objective mapping in ${u.id}`);
  for (const [index,q] of u.checks.entries()) {
    if(!u.topicIndexes.includes(checkObjectiveIndex(u,index))) throw new Error(`Assessment outside unit scope in ${u.id}`);
    if (q.kind === "mcq" && (q.options?.length !== 4 || new Set(q.options).size !== 4 || !q.options.includes(q.answer))) throw new Error(`Ambiguous check in ${u.id}`);
    if (q.numeric && Number(q.answer.match(/^[+-]?[\d.]+/)?.[0]) !== q.numeric.value) throw new Error(`Contradictory key in ${u.id}`);
    if (q.kind === "short" && q.rubric?.reduce((n, r) => n + r.points, 0) !== q.marks) throw new Error(`Missing rubric in ${u.id}`);
  }
  return u;
}
const units = originalUnits.map(validateUnit);
const licensed = licensedData as LicensedSource[];
export function findUnit(id: string) { return units.find(u => u.id === id); }
export function findLicensed(id:string) { return licensed.find(s=>s.id===id); }
const licensedObjectives = (s:LicensedSource) => s.topicIndexes.map(i=>chapterManifest(s.grade,s.subjectId,s.chapterId).objectives[i]?.id).filter((id):id is string=>!!id);
function licensedRecord(s:LicensedSource):KnowledgeMaterial {
  return {id:s.id,title:s.title,description:"Stored primary documentation sections · partial curriculum coverage",resourceType:"notes",sourceType:"licensed-primary",domain:"EXAM_READY",version:s.version,reviewStatus:"publisher-primary; curriculum scope annotated",objectiveIds:licensedObjectives(s),indexedChunks:s.sections.reduce((n,c)=>n+splitPassage(c.text).length,0),canonicalUrl:s.canonicalUrl,publisher:s.publisher,language:"en",licenseType:s.licenseType,licenseUrl:s.licenseUrl,attributionText:`${s.attribution} ${s.changes}`,canStoreCopy:true,canGenerateDerivatives:true,visibility:"GLOBAL",ownerUserId:null,state:"READY",qualityStatus:"publisher-primary",lastCheckedAt:s.retrievedAt,mappings:[{curriculumId:"cbse",grade:s.grade,subjectId:s.subjectId,chapterId:s.chapterId}],limitations:["Primary Python reference, not an official CBSE paper or complete chapter.",chapterManifest(s.grade,s.subjectId,s.chapterId).sourceGuidance.warning]};
}
function splitPassage(text:string) {const chunks:string[]=[];for(let offset=0;offset<text.length;offset+=1800)chunks.push(text.slice(offset,offset+1800));return chunks;}
export function builtInMaterials(scope: Scope): KnowledgeMaterial[] {
  return [...units.filter(u => sameScope(u, scope)).map((u):KnowledgeMaterial => ({
    id: u.id, title: u.title, description: `Original teaching unit · ${u.examples.length} worked examples · ${u.checks.length} checks · partial chapter coverage`, resourceType: "notes", sourceType: "scholar-authored", domain: "EXAM_READY", version: unitVersion(u), reviewStatus: u.reviewStatus, objectiveIds: unitObjectives(u), indexedChunks: 1,
    canonicalUrl: null, publisher: "Scholar Exam Ready", author: "Scholar", language: "en", licenseType: "SCHOLAR_AUTHORED", licenseUrl: null, attributionText: "Original Scholar Exam Ready material, not an official paper or copied textbook.", canStoreCopy: true, canGenerateDerivatives: true, visibility: "GLOBAL", ownerUserId: null, state: u.reviewStatus === "reference-checked" ? "READY" : "NEEDS_REVIEW", qualityStatus: u.reviewStatus, lastCheckedAt: "2026-10-13", mappings: [{ curriculumId: "cbse", ...scope }],
    limitations: ["Topic-level material, not complete chapter coverage.", "Arithmetic and reference comparison are not independent certification of all scientific claims."], sourceMetadata: { domain: "EXAM_READY", references: u.references }
  })), ...licensed.filter(s=>sameScope(s,scope)).map(licensedRecord)];
}
export function additionalReferences(scope: Scope): KnowledgeMaterial[] {
  const refs = new Map(units.filter(u => sameScope(u, scope)).flatMap(u => u.references.map(r => [r.url, r] as const)));
  return [...refs.values()].map(r => ({ id: `er-ref-${createHash("sha256").update(r.url).digest("hex").slice(0, 16)}`, title: r.title, description: "External reference · no stored textbook text", resourceType: "reference", sourceType: "web", domain: "EXAM_READY", version: r.checkedAt, reviewStatus: "external-reference", objectiveIds: [], indexedChunks: 0, canonicalUrl: r.url, publisher: new URL(r.url).hostname, language: "en", licenseType: "LINK_ONLY", licenseUrl: null, attributionText: r.title, canStoreCopy: false, canGenerateDerivatives: false, visibility: "GLOBAL", ownerUserId: null, state: "LINK_ONLY", qualityStatus: "metadata-only", mappings: [{ curriculumId: "cbse", ...scope }], limitations: ["This link is never sent as readable teaching content."] }));
}
export function unitPassage(u: TeachingUnit, citationId: string): KnowledgePassage {
  // Checks are withheld: grounding passages must not leak the current question key.
  return { citation: { id: citationId, resourceId: u.id, title: u.title, publisher: "Scholar Exam Ready", url: null, heading: u.title }, version: unitVersion(u), objectiveIds: unitObjectives(u), origin: "SCHOLAR_AUTHORED", reviewStatus: u.reviewStatus,
    text: [u.explanation, u.prerequisites?.length ? `Prerequisites: ${u.prerequisites.join("; ")}` : "", `Conditions: ${u.conditions}`, u.scopeNote, u.formula, u.derivation?.length ? `Derivation:\n${u.derivation.join("\n")}` : "", u.diagram ? `Diagram instructions: ${u.diagram}` : "", ...u.examples.map(e => `${e.problem}\n${e.steps.join("\n")}\n${e.result}`), ...(u.misconceptions?.map(m=>`Misconception: ${m.wrong}\nRepair: ${m.repair}\nDiagnose: ${m.diagnostic}\nTransfer: ${m.transfer}`)??[]), `Common mistakes to avoid: ${u.mistakes.join("; ")}`, `Revision: ${u.revision.join("; ")}`].filter(Boolean).join("\n\n") };
}
export function retrieveBuiltIn(scope: Scope, objectiveIds: string[], selected: string[], excluded: string[], policy: string, query = ""): KnowledgePassage[] {
  if (policy === "personal") return [];
  const tokens = query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  const authored = units.filter(u => sameScope(u, scope) && u.reviewStatus === "reference-checked" && !excluded.includes(u.id) && (policy !== "custom" || selected.includes(u.id)) && (objectiveIds.length === 0 || unitObjectives(u).some(id => objectiveIds.includes(id)) || tokens.some(t=>u.title.toLowerCase().includes(t))))
    .map(u => ({ u, required:unitObjectives(u).some(id=>objectiveIds.includes(id)), score: tokens.filter(t => `${u.title} ${u.explanation}`.toLowerCase().includes(t)).length + Number(selected.includes(u.id)) * 10 }))
    .sort((a, b) => Number(b.required)-Number(a.required) || b.score - a.score || a.u.id.localeCompare(b.u.id)).slice(0, 4).map(({ u }, i) => unitPassage(u, `S${i + 1}`));
  const external = licensed.filter(s=>sameScope(s,scope)&&!excluded.includes(s.id)&&(policy!=="custom"||selected.includes(s.id))&&(objectiveIds.length===0||licensedObjectives(s).some(id=>objectiveIds.includes(id))))
    .flatMap(s=>s.sections.flatMap(section=>splitPassage(section.text).map((text,i)=>({s,heading:`${section.heading} · excerpt ${i+1}`,text,score:tokens.filter(t=>text.toLowerCase().includes(t)).length}))))
    .sort((a,b)=>b.score-a.score||a.s.id.localeCompare(b.s.id)).slice(0,4).map(({s,text,heading}):KnowledgePassage=>({citation:{id:"",resourceId:s.id,title:s.title,publisher:s.publisher,url:s.canonicalUrl,heading},text,version:s.version,origin:"LICENSED_SOURCE",objectiveIds:licensedObjectives(s),reviewStatus:"publisher-primary"}));
  return [...authored,...external].slice(0,6).map((p,i)=>({...p,citation:{...p.citation,id:`S${i+1}`}}));
}
export function independentCoverage() {
  return curriculumInventory().map(c => {
    const owned = units.filter(u => sameScope(u, c)), approved = owned.filter(u => u.reviewStatus === "reference-checked"), primary=licensed.filter(s=>sameScope(s,c)), ids = new Set([...approved.flatMap(unitObjectives),...primary.flatMap(licensedObjectives)]);
    const alignment=syllabusAlignment(c.grade,c.subjectId,c.chapterId);
    const objectiveCoverage=c.objectives.map((o,i)=>{
      const teaching=approved.filter(u=>u.topicIndexes.includes(i));
      const checks=teaching.flatMap(u=>u.checks.filter((_,j)=>checkObjectiveIndex(u,j)===i));
      return {...o,scope:alignment.extensionObjectiveIndexes.includes(i)?"EXTENSION_OR_TEACHER_ASSIGNED":"REGISTRY_OBJECTIVE_REVIEW_PENDING",teachingSources:teaching.map(u=>u.id),licensedSources:primary.filter(s=>licensedObjectives(s).includes(o.id)).map(s=>s.id),examples:teaching.reduce((n,u)=>n+u.examples.length,0),questions:checks.length,calculationCheckedQuestions:checks.filter(q=>q.numeric).length,revisionItems:teaching.reduce((n,u)=>n+u.revision.length,0),readyForLocalPractice:teaching.length>0&&checks.length>0&&teaching.some(u=>u.examples.length&&u.revision.length)};
    });
    return { grade: c.grade, subjectId: c.subjectId, chapterId: c.chapterId, title: c.title, alignment, objectiveCoverage, objectivesWithTeaching:objectiveCoverage.filter(o=>o.teachingSources.length||o.licensedSources.length).length,objectivesWithExamples:objectiveCoverage.filter(o=>o.examples).length,objectivesWithQuestions:objectiveCoverage.filter(o=>o.questions).length,objectivesWithRevision:objectiveCoverage.filter(o=>o.revisionItems).length,unverifiedMaterials:owned.length-approved.length,misconceptionGuides:approved.reduce((n,u)=>n+(u.misconceptions?.length??0),0),formulaResources:approved.filter(u=>u.formula).length,contentComplete:false,liveTeachingVerified:false,requiredObjectives: c.objectives.map(o => ({ id: o.id, topic: o.topic })), indexedMaterials: approved.length+primary.length, primarySources:primary.length, externalReferences: additionalReferences(c).length, explanations: approved.length, workedExamples: approved.reduce((n, u) => n + u.examples.length, 0), questions: approved.reduce((n, u) => n + u.checks.length, 0), revisionItems: approved.reduce((n, u) => n + u.revision.length, 0), missingObjectives: c.objectives.filter(o => !ids.has(o.id)), unresolvedQuality: [alignment.warning,c.sourceGuidance.warning, "Full subject-expert and live teaching validation outstanding"], readiness: ids.size === 0 ? "NO_MATERIAL" : "PARTIAL", complete: false };
  });
}
export function sourcePolicyFingerprint(s: ExamSession) { return JSON.stringify([KNOWLEDGE_VERSION, s.setup.materials, s.setup.resourceIds, s.setup.excludedResourceIds ?? []]); }
