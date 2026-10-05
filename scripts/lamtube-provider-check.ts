/** Explicit, bounded provider diagnostic. Never prints keys, prompts or lesson text. */
import Groq from "groq-sdk";
import { z } from "zod";
import { outlineSchema, scenePlanSchema, VOICES } from "../src/lib/lamtube/model";
import { wavInfo } from "../src/lib/lamtube/wav";
import { parseGenerated } from "../src/lib/lamtube/structured-output";
import { mock } from "bun:test";
mock.module("server-only", () => ({}));
const { generateSpeech, speechConfiguration } = await import("../src/lib/lamtube/speech");

const apiKey = process.env.GROQ_API_KEY?.trim();
const configured = process.env.GROQ_MODEL?.trim();
const model = configured && configured !== "llama-3.3-70b-versatile" ? configured : "openai/gpt-oss-20b";
const client = new Groq({ apiKey, timeout: 25000, maxRetries: 0 });
const report = (stage: string, error: unknown) => {
  const e = error as { name?: string; status?: number; code?: string; error?: { error?: { code?: string } } };
  console.log(JSON.stringify({ stage, ok: false, type: e.name, status: e.status, code: e.code ?? e.error?.error?.code,
    ...(error instanceof z.ZodError ? { issues: error.issues.map(i => ({ path: i.path.join("."), code: i.code })) } : {}) }));
  process.exitCode = 1;
};
if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");

let outline: z.infer<typeof outlineSchema> | undefined;
try {
  const result = await client.chat.completions.create({ model, temperature: .35, max_completion_tokens: 5000,
    ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } as const : {}),
    response_format: { type: "json_object" }, messages: [{ role: "system", content: `You are Scholar's educational motion-graphics director. Teach accurate Class 11 Physics, Laws of Motion (chapterId: p5). Build a coherent ordered one-minute lesson, prerequisites first, intuitive explanation, formal concept, worked application and recap. Target 2 scenes. Return only JSON matching ${JSON.stringify(z.toJSONSchema(outlineSchema))}` }] });
  outline = parseGenerated(outlineSchema, JSON.parse(result.choices[0]?.message.content ?? ""));
  console.log(JSON.stringify({ stage: "outline", ok: true, scenes: outline.scenes.length, finish: result.choices[0]?.finish_reason }));
} catch (error) { report("outline", error); }

if (outline) {
  try {
    const result = await client.chat.completions.create({ model, temperature: .35, max_completion_tokens: 5000,
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low", include_reasoning: false } as const : {}),
      response_format: { type: "json_object" }, messages: [{ role: "system", content: `Teach accurate Class 11 Physics. OUTLINE DATA ${JSON.stringify(outline)} CURRENT SCENE ${JSON.stringify(outline.scenes[0])}. Return a REAL evolving explanatory scene. Use a 1000x1000 safe coordinate canvas: keep main content in x=80..920,y=140..800. Labels <=65 characters; equations short plain Unicode, no LaTeX. Use 5–12 narration phrases, each <=200 characters (speech limit), ~60–120 words TOTAL. Cues must reveal/draw/move multiple distinct elements at the phrase where the narration explains them, not show everything at time zero. Use pedagogically relevant arrows, changing objects, diagram, drawn graph/sketch or worked equation stages; do NOT merely display bullet points. Graph/sketch points are normalized coordinates within w/h, arrows point from x/y to x+w/y+h. Rectangles/circles support motion cues for physical demonstrations. Plain labels, never full paragraphs on canvas. camera is a subtle pan/zoom. Tables rows should be brief. Give optional 4-choice question; do not reveal its answer in narration. sourceIds must be []. Return JSON matching ${JSON.stringify(z.toJSONSchema(scenePlanSchema))}` }] });
    const scene = parseGenerated(scenePlanSchema, JSON.parse(result.choices[0]?.message.content ?? ""));
    console.log(JSON.stringify({ stage: "scenes", ok: true, phrases: scene.phrases.length, finish: result.choices[0]?.finish_reason }));
  } catch (error) { report("scenes", error); }
}

try {
  const bytes = await generateSpeech("Net force equals mass times acceleration.", { voice: VOICES[0], pace: "normal" }, AbortSignal.timeout(25000));
  const info = wavInfo(bytes);
  console.log(JSON.stringify({ stage: "narration", provider: speechConfiguration().provider, ok: true, duration: info.duration, size: info.size }));
} catch (error) { report("narration", error); }
