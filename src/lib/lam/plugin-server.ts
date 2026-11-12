import "server-only";

import { z } from "zod";
import { AIProviderError } from "@/lib/ai/errors";
import { generateNvidiaImage } from "@/lib/ai/nvidia-image";
import { buildSystemPrompt } from "@/lib/ai/personas";
import {
  generateScholarGroqJSON,
  generateScholarGroqText,
  streamScholarGroqText,
  type ScholarGroqMessage,
} from "@/lib/ai/scholar-groq";
import {
  answerEvaluationSchema,
  flashcardsSchema,
  quizGenerationSchema,
} from "@/lib/ai/schemas";
import type { UserAISettings } from "@/lib/ai/user-provider";
import { recognizePageImage } from "@/lib/ebooks/ocr";
import { streamLiveTutorText } from "@/lib/live-tutor/providers";
import { availablePlugins, pluginById } from "@/lib/lam/plugin-registry";
import {
  parseMarkdownSections,
  pluginPlusRequirement,
  resolvePluginOutputType,
} from "@/lib/lam/plugin-prompts";
import type {
  LamPluginAnalyticsData,
  LamPluginCompanionData,
  LamPluginEvaluatorData,
  LamPluginExecution,
  LamPluginFlowchartData,
  LamPluginFormula,
  LamPluginHomeworkData,
  LamPluginNcertSetData,
  LamPluginPlannerData,
  LamPluginPyqData,
  LamPluginQuizQuestion,
  LamPluginSlide,
} from "@/lib/lam/types";
import { streamResponseToText } from "@/lib/lam/plugin-stream-helpers";
import { retrieve } from "@/lib/resources/service";
import { retrievalPrompt } from "@/lib/resources/engine";
import { chapterContext } from "@/lib/resources/grounding";

export const PLUGIN_EXECUTION_CLIENT_STATS_SCHEMA = z.object({
  xp: z.number().nonnegative().max(10_000_000).optional(),
  streak: z.number().nonnegative().max(10_000).optional(),
  masteryAvg: z.number().min(0).max(100).optional(),
  weakestSubject: z.string().max(120).optional(),
  weakestPercent: z.number().min(0).max(100).optional(),
  dueTasks: z.number().nonnegative().max(10_000).optional(),
  dueTaskTitles: z.array(z.string().max(160)).max(10).optional(),
  studiedChapters: z.array(z.object({
    name: z.string().max(160),
    progress: z.number().min(0).max(100),
  })).max(20).optional(),
  quizMistakeCount: z.number().nonnegative().max(10_000).optional(),
  ppMistakeCount: z.number().nonnegative().max(10_000).optional(),
  openDoubtCount: z.number().nonnegative().max(10_000).optional(),
  mistakeSamples: z.array(z.string().max(400)).max(20).optional(),
}).strict();

export const PLUGIN_EXECUTE_REQUEST_SCHEMA = z.object({
  executionId: z.string().uuid(),
  pluginId: z.string().trim().min(1).max(80),
  prompt: z.string().trim().max(4_000).default(""),
  scholarClass: z.union([z.literal(9), z.literal(11)]).default(11),
  jeeMode: z.boolean().default(false),
  subjectTitle: z.string().trim().max(120).optional(),
  chapterTitle: z.string().trim().max(180).optional(),
  conversationContext: z.string().trim().max(8_000).optional(),
  isFollowUp: z.boolean().default(false),
  attachmentText: z.string().trim().max(8_000).optional(),
  attachmentNames: z.array(z.string().trim().max(120)).max(6).optional(),
  imageUpload: z.object({
    fileName: z.string().trim().min(1).max(120),
    mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
    base64Data: z.string().min(16).max(14_000_000),
  }).strict().optional(),
  clientStats: PLUGIN_EXECUTION_CLIENT_STATS_SCHEMA.optional(),
}).strict();

export type PluginExecuteInput = z.infer<typeof PLUGIN_EXECUTE_REQUEST_SCHEMA>;

export type PluginServerEvent =
  | { type: "status"; status: "preparing" | "running" | "generating"; progressStage: string; currentStep?: number; totalSteps?: number }
  | { type: "delta"; value: string }
  | { type: "result"; content: string; execution: LamPluginExecution }
  | { type: "error"; code: string; status: number; message: string };

const conceptExplainerOutputSchema = z.object({
  concept: z.string().trim().min(1),
  intuition: z.string().trim().min(10),
  definition: z.string().trim().min(10),
  derivation: z.string().trim().optional().default(""),
  workedExample: z.string().trim().optional().default(""),
  mistakes: z.array(z.string().trim().min(2)).min(1).max(8),
});

const formulasOutputSchema = z.object({
  formulas: z.array(z.object({
    name: z.string().trim().min(1),
    formula: z.string().trim().min(1),
    units: z.string().trim().min(1),
    condition: z.string().trim().optional(),
  })).min(1).max(20),
});

const slideshowOutputSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().optional(),
  slides: z.array(z.object({
    title: z.string().trim().min(1),
    type: z.string().trim().optional(),
    content: z.string().trim().optional(),
    bullets: z.array(z.string().trim().min(1)).min(1).max(8),
    formula: z.string().trim().optional(),
    takeaway: z.string().trim().min(1),
    note: z.string().trim().optional(),
  })).min(2).max(12),
});

const plannerOutputSchema = z.object({
  planTitle: z.string().trim().min(1),
  subtitle: z.string().trim().optional(),
  summaryMarkdown: z.string().trim().optional(),
  tasks: z.array(z.object({
    title: z.string().trim().min(1),
    subject: z.string().trim().min(1).default("Study"),
    date: z.string().trim().min(1).default("Today"),
    time: z.string().trim().optional(),
    durationMinutes: z.coerce.number().int().positive().max(480).optional(),
    priority: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
      z.enum(["low", "medium", "high"]).catch("medium"),
    ),
  })).min(1).max(24),
});

const flowchartOutputSchema = z.object({
  title: z.string().trim().min(1),
  steps: z.array(z.object({
    stepNumber: z.coerce.number().int().positive().optional(),
    title: z.string().trim().min(1),
    description: z.string().trim().min(3),
    keyRule: z.string().trim().optional(),
  })).min(3).max(12).transform((steps) =>
    steps.map((s, idx) => ({
      ...s,
      stepNumber: s.stepNumber ?? idx + 1,
    })),
  ),
});

const pyqOutputSchema = z.object({
  question: z.string().trim().min(3),
  yearExam: z.string().trim().min(1),
  totalMarks: z.coerce.number().positive().max(20),
  markingSteps: z.array(z.object({
    stepNumber: z.coerce.number().int().positive().optional(),
    title: z.string().trim().min(1),
    content: z.string().trim().min(2),
    marks: z.coerce.string().trim().min(1),
  })).min(1).max(10).transform((steps) =>
    steps.map((s, idx) => ({
      ...s,
      stepNumber: s.stepNumber ?? idx + 1,
    })),
  ),
  finalAnswer: z.string().trim().optional(),
  examinerTip: z.string().trim().min(3),
  commonPitfall: z.string().trim().min(3),
});

