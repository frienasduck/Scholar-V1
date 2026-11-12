"use client";

import { consumeSSEChunk } from "@/lib/ai/sse";
import { saveArtifactMedia } from "@/lib/lam/artifact-store";
import type { LamAttachment } from "@/lib/lam/attachments";
import type { LamPlugin } from "@/lib/lam/plugin-registry";
import {
  checkPluginMissingInput,
  detectPluginFollowUp,
  extractConversationalPluginContext,
  isPluginPlus,
  parseMarkdownSections,
  pluginPlusRequirement,
  resolvePluginOutputType,
} from "@/lib/lam/plugin-prompts";
import type {
  LamMessage,
  LamPageContext,
  LamPluginExecution,
} from "@/lib/lam/types";
import { profileGetJSON } from "@/lib/profile-storage";
import { PHYSICS_PAST_PAPERS } from "@/lib/question-bank";
import { loadQuizMistakes } from "@/lib/quiz-mistakes";
import { CURRICULUM } from "@/lib/curriculum";
import { CURRICULUM_CLASS11 } from "@/lib/curriculum-class11";
import { useStore } from "@/lib/store";

export {
  checkPluginMissingInput,
  detectPluginFollowUp,
  extractConversationalPluginContext,
  isPluginPlus,
  parseMarkdownSections,
  pluginPlusRequirement,
  resolvePluginOutputType,
};

export class PluginExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PluginExecutionError";
  }
}

export interface ExecutePluginParams {
  executionId: string;
  plugin: LamPlugin;
  prompt: string;
  conversationHistory: LamMessage[];
  pageContext: LamPageContext;
  attachments?: LamAttachment[];
  scholarClass: 9 | 11;
  jeeMode: boolean;
  isFollowUp?: boolean;
  signal: AbortSignal;
  onStatus?: (update: {
    status: "queued" | "preparing" | "running" | "generating";
    progressStage: string;
    currentStep?: number;
    totalSteps?: number;
  }) => void;
  onDelta?: (chunk: string, full: string) => void;
}

function collectClientStats(pluginId: string, scholarClass: 9 | 11) {
  const store = useStore.getState();
  const masteryEntries = Object.entries(store.mastery ?? {});
  const masteryAvg = masteryEntries.length
    ? Math.round(masteryEntries.reduce((s, [, v]) => s + v, 0) / masteryEntries.length)
    : 0;
  const weakest = masteryEntries.length
    ? [...masteryEntries].sort((a, b) => a[1] - b[1])[0]
    : null;
  const dueTasksList = (store.tasks ?? []).filter(
    (t) => !t.done && new Date(t.date).getTime() <= Date.now() + 86_400_000,
  );

  const curriculum = scholarClass === 11 ? CURRICULUM_CLASS11 : CURRICULUM;
  const studiedChapters = Object.entries(store.studyProgress ?? {})
    .filter(([, p]) => p > 0)
    .map(([chapterId, progress]) => {
      const subj = curriculum.find((s) => s.chapters.some((c) => c.id === chapterId));
      const ch = subj?.chapters.find((c) => c.id === chapterId);
      return {
        name: ch ? `${subj?.name ?? ""}: ${ch.title}` : chapterId,
        progress: Math.max(0, Math.min(100, Math.round(progress))),
      };
    })
    .slice(0, 18);

  const quizMistakes = loadQuizMistakes(scholarClass);
  const ppMistakes = profileGetJSON<Array<{ question?: string; chapter?: string; subject?: string }>>(
    scholarClass,
    "pp-mistakes",
    [],
  );
  const doubts = profileGetJSON<Array<{ question?: string; subject?: string; status?: string }>>(
    scholarClass,
    "doubt-history",
    [],
  );

  const mistakeSamples = [
    ...quizMistakes.slice(0, 8).map((m) => `[Quiz · ${m.subject} · ${m.chapter}] ${m.question} (Picked: ${m.userAnswer}; Correct: ${m.correctAnswer})`),
    ...ppMistakes.slice(0, 6).map((m) => `[Past Paper · ${m.subject ?? "Physics"} · ${m.chapter ?? ""}] ${m.question ?? ""}`),
    ...doubts.slice(0, 6).map((d) => `[Doubt · ${d.subject ?? "General"}] ${d.question ?? ""}`),
  ];

  if (
    pluginId === "daily-briefing" ||
    pluginId === "academic-coach" ||
    pluginId === "memory-predictor" ||
    pluginId === "mistake-pattern-tracker" ||
    pluginId === "mistake-analyzer"
  ) {
    return {
      xp: store.xp ?? 0,
      streak: store.streak ?? 0,
      masteryAvg,
      weakestSubject: weakest?.[0],
      weakestPercent: weakest?.[1],
      dueTasks: dueTasksList.length,
      dueTaskTitles: dueTasksList.slice(0, 5).map((t) => t.title),
      studiedChapters,
      quizMistakeCount: quizMistakes.length,
      ppMistakeCount: ppMistakes.length,
      openDoubtCount: doubts.filter((d) => d.status !== "resolved").length,
      mistakeSamples,
    };
  }

  return undefined;
}

