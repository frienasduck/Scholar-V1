import { ARTIFACT_TYPES } from "@/lib/resources/artifacts";
import type { ResourceRecord, ResourceResult } from "@/lib/resources/types";

export function readableSource(resource: ResourceRecord) {
  return resource.canStoreCopy && resource.canGenerateDerivatives
    && ["READY", "NEEDS_REVIEW"].includes(resource.state) && resource.sourceMetadata?.needsOcr !== true;
}

export function canonicalResourceType(type = "") {
  return ({ ncert: "textbook", questionbank: "question-bank", formula: "formula-sheet", quickrevision: "summary", website: "reference", practical: "simulation", pyq: "past-paper", samplepaper: "sample-paper" } as Record<string, string>)[type] ?? type;
}

export function libraryStats(resources: ResourceRecord[]) {
  const subjects = new Set<string>(); const chapters = new Set<string>(); const types: Record<string, number> = {};
  for (const resource of resources) {
    types[resource.resourceType] = (types[resource.resourceType] ?? 0) + 1;
    for (const mapping of resource.mappings) {
      subjects.add(mapping.subjectId);
      if (mapping.chapterId) chapters.add(`${mapping.subjectId}:${mapping.chapterId}`);
    }
  }
  return { resources: resources.length, subjects: subjects.size, chapters: chapters.size, types };
}

export type LibraryFilters = {
  subject: string; chapter: string; type: string; scope: string;
  view: "library" | "favorites" | "downloads" | "recent";
  favorites: Set<string>; downloads: Set<string>; recent: Set<string>; searchIds?: Set<string>;
};
export function filterLibrary<T extends ResourceRecord>(resources: T[], filters: LibraryFilters): T[] {
  return resources.filter(resource => {
    if (filters.searchIds && !filters.searchIds.has(resource.id)) return false;
    if (filters.subject && !resource.mappings.some(mapping => mapping.subjectId === filters.subject
      && (!filters.chapter || !mapping.chapterId || mapping.chapterId === filters.chapter))) return false;
    if (filters.type && resource.resourceType !== filters.type
      && !(ARTIFACT_TYPES.includes(filters.type as typeof ARTIFACT_TYPES[number]) && readableSource(resource))) return false;
    if (filters.scope === "built-in" && resource.visibility !== "GLOBAL") return false;
    if (filters.scope === "personal" && resource.visibility !== "PRIVATE") return false;
    if (filters.view === "favorites" && !filters.favorites.has(resource.id)) return false;
    if (filters.view === "downloads" && !filters.downloads.has(resource.id)) return false;
    if (filters.view === "recent" && !filters.recent.has(resource.id)) return false;
    return true;
  });
}

/** Read every API page; the original library's tabs must not silently filter only page one. */
export async function loadResourcePages(query: URLSearchParams, signal: AbortSignal, request: (url: string, options: RequestInit) => Promise<Response> = fetch): Promise<ResourceResult> {
  async function page(number: number): Promise<ResourceResult> {
    const params = new URLSearchParams(query); params.set("limit", "24"); params.set("page", String(number));
    const response = await request(`/api/resources?${params}`, { signal, credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "Resources could not be loaded. Please retry.");
    return result;
  }
  const first = await page(1);
  const responses = [first];
  // Bounded batches avoid flooding the private index; existing API caps its library size.
  for (let start = 2; start <= first.pages; start += 3) {
    if (signal.aborted) throw new DOMException("Resource request cancelled", "AbortError");
    responses.push(...await Promise.all(Array.from({ length: Math.min(3, first.pages - start + 1) }, (_, index) => page(start + index))));
  }
  const unique = new Map(responses.flatMap(result => result.resources).map(resource => [resource.id, resource]));
  return { ...first, resources: [...unique.values()], privateAvailable: responses.every(result => result.privateAvailable) };
}