const ncertSetOutputSchema = z.object({
  title: z.string().trim().min(1),
  items: z.array(z.object({
    type: z.string().trim().min(1),
    marks: z.coerce.number().positive().max(10),
    question: z.string().trim().min(5),
    options: z.preprocess(
      (v) => (Array.isArray(v) && v.length === 0 ? undefined : v),
      z.array(z.string().trim().min(1)).min(2).max(6).optional(),
    ),
    answer: z.string().trim().optional().nullable().transform((v) => v ?? undefined),
    solution: z.string().trim().min(5),
  })).min(2).max(12),
});

const analyticsOutputSchema = z.object({
  title: z.string().trim().min(1),
  metricLabel: z.string().trim().min(1),
  metricValue: z.string().trim().min(1),
  honestyNote: z.string().trim().optional(),
  items: z.array(z.object({
    label: z.string().trim().min(1),
    value: z.union([z.string(), z.number()]),
    detail: z.string().trim().optional(),
    level: z.enum(["good", "warning", "danger"]).optional(),
  })).min(1).max(15),
  diagnosisMarkdown: z.string().trim().optional(),
  recommendation: z.string().trim().min(3),
});

const memoryPredictorRawSchema = z.object({
  topics: z.array(z.object({
    name: z.string().trim().min(1),
    retention: z.preprocess(
      (v) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null),
      z.number().min(0).max(100).nullable(),
    ),
    risk: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
      z.enum(["high", "medium", "low"]),
    ),
    reviseBy: z.preprocess(
      (v) => (typeof v === "string" && v.trim() ? v.trim() : "Within 48 hours"),
      z.string().min(1),
    ),
  })).min(1).max(20),
});

function normalizeQuizCandidate(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as { questions?: unknown[] };
  if (!Array.isArray(obj.questions)) return raw;
  const clean = (s: string) =>
    s.replace(/^\$|\$$/g, "").replace(/^[A-D][\).:\-]\s*/i, "").replace(/\s+/g, " ").trim().toLowerCase();
  return {
    ...obj,
    questions: obj.questions.map((item) => {
      if (!item || typeof item !== "object") return item;
      const q = item as Record<string, unknown>;
      if (!Array.isArray(q.options) || q.options.length !== 4) return item;
      const opts = q.options.map((o) => (typeof o === "string" ? o.trim() : String(o ?? "").trim()));
      const ansRaw = q.correctAnswer ?? q.answer;
      let resolved = typeof ansRaw === "string" ? ansRaw.trim() : typeof ansRaw === "number" ? String(ansRaw) : "";
      if (resolved && !opts.includes(resolved)) {
        const letterIdx = ["a", "b", "c", "d"].indexOf(resolved.replace(/[^a-z0-9]/gi, "").toLowerCase());
        const numIdx = /^[0-3]$/.test(resolved) ? Number(resolved) : -1;
        if (letterIdx >= 0 && letterIdx < 4) resolved = opts[letterIdx];
        else if (numIdx >= 0 && numIdx < 4) resolved = opts[numIdx];
        else {
          const target = clean(resolved);
          const matched = opts.find((o) => clean(o) === target);
          if (matched) resolved = matched;
        }
      }
      return {
        ...q,
        options: opts,
        ...(resolved ? { correctAnswer: resolved } : {}),
      };
    }),
  };
}

const lamQuizOutputSchema = z.preprocess(normalizeQuizCandidate, quizGenerationSchema);

function withJSONInstruction(messages: ScholarGroqMessage[]): ScholarGroqMessage[] {
  const [system, ...rest] = messages;
  return [
    {
      role: "system",
      content: `${typeof system.content === "string" ? system.content : ""}\n\nReturn ONLY one valid JSON object. Do not wrap in markdown code fences or add commentary outside the JSON.`,
    },
    ...rest,
  ];
}

async function sleepUnlessAborted(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function runValidatedJSON<T>(params: {
  messages: ScholarGroqMessage[];
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  signal: AbortSignal;
  custom?: UserAISettings | null;
}): Promise<T> {
  let repair = "";
  let schemaAttempts = 0;
  let rateLimitRetries = 0;
  let overrideModel: string | undefined;
  const tokenCap = params.maxTokens ?? 4_000;
  while (schemaAttempts < 3) {
    try {
      const attemptMessages: ScholarGroqMessage[] = [
        ...withJSONInstruction(params.messages),
        ...(repair ? [{ role: "system" as const, content: repair }] : []),
      ];
      const temp = Math.min(params.temperature ?? 0.35, repair ? 0.25 : 0.45);
      let rawValue: unknown;
      if (params.custom) {
        let txt = "";
        await streamLiveTutorText({
          provider: params.custom.provider,
          credential: { apiKey: params.custom.apiKey, model: params.custom.model },
          messages: attemptMessages.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: typeof m.content === "string" ? m.content : "",
          })),
          temperature: temp,
          maxTokens: tokenCap,
          signal: params.signal,
          onDelta: (d) => { txt += d; },
        });
        rawValue = JSON.parse(txt.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
      } else {
        rawValue = await generateScholarGroqJSON({
          messages: attemptMessages,
          model: overrideModel,
          temperature: temp,
          maxTokens: tokenCap,
          signal: params.signal,
        });
      }

      const parsed = params.schema.safeParse(rawValue);
      if (parsed.success) return parsed.data;

      repair = `Return a valid JSON object matching every field constraint. Validation issues: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 1200)}`;
      throw new AIProviderError("Structured plugin response failed validation. Retrying repair.", 502, "AI_SCHEMA_MISMATCH");
    } catch (err) {
      if (
        err instanceof AIProviderError &&
        err.code === "GROQ_RATE_LIMITED" &&
        rateLimitRetries < 2 &&
        !params.signal.aborted
      ) {
        rateLimitRetries += 1;
        if (!overrideModel) {
          overrideModel = process.env.GROQ_FALLBACK_MODEL?.trim() || "openai/gpt-oss-20b";
          continue;
        }
        const waitMs = Math.min(20_000, Math.max(2_000, ((err.retryAfterSeconds ?? 5) + 1) * 1000));
        await sleepUnlessAborted(waitMs, params.signal);
        continue;
      }
      schemaAttempts += 1;
      if (schemaAttempts >= 3 || params.signal.aborted || !(err instanceof AIProviderError) || !["AI_SCHEMA_MISMATCH", "GROQ_INVALID_JSON"].includes(err.code)) {
        throw err;
      }
    }
  }
  throw new AIProviderError("Plugin could not generate valid structured data. Please retry.", 502, "AI_SCHEMA_MISMATCH");
}