/**
 * Unified execution and dispatch engine for all 23 LAM AI plugins.
 * Calls the authoritative server route `/api/lam/plugins/execute` with live SSE streaming
 * and never silently falls back to fake or hardcoded responses.
 */
export async function executePluginInChatSystem({
  executionId,
  plugin,
  prompt,
  conversationHistory,
  pageContext,
  attachments = [],
  scholarClass,
  jeeMode,
  isFollowUp: followUpHint,
  signal,
  onStatus,
  onDelta,
}: ExecutePluginParams): Promise<{ content: string; execution: LamPluginExecution }> {
  const userPrompt = prompt.trim();
  const readableAttachments = attachments.filter((a) => a.kind !== "image");
  const imageAttachment = attachments.find((a) => a.kind === "image" && a.dataUrl);
  const clientStats = collectClientStats(plugin.id, scholarClass);

  // If user didn't paste a PYQ for PYQ Solver, surface real past paper suggestions or solve the first requested paper
  let effectivePrompt = userPrompt;
  if (plugin.id === "pyq-solver" && !userPrompt && !readableAttachments.length) {
    const sample = PHYSICS_PAST_PAPERS[0];
    if (sample) {
      effectivePrompt = `${sample.source} ${sample.year} (${sample.marks}M): ${sample.question}`;
    }
  }

  // Multi-turn conversational follow-up extraction (only when explicitly refining or referencing prior output)
  const extracted = extractConversationalPluginContext(plugin.id, conversationHistory);
  const isFollowUp = Boolean(
    followUpHint === true ||
      (followUpHint !== false &&
        extracted.isFollowUp &&
        /\b(it|this|that|them|these|those|harder|easier|simpler|shorter|more|less|add|same|above)\b/i.test(effectivePrompt)),
  );
  const contextSummary = isFollowUp ? extracted.contextSummary : "";

  // Check if required inputs are missing before making a server call
  const missingCheck = checkPluginMissingInput(
    plugin,
    effectivePrompt,
    readableAttachments.length > 0,
    Boolean(imageAttachment),
    isFollowUp,
    {
      subjectTitle: pageContext.subjectTitle,
      chapterTitle: pageContext.chapterTitle,
      recordedMistakeCount: clientStats?.mistakeSamples?.length ?? 0,
      studiedChapterCount: clientStats?.studiedChapters?.length ?? 0,
    },
  );

  if (missingCheck.missing) {
    return {
      content: missingCheck.waitingMessage || `Tell me what you'd like ${plugin.name} to work on:`,
      execution: {
        executionId,
        pluginId: plugin.id,
        pluginName: plugin.name,
        category: plugin.category,
        rawPrompt: effectivePrompt,
        scholarClass,
        isPlus: isPluginPlus(plugin),
        status: "waiting_input",
        waitingInputPrompt: missingCheck.waitingMessage,
        waitingInputSuggestions: missingCheck.suggestions,
        requiresImage: missingCheck.requiresImage,
        outputType: resolvePluginOutputType(plugin.id),
      },
    };
  }

  onStatus?.({
    status: "preparing",
    progressStage: `Validating ${plugin.name} request...`,
  });

  const attachmentText = readableAttachments.length
    ? readableAttachments
        .map((a) => `--- ${a.name}${a.pages ? ` (${a.pages}p)` : ""} ---\n${a.excerpt}`)
        .join("\n\n")
        .slice(0, 7_800)
    : undefined;

  let imageUpload:
    | { fileName: string; mimeType: "image/png" | "image/jpeg" | "image/webp"; base64Data: string }
    | undefined;
  if (imageAttachment?.dataUrl) {
    const match = imageAttachment.dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i);
    if (match) {
      imageUpload = {
        fileName: imageAttachment.name,
        mimeType: match[1].toLowerCase() as "image/png" | "image/jpeg" | "image/webp",
        base64Data: match[2],
      };
    }
  }

  const response = await fetch("/api/lam/plugins/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      executionId,
      pluginId: plugin.id,
      prompt: effectivePrompt,
      scholarClass,
      jeeMode,
      subjectTitle: pageContext.subjectTitle,
      chapterTitle: pageContext.chapterTitle,
      conversationContext: contextSummary || undefined,
      isFollowUp,
      attachmentText,
      attachmentNames: attachments.map((a) => a.name).slice(0, 6),
      imageUpload,
      clientStats,
    }),
  });

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!response.ok || !response.body || !contentType.includes("text/event-stream")) {
    const envelope = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string } | string;
    } | null;
    const code =
      envelope && typeof envelope.error === "object" && envelope.error?.code
        ? envelope.error.code
        : response.status === 403
          ? "PLUS_REQUIRED"
          : response.status === 401
            ? "AUTH_REQUIRED"
            : "PLUGIN_REQUEST_FAILED";
    const msg =
      typeof envelope?.error === "string"
        ? envelope.error
        : envelope?.error && typeof envelope.error === "object" && envelope.error.message
          ? envelope.error.message
          : code === "PLUS_REQUIRED"
            ? `${plugin.name} requires Scholar Plus.`
            : code === "AUTH_REQUIRED"
              ? "Sign in to execute LAM AI plugins."
              : `Plugin request failed (HTTP ${response.status}).`;

    if (response.status === 403 && code === "PLUS_REQUIRED") {
      return {
        content: `**${plugin.name}** is a Scholar Plus tool. Upgrade below to unlock it inside chat without leaving your conversation:`,
        execution: {
          executionId,
          pluginId: plugin.id,
          pluginName: plugin.name,
          category: plugin.category,
          rawPrompt: effectivePrompt,
          scholarClass,
          isPlus: true,
          status: "locked",
          outputType: resolvePluginOutputType(plugin.id),
        },
      };
    }

    throw new PluginExecutionError(msg, code, response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamedText = "";
  let finalResult: { content: string; execution: LamPluginExecution } | null = null;

  try {
    while (true) {
      const chunk = await reader.read();
      const parsed = consumeSSEChunk(
        buffer,
        chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true }),
        { flush: chunk.done },
      );
      buffer = parsed.buffer;

      for (const rawEvent of parsed.events) {
        let evt: {
          type?: string;
          status?: "queued" | "preparing" | "running" | "generating";
          progressStage?: string;
          currentStep?: number;
          totalSteps?: number;
          value?: string;
          content?: string;
          execution?: LamPluginExecution;
          code?: string;
          message?: string;
        };
        try {
          evt = JSON.parse(rawEvent) as typeof evt;
        } catch {
          throw new PluginExecutionError("Received malformed plugin stream event.", "INVALID_STREAM", 502);
        }

        if (evt.type === "status" && evt.status) {
          onStatus?.({
            status: evt.status,
            progressStage: evt.progressStage || `Running ${plugin.name}...`,
            currentStep: evt.currentStep,
            totalSteps: evt.totalSteps,
          });
        } else if (evt.type === "delta" && typeof evt.value === "string") {
          streamedText += evt.value;
          onDelta?.(evt.value, streamedText);
        } else if (evt.type === "error") {
          if (evt.code === "PLUS_REQUIRED") {
            return {
              content: `**${plugin.name}** is a Scholar Plus tool.`,
              execution: {
                executionId,
                pluginId: plugin.id,
                pluginName: plugin.name,
                category: plugin.category,
                rawPrompt: effectivePrompt,
                scholarClass,
                isPlus: true,
                status: "locked",
                outputType: resolvePluginOutputType(plugin.id),
              },
            };
          }
          throw new PluginExecutionError(
            evt.message || "Plugin execution failed.",
            evt.code || "PLUGIN_ERROR",
            500,
          );
        } else if (evt.type === "result" && evt.execution) {
          finalResult = {
            content: evt.content || streamedText || `Completed **${plugin.name}**.`,
            execution: evt.execution,
          };
        }
      }
      if (chunk.done) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }

  if (!finalResult) {
    throw new PluginExecutionError(
      "Connection finished before the plugin returned its output. Please retry.",
      "STREAM_INCOMPLETE",
      502,
    );
  }

  // Persist large binary image data to IndexedDB so it survives full page reloads cleanly
  if (finalResult.execution.imageData?.artifactId && finalResult.execution.imageData.url) {
    await saveArtifactMedia(
      finalResult.execution.imageData.artifactId,
      finalResult.execution.imageData.url,
    ).catch(() => undefined);
  }

  // Side effects: XP & history updates matching existing page tools
  const store = useStore.getState();
  if (plugin.id === "aisig") {
    store.addXP(5);
    store.addCoins(3);
    store.pushActivity({
      type: "aisig",
      text: `Generated image in chat: ${effectivePrompt.slice(0, 30)}`,
      icon: "🎨",
    });
  } else if (plugin.id === "ai-pdf-studio") {
    store.addXP(5);
    store.pushActivity({
      type: "ai",
      text: `Generated PDF in chat: ${(finalResult.execution.pdfData?.title || effectivePrompt).slice(0, 35)}`,
      icon: "📄",
    });
  }

  return finalResult;
}

