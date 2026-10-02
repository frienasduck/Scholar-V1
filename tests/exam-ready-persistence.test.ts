import { afterAll, beforeEach, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
const { questionIdentity } = await import("../src/lib/exam-ready/question-identity");
const { readExamReadyMock, readExamReadyRun, saveExamReadyRun } = await import("../src/lib/exam-ready/mock-adapter");
const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
const values = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } });
beforeEach(() => values.clear());
afterAll(() => { if (original) Object.defineProperty(globalThis, "sessionStorage", original); else Reflect.deleteProperty(globalThis, "sessionStorage"); });
const handoff = { id: "prep", owner: "owner", grade: 11 as const, subjectId: "physics", chapterIds: ["p5"], duration: 5, numQuestions: 3, pattern: "mcq-only" as const, at: Date.now() };

test("repeated generated wording cannot inflate unique question evidence", () => {
  expect(questionIdentity("physics", "p5", "Explain inertia", ["a", "b", "c", "d"])).toBe(questionIdentity("physics", "p5", "  EXPLAIN  inertia ", ["d", "c", "b", "a"]));
});
test("different chapters and distinct questions remain separate evidence", () => {
  expect(questionIdentity("physics", "p5", "Explain inertia")).not.toBe(questionIdentity("physics", "p2", "Explain inertia"));
  expect(questionIdentity("physics", "p5", "Explain inertia")).not.toBe(questionIdentity("physics", "p5", "Explain acceleration"));
});
test("mock answers and start timestamp survive a local refresh", () => {
  const progress = { responses: { q1: "b" }, startedAt: Date.now() - 12000 };
  saveExamReadyRun(handoff, progress);
  expect(readExamReadyRun<typeof progress>(handoff)).toEqual(progress);
});
test("mock progress cannot cross account, grade or preparation boundaries", () => {
  saveExamReadyRun(handoff, { responses: { q1: "private answer" } });
  expect(readExamReadyRun({ ...handoff, owner: "someone-else" })).toBeNull();
  expect(readExamReadyRun({ ...handoff, grade: 9 })).toBeNull();
  expect(readExamReadyRun({ ...handoff, id: "other-prep" })).toBeNull();
});
test("damaged and oversized mock progress fails safely", () => {
  values.set("scholar:exam-ready:mock:run:owner:11:prep", "not json");
  expect(readExamReadyRun(handoff)).toBeNull();
  saveExamReadyRun(handoff, { huge: "x".repeat(500000) });
  expect(readExamReadyRun(handoff)).toBeNull();
});
test("handoff is restricted to its account and expiration", () => {
  values.set("scholar:exam-ready:mock", JSON.stringify(handoff));
  expect(readExamReadyMock(11, "owner")?.id).toBe("prep");
  expect(readExamReadyMock(11, "someone-else")).toBeNull();
  values.set("scholar:exam-ready:mock", JSON.stringify({ ...handoff, at: Date.now() - 7 * 3600000 }));
  expect(readExamReadyMock(11, "owner")).toBeNull();
});
