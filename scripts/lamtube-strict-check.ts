/** Bounded live diagnostic using the production structured-output path. No private inputs. */
import { mock } from "bun:test";
import { z } from "zod";
import { scenePlanSchema } from "../src/lib/lamtube/model";
import { validatedGeneration } from "../src/lib/lamtube/structured-output";
mock.module("server-only", () => ({}));
const { generateScholarGroqJSON } = await import("../src/lib/ai/scholar-groq");
try {
  const schema = z.toJSONSchema(scenePlanSchema);
  const scene = await validatedGeneration(scenePlanSchema,
    `Teach Class 11 Newton's second law in chapter p5. Create a short evolving animation, with 5 narration phrases under 200 characters each, 5-8 visual elements and timed cues across the phrases. Use an arrow and moving block to explain F=ma, not just labels. Use coordinates within 1000x1000, sourceIds [], question null. Generate lesson data matching ${JSON.stringify(schema)}`,
    prompt => generateScholarGroqJSON({ messages: [{ role: "system", content: prompt }, { role: "user", content: "Generate the scene JSON, not its schema." }], jsonSchema: schema, maxTokens: 8000, signal: AbortSignal.timeout(45000) }));
  console.log(JSON.stringify({ ok: true, phrases: scene.phrases.length, elements: scene.elements.length, cues: scene.cues.length }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, type: error instanceof Error ? error.name : "Unknown", code: (error as {code?: string}).code,
    ...(error instanceof z.ZodError ? { issues: error.issues.map(issue => ({ path: issue.path.join("."), code: issue.code })) } : {}) }));
  process.exitCode = 1;
}