/**
 * Builds clean textual input when chaining one plugin's completed output directly
 * into another plugin inside the same LAM AI conversation.
 */
export function buildPluginChainSeed(execution: LamPluginExecution): {
  title: string;
  bodyText: string;
} {
  if (execution.pdfData) {
    const body =
      execution.pdfData.fullMarkdown ||
      execution.pdfData.sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");
    return { title: execution.pdfData.title, bodyText: body.slice(0, 3_600) };
  }
  if (execution.explainerData) {
    const e = execution.explainerData;
    return {
      title: e.concept,
      bodyText: `# ${e.concept}\nIntuition: ${e.intuition}\nDefinition: ${e.definition}\nDerivation: ${e.derivation ?? ""}\nExample: ${e.workedExample ?? ""}\nMistakes: ${e.mistakes.join("; ")}`.slice(0, 3_600),
    };
  }
  if (execution.formulas?.length) {
    return {
      title: execution.pluginName,
      bodyText: execution.formulas
        .map((f) => `- ${f.name}: ${f.formula} (${f.units})${f.condition ? ` — ${f.condition}` : ""}`)
        .join("\n")
        .slice(0, 3_600),
    };
  }
  if (execution.flowchartData) {
    return {
      title: execution.flowchartData.title,
      bodyText: execution.flowchartData.steps
        .map((s) => `${s.stepNumber}. ${s.title}: ${s.description}${s.keyRule ? ` [${s.keyRule}]` : ""}`)
        .join("\n")
        .slice(0, 3_600),
    };
  }
  if (execution.homeworkData) {
    return {
      title: execution.homeworkData.fileName || "Scanned Question",
      bodyText: `Question:\n${execution.homeworkData.ocrText}\n\nSolution:\n${execution.homeworkData.solution}`.slice(0, 3_600),
    };
  }
  if (execution.pyqData) {
    return {
      title: execution.pyqData.yearExam,
      bodyText: `Question: ${execution.pyqData.question}\n` +
        execution.pyqData.markingSteps.map((s) => `${s.title} (${s.marks}): ${s.content}`).join("\n"),
    };
  }
  if (execution.companionData) {
    return { title: execution.companionData.title, bodyText: execution.companionData.markdown.slice(0, 3_600) };
  }
  if (execution.analyticsData) {
    return {
      title: execution.analyticsData.title,
      bodyText: `${execution.analyticsData.diagnosisMarkdown || ""}\nRecommendation: ${execution.analyticsData.recommendation}`.slice(0, 3_600),
    };
  }
  return { title: execution.pluginName, bodyText: execution.rawPrompt || "" };
}

