import { describe, expect, mock, test } from "bun:test";
import { z } from "zod";

// Explicit opt-in: these tests spend provider quota using synthetic study
// prompts only. Never log credentials, prompts, or full provider error bodies.
mock.module("server-only", () => ({}));
const { generateScholarGroqText, generateScholarGroqJSON, streamScholarGroqText, getScholarGroqConfig } = await import("../src/lib/ai/scholar-groq");
const { flashcardsSchema, checkpointSchema } = await import("../src/lib/ai/schemas");
const { buildSystemPrompt } = await import("../src/lib/ai/personas");

async function measured<T>(capability: string, operation: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try {
    const result = await operation();
    console.info(JSON.stringify({ capability, status: "passed", elapsedMs: Math.round(performance.now() - started) }));
    return result;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "PROBE_FAILED";
    throw new Error(`${capability}: ${code} after ${Math.round(performance.now() - started)} ms`);
  }
}

describe.skipIf(process.env.SCHOLAR_LIVE_AI !== "1")("live configured Groq adapter", () => {
  test("answer evaluation system prompt matches the renderer schema", async () => {
    const { answerEvaluationSchema } = await import("../src/lib/ai/schemas");
    const value = await measured("answer-evaluation", () => generateScholarGroqJSON({ messages: [
      { role: "system", content: buildSystemPrompt({ persona: "default", mode: "answer-evaluation", scholarClass: 11, jeeMode: false }) },
      { role: "user", content: "Evaluate out of 2 marks. Question: What is Newton's second law? Student answer: Force equals mass times acceleration, F=ma, measured in newtons." },
    ] }));
    expect(answerEvaluationSchema.safeParse(value).success).toBe(true);
  }, 55_000);
  test("mock exam system prompt produces scoreable question records", async () => {
    const { mockExamSchema } = await import("../src/lib/ai/schemas");
    const value = await measured("mock-exam", () => generateScholarGroqJSON({ messages: [
      { role: "system", content: buildSystemPrompt({ persona: "default", mode: "mock-exam", scholarClass: 11, jeeMode: false }) },
      { role: "user", content: "Create two MCQs and one short question on Class 11 Laws of Motion, chapterId physics-laws, chapterTitle Laws of Motion. Two marks each." },
    ] }));
    expect(mockExamSchema.safeParse(value).success).toBe(true);
  }, 55_000);
  test("text answer is complete", async () => {
    console.info(JSON.stringify({ models: getScholarGroqConfig().models }));
    const text = await measured("text", () => generateScholarGroqText({ messages: [{ role: "user", content: "Explain Newton's first law in two short sentences for Class 11." }] }));
    expect(text.length).toBeGreaterThan(40);
  }, 55_000);
  test("checkpoint can be rendered and scored", async () => {
    const value = await measured("checkpoint", () => generateScholarGroqJSON({ messages: [{ role: "user", content: 'Return a JSON object with question (string), options (four strings), correctAnswer (zero-based integer), explanation (string). Make one Class 11 Newton second law MCQ.' }] }));
    const question = checkpointSchema.parse(value);
    expect(typeof question.correctAnswer).toBe("number");
    expect(question.options[question.correctAnswer as number]).toBeTruthy();
  }, 55_000);
  test("flashcards have valid fronts and backs", async () => {
    const value = await measured("flashcards", () => generateScholarGroqJSON({ messages: [{ role: "user", content: 'Make five Class 11 motion flashcards as JSON: {"cards":[{"front":"question","back":"answer"}]}. No extra prose.' }] }));
    expect(flashcardsSchema.parse(value).cards.length).toBe(5);
  }, 55_000);
  test("planner returns usable task records", async () => {
    const value = await measured("planner", () => generateScholarGroqJSON({ messages: [{ role: "user", content: 'Plan a 60-minute Class 11 vectors revision session. JSON only: {"tasks":[{"title":"string","minutes":20}]}. Positive integer minutes totaling 60.' }] }));
    const plan = z.object({ tasks: z.array(z.object({ title: z.string().min(1), minutes: z.number().int().positive() })).min(1) }).parse(value);
    expect(plan.tasks.reduce((sum, task) => sum + task.minutes, 0)).toBe(60);
  }, 55_000);
  test("stream starts and completes", async () => {
    let result = ""; let firstMs: number | undefined;
    const start = performance.now();
    await measured("stream", () => streamScholarGroqText({ messages: [{ role: "user", content: "Explain kinetic energy in three short sentences for Class 11." }] }, delta => {
      firstMs ??= Math.round(performance.now() - start); result += delta;
    }));
    console.info(JSON.stringify({ capability: "stream", firstTextMs: firstMs }));
    expect(result.length).toBeGreaterThan(40);
  }, 55_000);
});

describe.skipIf(process.env.SCHOLAR_LIVE_IMAGE !== "1")("live configured NVIDIA image adapter", () => {
  test("landscape request matches the live endpoint contract", async () => {
    const { generateNvidiaImage } = await import("../src/lib/ai/nvidia-image");
    const sharp = (await import("sharp")).default;
    const result = await measured("aisig-landscape", () => generateNvidiaImage("A simple educational illustration of a leaf on white paper.", "16:9"));
    const metadata = await sharp(Buffer.from(result.data, "base64")).metadata();
    expect(metadata.width).toBe(1392);
    expect(metadata.height).toBe(752);
  }, 95_000);
  test("square classroom diagram returns real image bytes", async () => {
    const { generateNvidiaImage } = await import("../src/lib/ai/nvidia-image");
    const sharp = (await import("sharp")).default;
    const result = await measured("aisig-image", () => generateNvidiaImage("A simple classroom diagram of a green plant with roots, stem and leaves on a clean white background.", "1:1"));
    const metadata = await sharp(Buffer.from(result.data, "base64")).metadata();
    expect(metadata.width).toBe(1024);
    expect(metadata.height).toBe(1024);
  }, 95_000);
});
