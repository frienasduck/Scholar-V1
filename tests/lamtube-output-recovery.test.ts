import { expect, test } from "bun:test";
import { outlineSchema, scenePlanSchema } from "../src/lib/lamtube/model";
import { previewVideo } from "../src/lib/lamtube/preview";
import { parseGenerated, validatedGeneration } from "../src/lib/lamtube/structured-output";

test("generated metadata is discarded without changing accepted lesson values", () => {
  const source = previewVideo().plans[0];
  const input = { ...source, $schema: "model metadata", elements: source.elements.map(element => ({ ...element, explanation: "unused" })) };
  expect(() => scenePlanSchema.parse(input)).toThrow();
  expect(parseGenerated(scenePlanSchema, input)).toEqual(source);
});
test("invalid geometry, cue references and executable kinds are still rejected", () => {
  const source = previewVideo().plans[0];
  for (const bad of [
    { ...source, elements: [{ ...source.elements[0], kind: "script" }, ...source.elements.slice(1)] },
    { ...source, elements: [{ ...source.elements[0], x: -5 }, ...source.elements.slice(1)] },
    { ...source, cues: source.cues.map(cue => ({ ...cue, element: "does-not-exist" })) },
  ]) expect(() => parseGenerated(scenePlanSchema, bad)).toThrow();
});
test("one bounded repair corrects invalid output; repeated invalid data stops", async () => {
  const valid = { summary: "Forces", scenes: previewVideo().plans.map(({ title, chapterId, goal }) => ({ title, chapterId, goal })) };
  let calls = 0;
  const value = await validatedGeneration(outlineSchema, "Build a lesson", async prompt => {
    calls++;
    if (calls === 1) return { summary: "Forces", scenes: [] };
    expect(prompt).toContain("failed validation");
    return valid;
  });
  expect(value).toEqual(valid);
  expect(calls).toBe(2);
  calls = 0;
  await expect(validatedGeneration(outlineSchema, "Build", async () => { calls++; return {}; })).rejects.toThrow();
  expect(calls).toBe(2);
});
test("provider authorization and transport failures are not blindly retried", async () => {
  let calls = 0;
  await expect(validatedGeneration(outlineSchema, "Build", async () => { calls++; throw new Error("Access denied"); })).rejects.toThrow("Access denied");
  expect(calls).toBe(1);
});