async function runTextOrStream(params: {
  messages: ScholarGroqMessage[];
  temperature?: number;
  signal: AbortSignal;
  custom?: UserAISettings | null;
  onDelta?: (chunk: string) => void;
}): Promise<string> {
  if (params.custom) {
    let full = "";
    await streamLiveTutorText({
      provider: params.custom.provider,
      credential: { apiKey: params.custom.apiKey, model: params.custom.model },
      messages: params.messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: typeof m.content === "string" ? m.content : "",
      })),
      temperature: params.temperature ?? 0.45,
      maxTokens: 6_000,
      signal: params.signal,
      onDelta: (d) => {
        full += d;
        params.onDelta?.(d);
      },
    });
    if (!full.trim()) throw new AIProviderError("Provider returned empty response.", 502, "AI_EMPTY_RESPONSE");
    return full.trim();
  }

  let overrideModel: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (params.onDelta) {
        return await streamResponseToText(
          (onChunk) =>
            streamScholarGroqText(
              {
                messages: params.messages,
                model: overrideModel,
                temperature: params.temperature ?? 0.45,
                maxTokens: 4_200,
                signal: params.signal,
              },
              onChunk,
            ),
          params.onDelta,
        );
      }

      return await generateScholarGroqText({
        messages: params.messages,
        model: overrideModel,
        temperature: params.temperature ?? 0.45,
        maxTokens: 4_200,
        signal: params.signal,
      });
    } catch (err) {
      if (
        attempt < 2 &&
        err instanceof AIProviderError &&
        err.code === "GROQ_RATE_LIMITED" &&
        !params.signal.aborted
      ) {
        if (!overrideModel) {
          overrideModel = process.env.GROQ_FALLBACK_MODEL?.trim() || "openai/gpt-oss-20b";
          continue;
        }
        const waitMs = Math.min(20_000, Math.max(2_000, ((err.retryAfterSeconds ?? 5) + 1) * 1000));
        await sleepUnlessAborted(waitMs, params.signal);
        continue;
      }
      throw err;
    }
  }
  throw new AIProviderError("Scholar AI is temporarily rate-limited. Please retry.", 429, "GROQ_RATE_LIMITED");
}

function parseAspectRatioFromPrompt(prompt: string): "1:1" | "3:4" | "4:3" | "9:16" | "16:9" {
  if (/\b16:9\b|widescreen|landscape/i.test(prompt)) return "16:9";
  if (/\b9:16\b|vertical story/i.test(prompt)) return "9:16";
  if (/\b4:3\b/i.test(prompt)) return "4:3";
  if (/\b3:4\b|portrait/i.test(prompt)) return "3:4";
  return "1:1";
}

function buildUserContextBlock(input: PluginExecuteInput, retrievedGrounding: string): string {
  const parts = [
    `CBSE Class ${input.scholarClass}${input.jeeMode ? " (JEE Advanced Track)" : ""}`,
    input.subjectTitle ? `Active Subject: ${input.subjectTitle}` : "",
    input.chapterTitle ? `Active Chapter: ${input.chapterTitle}` : "",
    retrievedGrounding ? `\nIndexed Scholar Source Grounding:\n${retrievedGrounding}` : "",
    input.attachmentText ? `\nAttached Study Material (${(input.attachmentNames ?? []).join(", ") || "Uploaded File"}):\n${input.attachmentText.slice(0, 3_500)}` : "",
    input.isFollowUp && input.conversationContext
      ? `\nMULTI-TURN REFINEMENT CONTEXT (preserve prior structure & modify according to the student's follow-up):\n${input.conversationContext.slice(0, 2_200)}`
      : "",
    `\nStudent Request: ${input.prompt || `Run ${input.pluginId} for ${input.chapterTitle || input.subjectTitle || `Class ${input.scholarClass} syllabus`}`}`,
  ].filter(Boolean);
  return parts.join("\n");
}

/**
 * Authoritative unified server-side plugin execution engine for all 23 available plugins.
 * Can be called by `/api/lam/plugins/execute` or verified in integration harnesses.
 */
