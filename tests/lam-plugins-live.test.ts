import { describe, expect, mock, test } from "bun:test";
import sharp from "sharp";

// Live integration test across ALL 23 available LAM AI plugins.
// Requires explicit SCHOLAR_LIVE_LAM_PLUGINS=1 and configured API keys in .env.local.
mock.module("server-only", () => ({}));

const { availablePlugins } = await import("../src/lib/lam/plugin-registry");
const { executePluginServer } = await import("../src/lib/lam/plugin-server");
const { resolvePluginOutputType } = await import("../src/lib/lam/plugin-prompts");

const SAMPLE_PROMPTS: Record<string, string> = {
  "ai-pdf-studio": "Newton's three laws of motion with key formulas and one worked numerical for Class 11",
  "mistake-analyzer": "I keep confusing scalar distance with vector displacement and forgetting negative deceleration signs in SUVAT numericals.",
  "memory-predictor": "Predict retention for Laws of Motion, Work Energy Power, and Mole Concept",
  "academic-coach": "How do I raise my Physics and Chemistry accuracy before midterm exams in 2 weeks?",
  "homework-scanner": "Solve the linear equation shown in this uploaded problem photo.",
  "daily-briefing": "Create my study briefing for today focusing on Class 11 Kinematics.",
  "chapter-builder": "Build an introductory note pack for Class 11 Thermodynamics Zeroth & First Law.",
  "life-saver": "My Physics test on Projectile Motion is tomorrow morning and I feel overwhelmed.",
  "study-companion": "Let's quickly drill Ohm's Law and resistivity concepts together.",
  "aisig": "Clean textbook physics vector force diagram of a block resting on a smooth inclined plane with gravity mg, normal force N, and friction arrows labeled clearly",
  "slideshow-maker": "Work, Energy and Power — 5 concise slides for Class 11 revision",
  "one-night-exam": "One night cram plan for Class 11 Gravitation (4 hours available)",
  "concept-explainer": "Explain Lenz's Law with clear physical intuition and a worked example.",
  "chapter-summarizer": "Summarize Work-Energy Theorem and Conservative Forces for Class 11 Physics.",
  "flashcard-maker": "Generate flashcards for Kinetic Theory of Gases and Ideal Gas Law.",
  "formula-sheet-generator": "Formula sheet for Rotational Motion and Moment of Inertia.",
  "notes-to-quiz": "Create a 4-question MCQ quiz on Newton's Second Law and Impulse.",
  "answer-evaluator": "Question: State Newton's second law of motion and write its mathematical form (3 marks). My answer: The rate of change of momentum is directly proportional to applied unbalanced force, F = dp/dt = ma, measured in Newtons.",
  "revision-planner": "Plan my 5-day revision schedule for Thermodynamics, Equilibrium, and Hydrocarbons.",
  "diagram-flowchart-builder": "Flowchart explaining steps to draw a Free Body Diagram and solve Newton's 2nd Law problems.",
  "pyq-solver": "CBSE Class 11 Physics: A body of mass 2 kg starts from rest with acceleration 3 m/s^2 for 4 s. Find final velocity and distance travelled (3 marks).",
  "ncert-question-generator": "Generate CBSE/NCERT questions on Uniform Circular Motion & Centripetal Force.",
  "mistake-pattern-tracker": "Analyze why students lose marks on vector components and sign conventions in Kinematics.",
};

