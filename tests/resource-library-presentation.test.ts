import { describe, expect, test } from "bun:test";
import catalog from "../src/lib/resources/catalog.json";
import { canonicalResourceType, filterLibrary, libraryStats, loadResourcePages, readableSource } from "../src/components/resources/library-presentation";
import type { LibraryFilters } from "../src/components/resources/library-presentation";
import type { ResourceRecord, ResourceResult } from "../src/lib/resources/types";

const records = catalog as ResourceRecord[];
function filters(overrides: Partial<LibraryFilters> = {}): LibraryFilters {
  return { subject: "", chapter: "", type: "", scope: "all", view: "library", favorites: new Set(), downloads: new Set(), recent: new Set(), ...overrides };
}

describe("restored Resources presentation", () => {
  test("counts only the real imported sources and mapped chapters", () => {
    const stats = libraryStats(records);
    expect(stats.resources).toBe(126);
    expect(stats.subjects).toBe(3);
    expect(stats.chapters).toBe(45);
    expect(stats.types.textbook).toBe(37);
    expect(stats.types["question-bank"]).toBe(45);
    expect(stats.types.notes).toBe(28);
  });
  test("reads every catalog page without losing the final sources", async () => {
    const requested: number[] = [];
    const request = (async (url: string | URL | Request) => {
      const page = Number(new URL(String(url), "http://localhost").searchParams.get("page")); requested.push(page);
      return Response.json({ resources: records.slice((page - 1) * 24, page * 24), total: records.length, pages: 6, page, privateAvailable: true });
    });
    const loaded = await loadResourcePages(new URLSearchParams({ grade: "11" }), new AbortController().signal, request);
    expect(loaded.resources).toHaveLength(126);
    expect(new Set(loaded.resources.map(resource => resource.id)).size).toBe(126);
    expect(requested.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(loaded.resources.at(-1)?.id).toBe(records.at(-1)?.id);
  });
  test("Favorites, Downloads and Recent work across the entire library", () => {
    const id = records.at(-1)!.id;
    for (const view of ["favorites", "downloads", "recent"] as const) {
      const result = filterLibrary(records, filters({ view, favorites: new Set([id]), downloads: new Set([id]), recent: new Set([id]) }));
      expect(result.map(resource => resource.id)).toEqual([id]);
    }
  });
  test("chapter chips preserve whole-subject sources and exclude other chapters", () => {
    const result = filterLibrary(records, filters({ subject: "physics", chapter: "p5" }));
    expect(result.length).toBeGreaterThan(1);
    expect(result.every(resource => resource.mappings.some(mapping => mapping.subjectId === "physics" && ["", "p5"].includes(mapping.chapterId)))).toBe(true);
    expect(result.some(resource => resource.resourceType === "syllabus")).toBe(true);
  });
  test("indexed-text search matches stay available with subject and type filters", () => {
    const selected = records.find(resource => resource.resourceType === "question-bank" && resource.mappings.some(mapping => mapping.subjectId === "maths"))!;
    const result = filterLibrary(records, filters({ subject: "maths", type: "question-bank", searchIds: new Set([selected.id]) }));
    expect(result.map(resource => resource.id)).toEqual([selected.id]);
    expect(canonicalResourceType("ncert")).toBe("textbook");
    expect(canonicalResourceType("formula")).toBe("formula-sheet");
  });
  test("copying and study aids are never offered for link-only or scanned sources", () => {
    const link = records.find(resource => resource.state === "LINK_ONLY")!;
    const readable = records.find(resource => resource.canStoreCopy && resource.state === "READY")!;
    expect(readableSource(link)).toBe(false);
    expect(readableSource(readable)).toBe(true);
    expect(readableSource({ ...readable, sourceMetadata: { needsOcr: true } })).toBe(false);
    expect(readableSource({ ...readable, state: "EXTRACTING" })).toBe(false);
    expect(filterLibrary(records, filters({ type: "formula-sheet" })).every(readableSource)).toBe(true);
  });
  test("a failed or cancelled page cannot publish a partial catalog", async () => {
    let calls = 0;
    const failingRequest = (async () => {
      calls += 1;
      return calls === 1 ? Response.json({ resources: [], total: 30, page: 1, pages: 2, privateAvailable: true } satisfies ResourceResult) : Response.json({ message: "Unavailable" }, { status: 503 });
    });
    await expect(loadResourcePages(new URLSearchParams(), new AbortController().signal, failingRequest)).rejects.toThrow("Unavailable");
    const controller = new AbortController();
    const cancellingRequest = async () => { controller.abort(); return Response.json({ resources: [], total: 30, page: 1, pages: 2, privateAvailable: true }); };
    await expect(loadResourcePages(new URLSearchParams(), controller.signal, cancellingRequest)).rejects.toThrow("cancelled");
  });
});