export async function executePluginServer(params: {
  input: PluginExecuteInput;
  userId?: string | null;
  customAI?: UserAISettings | null;
  signal: AbortSignal;
  emit: (event: PluginServerEvent) => void;
}): Promise<{ content: string; execution: LamPluginExecution }> {
  const { input, userId, customAI, signal, emit } = params;
  const plugin = pluginById(input.pluginId);
  if (!plugin || plugin.availability !== "available") {
    throw new AIProviderError(
      plugin?.availability === "planned"
        ? `${plugin.name} is planned for a future release and cannot be executed yet.`
        : "Unknown LAM plugin.",
      400,
      "PLUGIN_UNAVAILABLE",
    );
  }

  const pId = plugin.id;
  const outputType = resolvePluginOutputType(pId);
  const plusReq = pluginPlusRequirement(pId);
  const subject = input.subjectTitle || (input.scholarClass === 11 ? "Physics" : "Science");
  const chapter = input.chapterTitle || "Active CBSE Topic";
  const today = new Date().toISOString().split("T")[0];

  emit({
    type: "status",
    status: "preparing",
    progressStage: `Preparing ${plugin.name}...`,
  });

  // Ground in Scholar Resources index when signed in and topic/prompt supplied
  let retrievedGrounding = "";
  if (userId && process.env.DB_DATABASE_URL?.trim() && (input.prompt || input.chapterTitle)) {
    const sources = await retrieve(
      userId,
      {
        ...chapterContext(input.scholarClass, input.subjectTitle, input.chapterTitle),
        q: (input.prompt || chapter).slice(0, 800),
      },
      undefined,
    ).catch(() => []);
    if (sources.length) {
      retrievedGrounding = retrievalPrompt(sources).slice(0, 3_000);
    }
  }

  const sharedContext = buildUserContextBlock(input, retrievedGrounding);
  const makeBaseExecution = (): Omit<LamPluginExecution, "status" | "outputType"> => ({
    executionId: input.executionId,
    pluginId: plugin.id,
    pluginName: plugin.name,
    category: plugin.category,
    rawPrompt: input.prompt,
    scholarClass: input.scholarClass,
    isPlus: Boolean(plusReq || plugin.entitlement || plugin.plus),
    attachmentNames: input.attachmentNames,
    completedAt: new Date().toISOString(),
  });

  // ==========================================================================
  // 1. AISIG (Plus) — Two-Step Prompt Enhancement + NVIDIA FLUX Image Generation
  // ==========================================================================
  if (pId === "aisig") {
    const conceptPrompt = input.prompt.trim() || `${subject}: ${chapter}`;
    const aspectRatio = parseAspectRatioFromPrompt(conceptPrompt);

    emit({
      type: "status",
      status: "running",
      progressStage: "Step 1 of 2: Enhancing prompt for educational clarity",
      currentStep: 1,
      totalSteps: 2,
    });

    const enhanceSystem = buildSystemPrompt({
      persona: "default",
      mode: "chat",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });
    const enhancedRaw = await runTextOrStream({
      messages: [
        { role: "system", content: enhanceSystem },
        {
          role: "user",
          content: `You are an educational image-prompt engineer for CBSE Class ${input.scholarClass} students. Rewrite this idea as a vivid, clear, school-appropriate textbook diagram or scientific illustration prompt (1-3 sentences) specifying visual composition, colors, clean labels/annotations, and clear lighting.\n\n${sharedContext}\n\nReturn ONLY the enhanced prompt without quotes or preamble.`,
        },
      ],
      temperature: 0.5,
      signal,
      custom: customAI,
    }).catch((err) => {
      if (err instanceof AIProviderError && err.code === "GROQ_RATE_LIMITED") {
        return conceptPrompt;
      }
      throw err;
    });
    const enhancedPrompt = enhancedRaw.replace(/^["']|["']$/g, "").trim();

    emit({
      type: "status",
      status: "generating",
      progressStage: "Step 2 of 2: Generating high-resolution study illustration",
      currentStep: 2,
      totalSteps: 2,
    });

    const img = await generateNvidiaImage(enhancedPrompt, aspectRatio, signal);
    const dataUrl = `data:${img.mimeType};base64,${img.data}`;

    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "image",
      imageData: {
        url: dataUrl,
        artifactId: `img-${input.executionId}`,
        prompt: conceptPrompt,
        enhancedPrompt,
        aspectRatio,
        style: "educational textbook illustration",
      },
    };
    const result = {
      content: `Generated educational illustration for **${conceptPrompt.slice(0, 80)}**:`,
      execution,
    };
    emit({ type: "result", ...result });
    return result;
  }

  // ==========================================================================
  // 2. HOMEWORK SCANNER / IMAGE ANALYSIS (Plus) — Step 1 OCR + Step 2 Hint & Solution
  // ==========================================================================
  if (pId === "homework-scanner") {
    let questionText = input.prompt.trim();
    let confidence: number | null = null;
    let fileName: string | undefined = input.imageUpload?.fileName;

    if (input.imageUpload) {
      emit({
        type: "status",
        status: "running",
        progressStage: "Step 1 of 2: Extracting homework text with OCR",
        currentStep: 1,
        totalSteps: 2,
      });
      const buf = Buffer.from(input.imageUpload.base64Data, "base64");
      const ocr = await recognizePageImage(buf);
      if (!ocr.text?.trim() && !questionText) {
        throw new AIProviderError(
          "No readable text was detected in that image. Try cropping closer or typing the question directly.",
          422,
          "NO_TEXT",
        );
      }
      if (ocr.text?.trim()) {
        questionText = questionText
          ? `${ocr.text.trim()}\n\nStudent note: ${questionText}`
          : ocr.text.trim();
      }
      confidence = ocr.confidence ?? null;
    }

    if (!questionText) {
      const waitingExecution: LamPluginExecution = {
        ...makeBaseExecution(),
        status: "waiting_input",
        outputType: "homework",
        requiresImage: true,
        waitingInputPrompt:
          "Please attach a PNG, JPEG, or WebP photo of your homework question (or paste the full question text).",
      };
      const res = { content: waitingExecution.waitingInputPrompt!, execution: waitingExecution };
      emit({ type: "result", ...res });
      return res;
    }

    emit({
      type: "status",
      status: "generating",
      progressStage: "Step 2 of 2: Building guided hint and step-by-step solution",
      currentStep: 2,
      totalSteps: 2,
    });

    const sys = buildSystemPrompt({
      persona: "homework-scanner",
      mode: "chat",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });
    const rawSolution = await runTextOrStream({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Solve this Class ${input.scholarClass} CBSE question. Structure strictly with "## Hint" first (a useful conceptual nudge without spoiling the final answer) followed by "## Solution" (complete step-by-step working, formulas, SI units, and final answer).\n\n${fileName ? `Image file: ${fileName}\n` : ""}Question:\n${questionText}\n${input.conversationContext ? `\n${input.conversationContext}` : ""}`,
        },
      ],
      temperature: 0.35,
      signal,
      custom: customAI,
    });

    const hintMatch = rawSolution.match(/##\s*Hint([\s\S]*?)(?=##\s*Solution|$)/i);
    const solMatch = rawSolution.match(/##\s*Solution([\s\S]*?)$/i);

    const homeworkData: LamPluginHomeworkData = {
      fileName,
      ocrText: questionText,
      confidence,
      hint: hintMatch ? hintMatch[1].trim() : "Identify the given variables and applicable fundamental law first.",
      solution: solMatch ? solMatch[1].trim() : rawSolution.trim(),
    };

    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "homework",
      homeworkData,
    };
    const result = {
      content: fileName
        ? `Extracted question from **${fileName}**${confidence !== null ? ` (${confidence}% OCR confidence)` : ""}. Try the hint first before revealing the complete solution:`
        : `Prepared a guided **Hint & Step-by-Step Solution**:`,
      execution,
    };
    emit({ type: "result", ...result });
    return result;
  }

  // ==========================================================================
  // 3. NOTES-TO-QUIZ — Validated 4-option MCQ Check
  // ==========================================================================
  if (pId === "notes-to-quiz") {
    emit({
      type: "status",
      status: "generating",
      progressStage: "Generating verified CBSE multiple-choice questions...",
      currentStep: 1,
      totalSteps: 1,
    });

    const sys = buildSystemPrompt({
      persona: "dr-meera",
      mode: "json",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });
    const data = await runValidatedJSON({
      messages: [
        {
          role: "system",
          content: `${sys}\n\nSolve each question before constructing four distinct options. Include exactly one correct option matching "correctAnswer" verbatim.`,
        },
        {
          role: "user",
          content: `Create 5 multiple-choice questions for Class ${input.scholarClass} CBSE.\n${sharedContext}\n\nFormatting rule: Wrap exponents/equations in $...$ (never leave bare ^{2}). Ensure "correctAnswer" copies one string from "options" verbatim.\n\nReturn JSON matching: { "questions": [{ "question": string, "options": [string, string, string, string], "correctAnswer": string (must match one option verbatim), "explanation": string }] }`,
        },
      ],
      schema: lamQuizOutputSchema,
      temperature: 0.4,
      signal,
      custom: customAI,
    });

    const quiz: LamPluginQuizQuestion[] = data.questions.map((q) => ({
      question: q.question,
      options: q.options,
      answer: (q.correctAnswer ?? q.answer ?? q.options[0]) as string,
      explanation: q.explanation,
    }));

    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "quiz",
      quiz,
    };
    const result = {
      content: input.isFollowUp
        ? `Updated your **${plugin.name}** questions based on your follow-up request:`
        : `Generated **${quiz.length} interactive MCQs**. Select an option on each card to check correctness and earn XP:`,
      execution,
    };
    emit({ type: "result", ...result });
    return result;
  }

  // ==========================================================================
  // 4. NCERT QUESTION GENERATOR — Mixed CBSE Pattern or Interactive MCQ
  // ==========================================================================
  if (pId === "ncert-question-generator") {
    emit({
      type: "status",
      status: "generating",
      progressStage: "Drafting NCERT & Board-pattern questions with solutions...",
    });

    const sys = buildSystemPrompt({
      persona: "dr-meera",
      mode: "json",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });

    const wantsOnlyMcq = /\bonly\s+mcq|mcqs?\s+only\b/i.test(input.prompt);
    if (wantsOnlyMcq) {
      const data = await runValidatedJSON({
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: `Create 5 NCERT Exemplar MCQs for Class ${input.scholarClass} CBSE.\n${sharedContext}\nReturn JSON: { "questions": [{ "question": string, "options": [string, string, string, string], "correctAnswer": string, "explanation": string }] }`,
          },
        ],
        schema: lamQuizOutputSchema,
        temperature: 0.4,
        signal,
        custom: customAI,
      });
      const quiz: LamPluginQuizQuestion[] = data.questions.map((q) => ({
        question: q.question,
        options: q.options,
        answer: (q.correctAnswer ?? q.answer ?? q.options[0]) as string,
        explanation: q.explanation,
      }));
      const execution: LamPluginExecution = {
        ...makeBaseExecution(),
        status: "completed",
        outputType: "quiz",
        quiz,
      };
      const result = {
        content: `Generated **${quiz.length} NCERT Exemplar MCQs**:`,
        execution,
      };
      emit({ type: "result", ...result });
      return result;
    }

    const data = await runValidatedJSON({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Generate 5 NCERT-aligned practice questions across CBSE patterns (e.g. Assertion-Reason 1M, Short Answer 2M, Analytical 3M, Case/Long Answer 5M) with complete model solutions.\n${sharedContext}\n\nReturn JSON: { "title": string, "items": [{ "type": string, "marks": number, "question": string, "options"?: [string, string, string, string], "answer"?: string, "solution": string }] }`,
        },
      ],
      schema: ncertSetOutputSchema,
      temperature: 0.4,
      signal,
      custom: customAI,
    });

    const ncertData: LamPluginNcertSetData = {
      title: data.title,
      subject,
      chapter,
      items: data.items,
    };
    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "ncert-set",
      ncertData,
    };
    const result = {
      content: `Generated **${ncertData.items.length} NCERT CBSE Practice Questions**. Toggle model solutions per question or export as a printable worksheet:`,
      execution,
    };
    emit({ type: "result", ...result });
    return result;
  }

  // ==========================================================================
  // 5. FLASHCARD MAKER — Validated against flashcardsSchema
  // ==========================================================================
  if (pId === "flashcard-maker") {
    emit({
      type: "status",
      status: "generating",
      progressStage: "Synthesizing active-recall flashcards...",
    });

    const sys = buildSystemPrompt({
      persona: "dr-meera",
      mode: "flashcards",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });
    const data = await runValidatedJSON({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Create 6 high-yield active-recall flashcards for Class ${input.scholarClass} CBSE.\n${sharedContext}\nReturn JSON: { "cards": [{ "front": string, "back": string, "explanation"?: string, "topic"?: string }] }`,
        },
      ],
      schema: flashcardsSchema,
      temperature: 0.4,
      signal,
      custom: customAI,
    });

    const flashcards = data.cards.map((c) => ({
      front: c.front,
      back: c.back,
      tip: c.explanation,
      topic: c.topic,
    }));

    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "flashcards",
      flashcards,
    };
    const result = {
      content: input.isFollowUp
        ? `Updated your **Flashcard Deck** (${flashcards.length} cards). Click any card to flip:`
        : `Created **${flashcards.length} active-recall flashcards**. Flip cards to test yourself or save them directly to your Flashcard Deck:`,
      execution,
    };
    emit({ type: "result", ...result });
    return result;
  }

  // ==========================================================================
  // 6. SLIDESHOW GENERATOR (Plus) — Structured Presentation Deck
  // ==========================================================================
  if (pId === "slideshow-maker") {
    emit({
      type: "status",
      status: "generating",
      progressStage: "Structuring interactive presentation slides and speaker notes...",
    });

    const sys = buildSystemPrompt({
      persona: "chapter-builder",
      mode: "json",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });
    const data = await runValidatedJSON({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Create a high-clarity educational slide deck (5 to 7 slides) for Class ${input.scholarClass} CBSE.\n${sharedContext}\n\nReturn JSON matching: { "title": string, "subtitle": string, "slides": [{ "title": string, "type": "concept"|"formula"|"example"|"quiz"|"summary", "content": string, "bullets": string[], "formula"?: string, "takeaway": string, "note": string }] }`,
        },
      ],
      schema: slideshowOutputSchema,
      temperature: 0.45,
      signal,
      custom: customAI,
    });

    const slides: LamPluginSlide[] = data.slides.map((s) => ({
      title: s.title,
      type: s.type,
      content: s.content,
      bullets: s.bullets,
      formula: s.formula,
      takeaway: s.takeaway,
      note: s.note,
    }));

    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "slideshow",
      slides,
      slideshowData: {
        title: data.title,
        subtitle: data.subtitle ?? `Class ${input.scholarClass} · ${subject}`,
        subject,
        chapter,
        slides,
      },
    };
    const result = {
      content: `Generated **${data.title}** (${slides.length} slides). Step through slides, inspect speaker notes, export to PowerPoint (.pptx), or save to Slideshow Library:`,
      execution,
    };
    emit({ type: "result", ...result });
    return result;
  }

  // ==========================================================================
  // 7. FORMULA SHEET GENERATOR
  // ==========================================================================
  if (pId === "formula-sheet-generator") {
    emit({
      type: "status",
      status: "generating",
      progressStage: "Compiling equations, SI units, and boundary conditions...",
    });

    const sys = buildSystemPrompt({
      persona: "physics-11",
      mode: "json",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });
    const data = await runValidatedJSON({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Compile a structured Formula & Key Relations Sheet for Class ${input.scholarClass} CBSE.\n${sharedContext}\nUse valid LaTeX strings wrapped cleanly (e.g. "$F = \\\\frac{Gm_1 m_2}{r^2}$"). Return JSON: { "formulas": [{ "name": string, "formula": string, "units": string, "condition": string }] }`,
        },
      ],
      schema: formulasOutputSchema,
      temperature: 0.3,
      signal,
      custom: customAI,
    });

    const formulas: LamPluginFormula[] = data.formulas;
    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "formula-sheet",
      formulas,
    };
    const result = {
      content: `Compiled **${formulas.length} formulas & boundary conditions**. Copy LaTeX equations, export PDF, or generate practice MCQs directly:`,
      execution,
    };
    emit({ type: "result", ...result });
    return result;
  }

  // ==========================================================================
  // 8. CONCEPT EXPLAINER
  // ==========================================================================
  if (pId === "concept-explainer") {
    emit({
      type: "status",
      status: "generating",
      progressStage: "Building 4-tier pedagogical concept breakdown...",
    });

    const sys = buildSystemPrompt({
      persona: "dr-meera",
      mode: "json",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });
    const data = await runValidatedJSON({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Break down the requested concept into: 1) Intuition & Analogy, 2) Exact CBSE Definition, 3) Derivation / Governing Equation, 4) Worked NCERT Example, and 5) Common Mistakes to avoid.\n${sharedContext}\nReturn JSON: { "concept": string, "intuition": string, "definition": string, "derivation": string, "workedExample": string, "mistakes": [string, ...] }`,
        },
      ],
      schema: conceptExplainerOutputSchema,
      temperature: 0.4,
      signal,
      custom: customAI,
    });

    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "explainer",
      explainerData: data,
    };
    const result = {
      content: `Prepared a structured breakdown for **${data.concept}**:`,
      execution,
    };
    emit({ type: "result", ...result });
    return result;
  }

  // ==========================================================================
  // 9. ANSWER EVALUATOR (Validated against canonical answerEvaluationSchema)
  // ==========================================================================
  if (pId === "answer-evaluator") {
    emit({
      type: "status",
      status: "generating",
      progressStage: "Grading against CBSE step-wise marking rubric...",
    });

    const sys = buildSystemPrompt({
      persona: "dr-meera",
      mode: "answer-evaluation",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });
    const rawEval = await runValidatedJSON({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Evaluate this student answer strictly against CBSE step-wise marking.\n${sharedContext}\nReturn JSON matching answerEvaluationSchema cleanly.`,
        },
      ],
      schema: answerEvaluationSchema,
      temperature: 0.3,
      signal,
      custom: customAI,
    });

    const evaluatorData: LamPluginEvaluatorData = {
      score: rawEval.score,
      maxScore: rawEval.maxScore,
      correctConcepts: rawEval.correctConcepts,
      missingConcepts: rawEval.missingConcepts,
      formulaFeedback: rawEval.formulaFeedback,
      unitsFeedback: rawEval.unitsFeedback,
      stepFeedback: rawEval.stepFeedback,
      markingBreakdown: rawEval.markingBreakdown,
      strengths: rawEval.correctConcepts,
      gaps: rawEval.missingConcepts,
      modelAnswer: rawEval.improvedAnswer,
    };

    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "evaluator",
      evaluatorData,
    };
    const result = {
      content: `CBSE Rubric Score: **${evaluatorData.score} / ${evaluatorData.maxScore} marks**. Review your criterion breakdown and model full-marks answer below:`,
      execution,
    };
    emit({ type: "result", ...result });
    return result;
  }

  // ==========================================================================
  // 10. PYQ SOLVER (Previous Year Question Solver)
  // ==========================================================================
  if (pId === "pyq-solver") {
    emit({
      type: "status",
      status: "generating",
      progressStage: "Solving previous-year question with CBSE step-mark allocation...",
    });

    const sys = buildSystemPrompt({
      persona: "physics-11",
      mode: "json",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });
    const data: LamPluginPyqData = await runValidatedJSON({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Solve this Class ${input.scholarClass} Previous Year Board/Competitive Question step-by-step with step marks.\n${sharedContext}\n\nFormatting rule: Wrap ONLY algebraic equations/symbols in $...$ — never wrap full English sentences in dollar signs.\n\nReturn JSON: { "question": string, "yearExam": string (e.g. "CBSE Board · Sample"), "totalMarks": number (1-5), "markingSteps": [{ "stepNumber": number, "title": string, "content": string, "marks": string (e.g. "1 mark") }], "finalAnswer": string, "examinerTip": string, "commonPitfall": string }`,
        },
      ],
      schema: pyqOutputSchema,
      temperature: 0.35,
      signal,
      custom: customAI,
    });

    const unwrapSentenceMath = (text: string) =>
      text.replace(/^\s*(?:\$\$?([^$]+?)\$\$?|\\\((.+?)\\\))\s*$/, (whole, dollarInner?: string, parenInner?: string) => {
        const inner = (dollarInner ?? parenInner ?? "").trim();
        return inner.split(/\s+/).filter((w) => /^[A-Za-z]{3,}$/.test(w)).length >= 3 ? inner : whole;
      });

    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "pyq",
      pyqData: {
        ...data,
        question: unwrapSentenceMath(data.question),
        markingSteps: data.markingSteps.map((step) => ({
          ...step,
          content: unwrapSentenceMath(step.content),
        })),
      },
    };
    const result = {
      content: `Step-wise CBSE Marking Scheme Solution (**${data.totalMarks} Marks**):`,
      execution,
    };
    emit({ type: "result", ...result });
    return result;
  }

  // ==========================================================================
  // 11. REVISION PLANNER / ACADEMIC COACH / ONE-NIGHT EXAM PREP
  // ==========================================================================
  if (pId === "revision-planner" || pId === "academic-coach" || pId === "one-night-exam") {
    emit({
      type: "status",
      status: "generating",
      progressStage:
        pId === "one-night-exam"
          ? "Designing prioritised tonight cram timeline..."
          : pId === "academic-coach"
            ? "Crafting personalised improvement plan from your study stats..."
            : "Scheduling spaced revision blocks around your syllabus...",
    });

    const statsBlock = input.clientStats
      ? `Recorded Learner Metrics: Streak ${input.clientStats.streak ?? 0} days, Avg Mastery ${input.clientStats.masteryAvg ?? 0}%, Weakest Subject: ${input.clientStats.weakestSubject ?? "N/A"} (${input.clientStats.weakestPercent ?? 0}%), Due Tasks: ${input.clientStats.dueTasks ?? 0}.`
      : "No recorded metrics passed; tailor cleanly to the student's message.";

    const personaId = pId === "academic-coach" ? "academic-coach" : pId === "one-night-exam" ? "one-night-exam" : "default";
    const sys = buildSystemPrompt({
      persona: personaId,
      mode: "study-plan",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });

    const modeDirectives =
      pId === "one-night-exam"
        ? `Build a focused tonight cram timeline from 6 PM to 11 PM (using 30-45 min tasks for date "${today}") including must-revise concepts, 1 quick problem per block, a breather, and topics safe to skip when short on time.`
        : pId === "academic-coach"
          ? `Act as a supportive yet structured academic coach. Give a realistic multi-day action plan grounded ONLY in the student's actual stats and stated goal starting from "${today}".`
          : `Create a realistic multi-day revision timetable starting from "${today}" with balanced retrieval & problem practice.`;

    const data = await runValidatedJSON({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `${modeDirectives}\n${statsBlock}\n${sharedContext}\n\nReturn JSON: { "planTitle": string, "subtitle": string, "summaryMarkdown": string, "tasks": [{ "title": string, "subject": string, "date": "YYYY-MM-DD", "time": "HH:MM", "durationMinutes": number, "priority": "low"|"medium"|"high" }] }`,
        },
      ],
      schema: plannerOutputSchema,
      temperature: 0.4,
      signal,
      custom: customAI,
    });

    const plannerData: LamPluginPlannerData = {
      planTitle: data.planTitle,
      subtitle: data.subtitle,
      summaryMarkdown: data.summaryMarkdown,
      tasks: data.tasks,
    };

    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "planner",
      plannerData,
    };
    const result = {
      content: `Built **${plannerData.planTitle}** (${plannerData.tasks.length} scheduled study blocks). Import individual blocks or the whole schedule directly into Scholar Planner:`,
      execution,
    };
    emit({ type: "result", ...result });
    return result;
  }

  // ==========================================================================
  // 12. DIAGRAM & FLOWCHART BUILDER
  // ==========================================================================
  if (pId === "diagram-flowchart-builder") {
    emit({
      type: "status",
      status: "generating",
      progressStage: "Structuring sequential nodes and governing rules...",
    });

    const sys = buildSystemPrompt({
      persona: "dr-meera",
      mode: "json",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });
    const data: LamPluginFlowchartData = await runValidatedJSON({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Build a step-by-step academic process flowchart (4 to 7 sequential stages) for Class ${input.scholarClass} CBSE.\n${sharedContext}\n\nReturn JSON: { "title": string, "steps": [{ "stepNumber": number, "title": string, "description": string, "keyRule"?: string }] }`,
        },
      ],
      schema: flowchartOutputSchema,
      temperature: 0.35,
      signal,
      custom: customAI,
    });

    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "flowchart",
      flowchartData: data,
    };
    const result = {
      content: `Mapped **${data.title}** across ${data.steps.length} sequential stages:`,
      execution,
    };
    emit({ type: "result", ...result });
    return result;
  }

  // ==========================================================================
  // 13. MISTAKE ANALYZER, MISTAKE PATTERN TRACKER & MEMORY PREDICTOR (REAL AI — ZERO FAKE NUMBERS)
  // ==========================================================================
  if (pId === "mistake-analyzer" || pId === "mistake-pattern-tracker" || pId === "memory-predictor") {
    emit({
      type: "status",
      status: "generating",
      progressStage:
        pId === "memory-predictor"
          ? "Calculating priority tiers from recorded chapter progress..."
          : "Diagnosing root misconceptions and recurring error patterns...",
    });

    if (pId === "memory-predictor") {
      const studied = input.clientStats?.studiedChapters ?? [];
      const sys = buildSystemPrompt({
        persona: "memory-predictor",
        mode: "json",
        scholarClass: input.scholarClass,
        jeeMode: input.jeeMode,
      });

      const studiedText = studied.length
        ? studied.map((c) => `- ${c.name}: ${c.progress}% recorded chapter progress`).join("\n")
        : `No chapter progress recorded yet. Topic focus requested directly: ${input.prompt || chapter}`;

      const raw = await runValidatedJSON({
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: `Suggest revision priorities using ONLY the supplied chapter progress:\n${studiedText}\n\n${sharedContext}\nNever invent review dates or pretend retention % is measured if review timestamps are absent — copy recorded chapter progress into "retention", or set "retention": null if no chapter progress is recorded. Return JSON: { "topics": [{ "name": string, "retention": number | null, "risk": "high"|"medium"|"low", "reviseBy": string }] }`,
          },
        ],
        schema: memoryPredictorRawSchema,
        temperature: 0.3,
        signal,
        custom: customAI,
      });

      const analyticsData: LamPluginAnalyticsData = {
        title: "Revision Priority Diagnostic",
        metricLabel: "Tracked Chapters",
        metricValue: studied.length ? `${studied.length} recorded` : "Prompt-based",
        honestyNote: "Priorities reflect recorded chapter completion progress; actual forgetting timestamps are not measured.",
        items: raw.topics.map((t) => ({
          label: t.name,
          value:
            studied.length > 0 && t.retention !== null
              ? `${Math.round(t.retention)}% · Revise ${t.reviseBy}`
              : `${t.risk.toUpperCase()} priority · Revise ${t.reviseBy}`,
          detail: `Priority tier: ${t.risk.toUpperCase()}`,
          level: t.risk === "high" ? "danger" : t.risk === "medium" ? "warning" : "good",
        })),
        recommendation: raw.topics.find((t) => t.risk === "high")?.name
          ? `Prioritise "${raw.topics.find((t) => t.risk === "high")!.name}" today using active recall before moving on.`
          : "Maintain spaced quick quizzes across completed chapters.",
      };

      const execution: LamPluginExecution = {
        ...makeBaseExecution(),
        status: "completed",
        outputType: "analytics",
        analyticsData,
      };
      const res = {
        content: `Prepared **Revision Priority Diagnostic** grounded in your recorded study progress:`,
        execution,
      };
      emit({ type: "result", ...res });
      return res;
    }

    // mistake-analyzer & mistake-pattern-tracker
    const stats = input.clientStats;
    const mistakeContext = stats?.mistakeSamples?.length
      ? `Recorded Student Mistakes & Open Doubts:\n${stats.mistakeSamples.join("\n")}`
      : "No historical quiz/past-paper mistakes logged yet in browser storage; analyze based strictly on student's message.";

    const sys = buildSystemPrompt({
      persona: "mistake-analyzer",
      mode: "json",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });
    const parsedAnalytics = await runValidatedJSON({
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Diagnose recurring misconceptions, root causes, and corrective steps strictly from supplied data (never fabricate statistics or percentages not observed).\n${mistakeContext}\n${sharedContext}\n\nFormatting rule: Do not indent markdown lists or step text by 4 spaces (avoid fenced or indented code blocks for prose).\n\nReturn JSON: { "title": string, "metricLabel": string, "metricValue": string, "items": [{ "label": string, "value": string, "detail": string, "level": "good"|"warning"|"danger" }], "diagnosisMarkdown": string (detailed markdown breakdown + 2 practice questions), "recommendation": string }`,
        },
      ],
      schema: analyticsOutputSchema,
      temperature: 0.35,
      signal,
      custom: customAI,
    });

    const analyticsData: LamPluginAnalyticsData = {
      ...parsedAnalytics,
      summaryMetrics: pId === "mistake-pattern-tracker" && stats
        ? [
            { label: "Quiz Mistakes", value: String(stats.quizMistakeCount ?? 0) },
            { label: "Past Papers", value: String(stats.ppMistakeCount ?? 0) },
            { label: "Open Doubts", value: String(stats.openDoubtCount ?? 0) },
          ]
        : undefined,
    };

    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "analytics",
      analyticsData,
    };
    const res = {
      content: `Completed **${plugin.name}** diagnosis:`,
      execution,
    };
    emit({ type: "result", ...res });
    return res;
  }

  // ==========================================================================
  // 14. DOCUMENT / PDF ARTIFACT PLUGINS (PDF Generator, Chapter Summarizer, Chapter Builder)
  // ==========================================================================
  if (outputType === "pdf") {
    emit({
      type: "status",
      status: "generating",
      progressStage: `Writing full structured document with ${plugin.name}...`,
    });

    const personaId = pId === "chapter-summarizer" ? "default" : "chapter-builder";
    const sys = buildSystemPrompt({
      persona: personaId,
      mode: pId === "chapter-summarizer" ? "summary" : "lesson",
      scholarClass: input.scholarClass,
      jeeMode: input.jeeMode,
    });

    const instructionsByTool =
      pId === "chapter-summarizer"
        ? `Create a comprehensive CBSE Class ${input.scholarClass} Chapter Summary with "## " headings:
## Executive Overview
## Key Definitions & Laws
## Core Formulas & Rules
## High-Yield Exam Distinctions
## 5-Point Revision Checklist`
        : pId === "chapter-builder"
          ? `Build a complete Class ${input.scholarClass} CBSE Study Unit with "## " headings:
## Learning Outcomes
## Simplified Concept Explanation
## 5 Core Concepts & Definitions
## 3 Worked Examples
## 5 Practice Questions with Answers
## Common Mistakes & Memory Hook`
          : `Create a publication-grade study document for Class ${input.scholarClass} CBSE with clear "## " section headings, bold key terms, valid LaTeX ($...$ and $$...$$), worked examples, and a quick revision summary.`;

    const fullMarkdown = await runTextOrStream({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `${instructionsByTool}\n\n${sharedContext}` },
      ],
      temperature: 0.45,
      signal,
      custom: customAI,
      onDelta: (chunk) => emit({ type: "delta", value: chunk }),
    });

    const titleLine =
      fullMarkdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
      (input.prompt && input.prompt.length < 75 ? input.prompt : `${chapter} — Study Document`);
    const sections = parseMarkdownSections(fullMarkdown, titleLine);

    const execution: LamPluginExecution = {
      ...makeBaseExecution(),
      status: "completed",
      outputType: "pdf",
      pdfData: {
        title: titleLine,
        subtitle: `Class ${input.scholarClass} CBSE · ${subject} · ${plugin.name}`,
        scholarClass: input.scholarClass,
        fullMarkdown,
        sections,
      },
    };
    const res = {
      content: `Generated **${titleLine}** (${sections.length} sections, ${fullMarkdown.length.toLocaleString()} chars). Preview the full document, download as PDF, save to Resources, or chain directly into a Quiz / Flashcards:`,
      execution,
    };
    emit({ type: "result", ...res });
    return res;
  }

  // ==========================================================================
  // 15. COMPANION / BRIEFING / LIFE SAVER (Daily Briefing, Life Saver, Study Companion)
  // ==========================================================================
  emit({
    type: "status",
    status: "generating",
    progressStage: `Generating response with ${plugin.name}...`,
  });

  const personaId =
    pId === "daily-briefing"
      ? "daily-briefing"
      : pId === "life-saver"
        ? "life-saver"
        : pId === "study-companion"
          ? "study-companion"
          : "default";

  const sys = buildSystemPrompt({
    persona: personaId,
    mode: "chat",
    scholarClass: input.scholarClass,
    jeeMode: input.jeeMode,
  });

  let promptPrefix = "";
  let metrics: Array<{ label: string; value: string }> | undefined;
  let suggestedFocusMinutes: number | undefined;

  if (pId === "daily-briefing") {
    const st = input.clientStats;
    const dueTitles = st?.dueTaskTitles?.length ? ` Due tasks: ${st.dueTaskTitles.join("; ")}.` : "";
    metrics = [
      { label: "Streak", value: `${st?.streak ?? 0}d` },
      { label: "XP", value: `${st?.xp ?? 0}` },
      { label: "Avg Mastery", value: `${st?.masteryAvg ?? 0}%` },
      { label: "Due Tasks", value: `${st?.dueTasks ?? 0}` },
    ];
    promptPrefix = `Give a crisp 4-part morning study briefing grounded strictly in these real metrics (XP: ${st?.xp ?? 0}, Streak: ${st?.streak ?? 0}, Avg Mastery: ${st?.masteryAvg ?? 0}%, Weakest: ${st?.weakestSubject ?? "N/A"}, Due Tasks: ${st?.dueTasks ?? 0}.${dueTitles}). Do NOT output a markdown pipe table; start directly with:\n1. **Today's Focus**\n2. **3 Quick Wins**\n3. **Watch Out**\n4. **Encouragement**\n`;
  } else if (pId === "life-saver") {
    suggestedFocusMinutes = 15;
    promptPrefix = `Respond calmly in 3 concise sections under 150 words:\n1. **Breathe** — calm non-preachy acknowledgement\n2. **Do this now** — one immediate concrete step\n3. **3-step plan** — three small doable steps in order\n`;
  }

  const markdown = await runTextOrStream({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: `${promptPrefix}${sharedContext}` },
    ],
    temperature: pId === "study-companion" ? 0.65 : 0.45,
    signal,
    custom: customAI,
    onDelta: (chunk) => emit({ type: "delta", value: chunk }),
  });

  const companionData: LamPluginCompanionData = {
    title: plugin.name,
    metrics,
    markdown,
    suggestedFocusMinutes,
    canReadAloud: true,
  };

  const execution: LamPluginExecution = {
    ...makeBaseExecution(),
    status: "completed",
    outputType: "companion",
    companionData,
  };
  const finalResult = { content: markdown, execution };
  emit({ type: "result", ...finalResult });
  return finalResult;
}

export function listAllPluginIds(): string[] {
  return availablePlugins().map((p) => p.id);
}