async function buildProblemPngBase64(): Promise<string> {
  const svg = `<svg width="680" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect width="680" height="200" fill="#ffffff"/>
    <text x="32" y="78" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#111111">Q1. Solve: 2x + 6 = 14</text>
    <text x="32" y="136" font-family="Arial, sans-serif" font-size="24" fill="#222222">Find the exact value of x step by step.</text>
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return buf.toString("base64");
}

describe.skipIf(process.env.SCHOLAR_LIVE_LAM_PLUGINS !== "1")("live execution of all 23 registered LAM AI plugins", () => {
  const plugins = availablePlugins();

  test("registry exposes 23 available plugins matching sample prompts", () => {
    expect(plugins).toHaveLength(23);
    for (const plugin of plugins) {
      expect(SAMPLE_PROMPTS[plugin.id]).toBeTruthy();
    }
  });

  for (const plugin of plugins) {
    test(`executes ${plugin.id} (${resolvePluginOutputType(plugin.id)}) with real configured providers`, async () => {
      const started = Date.now();
      const events: Array<{ type?: string; status?: string; execution?: unknown }> = [];
      let imageUpload: { fileName: string; mimeType: "image/png"; base64Data: string } | undefined;

      if (plugin.id === "homework-scanner") {
        imageUpload = {
          fileName: "algebra-test.png",
          mimeType: "image/png",
          base64Data: await buildProblemPngBase64(),
        };
      }

      let result!: Awaited<ReturnType<typeof executePluginServer>>;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          result = await executePluginServer({
            input: {
              executionId: crypto.randomUUID(),
              pluginId: plugin.id,
              prompt: SAMPLE_PROMPTS[plugin.id],
              scholarClass: 11,
              jeeMode: false,
              isFollowUp: false,
              subjectTitle: "Physics",
              chapterTitle: "Laws of Motion",
              clientStats: {
                xp: 120,
                streak: 4,
                masteryAvg: 68,
                weakestSubject: "Physics",
                weakestPercent: 54,
                dueTasks: 2,
                dueTaskTitles: ["Revise FBD equations", "Solve 10 impulse problems"],
                studiedChapters: [
                  { name: "Physics: Motion in a Straight Line", progress: 85 },
                  { name: "Physics: Laws of Motion", progress: 60 },
                ],
                quizMistakeCount: 3,
                ppMistakeCount: 1,
                openDoubtCount: 1,
                mistakeSamples: [
                  "[Quiz · Physics · Laws of Motion] Sign convention on inclined plane (Picked: +mg sin theta; Correct: -mg sin theta)",
                ],
              },
              imageUpload,
            },
            userId: "live-verify-user",
            customAI: null,
            signal: AbortSignal.timeout(90_000),
            emit: (evt) => events.push(evt as { type?: string; status?: string; execution?: unknown }),
          });
          break;
        } catch (err) {
          const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
          const retryAfter = err && typeof err === "object" && "retryAfterSeconds" in err ? Number(err.retryAfterSeconds) : 10;
          if (code === "GROQ_RATE_LIMITED" && attempt < 3) {
            await new Promise((r) => setTimeout(r, Math.min(25_000, Math.max(4_000, (retryAfter + 2) * 1000))));
            continue;
          }
          throw err;
        }
      }

      const elapsedMs = Date.now() - started;
      expect(result.execution.status).toBe("completed");
      expect(result.execution.outputType).toBe(resolvePluginOutputType(plugin.id));
      expect(events.some((e) => e.type === "status")).toBe(true);
      expect(events.some((e) => e.type === "result")).toBe(true);

      // Type-specific structured assertions
      switch (result.execution.outputType) {
        case "quiz":
          expect(result.execution.quiz?.length).toBeGreaterThanOrEqual(2);
          break;
        case "ncert-set":
          expect(result.execution.ncertData?.items?.length).toBeGreaterThanOrEqual(2);
          break;
        case "flashcards":
          expect(result.execution.flashcards?.length).toBeGreaterThanOrEqual(3);
          break;
        case "slideshow":
          expect(result.execution.slideshowData?.slides?.length).toBeGreaterThanOrEqual(3);
          break;
        case "formula-sheet":
          expect(result.execution.formulas?.length).toBeGreaterThanOrEqual(3);
          break;
        case "pdf":
          expect(result.execution.pdfData?.sections?.length).toBeGreaterThanOrEqual(1);
          expect(result.execution.pdfData?.fullMarkdown.length).toBeGreaterThan(80);
          break;
        case "explainer":
          expect(result.execution.explainerData?.intuition.length).toBeGreaterThan(10);
          break;
        case "image":
          expect(result.execution.imageData?.url.startsWith("data:image/")).toBe(true);
          break;
        case "homework":
          expect(result.execution.homeworkData?.ocrText.length).toBeGreaterThan(3);
          expect(result.execution.homeworkData?.solution.length).toBeGreaterThan(15);
          break;
        case "evaluator":
          expect(typeof result.execution.evaluatorData?.score).toBe("number");
          break;
        case "planner":
          expect(result.execution.plannerData?.tasks?.length).toBeGreaterThanOrEqual(2);
          break;
        case "flowchart":
          expect(result.execution.flowchartData?.steps?.length).toBeGreaterThanOrEqual(3);
          break;
        case "analytics":
          expect(result.execution.analyticsData?.items?.length).toBeGreaterThanOrEqual(1);
          break;
        case "pyq":
          expect(result.execution.pyqData?.markingSteps?.length).toBeGreaterThanOrEqual(2);
          break;
        case "companion":
          expect(result.execution.companionData?.markdown.length).toBeGreaterThan(20);
          break;
        default:
          throw new Error(`Unexpected outputType ${result.execution.outputType}`);
      }

      console.info(
        JSON.stringify({
          pluginId: plugin.id,
          outputType: result.execution.outputType,
          status: "passed",
          durationMs: elapsedMs,
        }),
      );
    }, 180_000);
  }
});