/**
 * Saves an artifact directly to Scholar Resources (`/api/resources`) when signed in,
 * with honest status reporting and safe local Files fallback when unauthenticated.
 */
export async function saveArtifactToResources(params: {
  title: string;
  text: string;
  scholarClass: 9 | 11;
}): Promise<{ destination: "resources" | "local-files"; message: string }> {
  const cleanTitle = params.title.trim().slice(0, 175) || "LAM AI Study Material";
  const cleanText = params.text.trim();
  const boundedText = cleanText.length >= 40 ? cleanText : `${cleanTitle}\n\n${cleanText}`.padEnd(45, " ");

  try {
    const res = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cleanTitle,
        text: boundedText,
        grade: params.scholarClass,
      }),
    });

    if (res.ok) {
      return {
        destination: "resources",
        message: "Saved to your Scholar Resources library.",
      };
    }

    if (res.status === 401) {
      const blob = new Blob([boundedText], { type: "text/markdown" });
      const dataUrl = `data:text/markdown;base64,${btoa(unescape(encodeURIComponent(boundedText)))}`;
      useStore.getState().addFile({
        name: `${cleanTitle.slice(0, 40)}.md`,
        type: "markdown",
        size: blob.size,
        dataUrl,
        tags: ["lam-ai", "resource-draft"],
      });
      return {
        destination: "local-files",
        message: "Saved locally to Scholar Files (sign in to sync directly to cloud Resources).",
      };
    }

    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message || `Could not save to Resources (HTTP ${res.status}).`);
  } catch (error) {
    if (error instanceof TypeError) {
      const blob = new Blob([boundedText], { type: "text/markdown" });
      const dataUrl = `data:text/markdown;base64,${btoa(unescape(encodeURIComponent(boundedText)))}`;
      useStore.getState().addFile({
        name: `${cleanTitle.slice(0, 40)}.md`,
        type: "markdown",
        size: blob.size,
        dataUrl,
        tags: ["lam-ai", "offline-draft"],
      });
      return {
        destination: "local-files",
        message: "Saved locally to Files (network unavailable for cloud Resources).",
      };
    }
    throw error;
  }
}
