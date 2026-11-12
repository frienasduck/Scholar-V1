import type { LamPlugin } from "@/lib/lam/plugin-registry";
import type {
  LamMessage,
  LamPluginOutputType,
} from "@/lib/lam/types";

export type PluginEntitlementRequirement =
  | "aisig"
  | "homework_scanner"
  | "slideshow_generation_plus"
  | null;

export function pluginPlusRequirement(pluginId: string): PluginEntitlementRequirement {
  switch (pluginId) {
    case "aisig":
      return "aisig";
    case "homework-scanner":
      return "homework_scanner";
    case "slideshow-maker":
      return "slideshow_generation_plus";
    default:
      return null;
  }
}

export function isPluginPlus(plugin: Pick<LamPlugin, "id" | "entitlement" | "plus">): boolean {
  return Boolean(plugin.entitlement || plugin.plus || pluginPlusRequirement(plugin.id));
}

/**
 * Resolves the native, specialized output interface for every registered plugin ID.
 */
export function resolvePluginOutputType(pluginId: string): LamPluginOutputType {
  const id = pluginId.toLowerCase();
  if (id === "notes-to-quiz") return "quiz";
  if (id === "ncert-question-generator") return "ncert-set";
  if (id === "flashcard-maker" || id.includes("flashcard")) return "flashcards";
  if (id === "slideshow-maker" || id.includes("slideshow")) return "slideshow";
  if (id === "formula-sheet-generator" || id.includes("formula")) return "formula-sheet";
  if (id === "ai-pdf-studio" || id === "chapter-summarizer" || id === "chapter-builder") return "pdf";
  if (id === "concept-explainer") return "explainer";
  if (id === "aisig") return "image";
  if (id === "homework-scanner") return "homework";
  if (id === "answer-evaluator") return "evaluator";
  if (id === "revision-planner" || id === "academic-coach" || id === "one-night-exam") return "planner";
  if (id === "diagram-flowchart-builder") return "flowchart";
  if (id === "mistake-analyzer" || id === "mistake-pattern-tracker" || id === "memory-predictor") return "analytics";
  if (id === "pyq-solver") return "pyq";
  if (id === "daily-briefing" || id === "life-saver" || id === "study-companion") return "companion";
  return "generic";
}

/**
 * Splits a Markdown document by `##` / `#` headings into clean structural sections
 * without ever slicing mid-sentence or dropping trailing content.
 */
export function parseMarkdownSections(
  markdown: string,
  fallbackTitle = "Study Document",
): Array<{ heading: string; body: string }> {
  const clean = markdown.trim();
  if (!clean) return [{ heading: fallbackTitle, body: "" }];

  const lines = clean.split(/\r?\n/);
  const sections: Array<{ heading: string; body: string }> = [];
  let currentHeading = "Overview";
  let currentBody: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (headingMatch) {
      const joined = currentBody.join("\n").trim();
      if (joined) {
        sections.push({ heading: currentHeading, body: joined });
      }
      currentHeading = headingMatch[2].replace(/\*\*/g, "").trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  const trailing = currentBody.join("\n").trim();
  if (trailing) {
    sections.push({ heading: currentHeading, body: trailing });
  }

  if (!sections.length) {
    return [{ heading: fallbackTitle, body: clean }];
  }

  return sections;
}

/**
 * Checks recent messages to extract previous plugin execution context for
 * multi-turn conversational refinements across ALL output types.
 */
export function extractConversationalPluginContext(
  pluginId: string,
  history: LamMessage[],
): { isFollowUp: boolean; contextSummary: string; previousAttachmentNames: string[] } {
  if (!history.length) {
    return { isFollowUp: false, contextSummary: "", previousAttachmentNames: [] };
  }

  const lastAssistant = [...history].reverse().find(
    (msg) =>
      msg.role === "assistant" &&
      (msg.pluginExecution?.status === "completed" || msg.pluginExecution?.status === "ready") &&
      msg.pluginExecution.pluginId === pluginId,
  );

  if (!lastAssistant?.pluginExecution) {
    return { isFollowUp: false, contextSummary: "", previousAttachmentNames: [] };
  }

  const prevExec = lastAssistant.pluginExecution;
  let summary = `PREVIOUS PLUGIN EXECUTION (${prevExec.pluginName}, id=${prevExec.pluginId}):\n`;
  if (prevExec.rawPrompt) {
    summary += `Previous prompt: ${prevExec.rawPrompt.slice(0, 600)}\n`;
  }

  if (prevExec.quiz?.length) {
    summary += `Previous Quiz Questions:\n${JSON.stringify(prevExec.quiz, null, 2).slice(0, 4500)}\n`;
  } else if (prevExec.ncertData?.items?.length) {
    summary += `Previous NCERT Questions:\n${JSON.stringify(prevExec.ncertData, null, 2).slice(0, 4500)}\n`;
  } else if (prevExec.flashcards?.length) {
    summary += `Previous Flashcards:\n${JSON.stringify(prevExec.flashcards, null, 2).slice(0, 4500)}\n`;
  } else if (prevExec.slideshowData?.slides?.length || prevExec.slides?.length) {
    const deck = prevExec.slideshowData ?? { title: prevExec.pluginName, slides: prevExec.slides };
    summary += `Previous Slideshow:\n${JSON.stringify(deck, null, 2).slice(0, 4500)}\n`;
  } else if (prevExec.formulas?.length) {
    summary += `Previous Formulas:\n${JSON.stringify(prevExec.formulas, null, 2).slice(0, 4500)}\n`;
  } else if (prevExec.pdfData?.fullMarkdown) {
    summary += `Previous PDF Document (${prevExec.pdfData.title}):\n${prevExec.pdfData.fullMarkdown.slice(0, 4500)}\n`;
  } else if (prevExec.pdfData?.sections?.length) {
    summary += `Previous PDF Document (${prevExec.pdfData.title}):\n${prevExec.pdfData.sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n").slice(0, 4500)}\n`;
  } else if (prevExec.explainerData) {
    summary += `Previous Concept Explainer:\n${JSON.stringify(prevExec.explainerData, null, 2).slice(0, 3500)}\n`;
  } else if (prevExec.evaluatorData) {
    summary += `Previous Answer Evaluation:\n${JSON.stringify(prevExec.evaluatorData, null, 2).slice(0, 3500)}\n`;
  } else if (prevExec.plannerData) {
    summary += `Previous Study Plan:\n${JSON.stringify(prevExec.plannerData, null, 2).slice(0, 3500)}\n`;
  } else if (prevExec.flowchartData) {
    summary += `Previous Flowchart:\n${JSON.stringify(prevExec.flowchartData, null, 2).slice(0, 3500)}\n`;
  } else if (prevExec.pyqData) {
    summary += `Previous PYQ Solution:\n${JSON.stringify(prevExec.pyqData, null, 2).slice(0, 3500)}\n`;
  } else if (prevExec.analyticsData) {
    summary += `Previous Analytics:\n${JSON.stringify(prevExec.analyticsData, null, 2).slice(0, 3500)}\n`;
  } else if (prevExec.homeworkData) {
    summary += `Previous Homework OCR & Solution:\nOCR Text: ${prevExec.homeworkData.ocrText}\nHint: ${prevExec.homeworkData.hint}\nSolution: ${prevExec.homeworkData.solution.slice(0, 2000)}\n`;
  } else if (prevExec.imageData) {
    summary += `Previous Image Prompt: ${prevExec.imageData.prompt}\nEnhanced Prompt: ${prevExec.imageData.enhancedPrompt ?? ""}\nAspect Ratio: ${prevExec.imageData.aspectRatio ?? "1:1"}\n`;
  } else if (prevExec.companionData) {
    summary += `Previous Output:\n${prevExec.companionData.markdown.slice(0, 3000)}\n`;
  } else if (lastAssistant.content) {
    summary += `Previous Output:\n${lastAssistant.content.slice(0, 3000)}\n`;
  }

  return {
    isFollowUp: true,
    contextSummary: summary,
    previousAttachmentNames: prevExec.attachmentNames ?? [],
  };
}

/**
 * Determines whether a natural follow-up message in conversation intends to refine
 * or respond to the most recent plugin turn rather than start an unrelated normal chat turn.
 */
export function detectPluginFollowUp(
  rawMessage: string,
  history: LamMessage[],
): { shouldContinue: boolean; pluginId?: string; reason?: string } {
  const msg = rawMessage.trim();
  if (!msg || msg.startsWith("/") || msg.includes("@")) {
    return { shouldContinue: false };
  }

  const lastMessage = history.at(-1);
  if (!lastMessage || lastMessage.role !== "assistant" || !lastMessage.pluginExecution) {
    return { shouldContinue: false };
  }

  const exec = lastMessage.pluginExecution;
  // If the last plugin explicitly requested missing input (e.g. Answer Evaluator asked for answer,
  // Life Saver asked what's stressing them, PYQ Solver asked for the question), keep the turn in that plugin.
  if (exec.status === "waiting_input") {
    return { shouldContinue: true, pluginId: exec.pluginId, reason: "answering_waiting_input" };
  }

  if (exec.status !== "completed" && exec.status !== "ready") {
    return { shouldContinue: false };
  }

  // Only route cleanly identifiable refinements / pronoun references back into the active plugin.
  // Unrelated fresh questions (e.g., "What is photosynthesis?") must stay normal chat.
  const refinementPatterns = [
    /\b(?:make|keep|turn)\s+(?:it|this|that|them|these|those|the\s+(?:remaining|questions?|cards?|slides?|notes?|formulas?|plan|pdf|diagram|image|steps?))\b/i,
    /\b(?:remaining|above|previous|last)\s+(?:questions?|cards?|slides?|sections?|examples?|steps?|notes?|formulas?)\b/i,
    /\b(?:harder|easier|simpler|shorter|longer|more\s+detailed|more\s+challenging|less\s+dense|board-level|jee-level)\b/i,
    /\b(?:add|include|append|insert|remove|replace|change|update|modify|expand|shorten|simplify|regenerate|redo|retry)\s+(?:\d+\s+|more\s+|another\s+|some\s+|the\s+|this\s+|it\s+)/i,
    /\b(?:add|include)\s+\d+\s+(?:more\s+)?(?:numericals?|examples?|questions?|cards?|slides?|mcqs?|problems?|diagrams?|steps?)\b/i,
    /\b(?:question|q\.?|card|slide|step|formula)\s*#?\d+\b/i,
    /\bexplain\s+(?:this|that|step\s*\d+|question\s*\d+|q\s*\d+|the\s+above)\b/i,
    /\bconvert\s+(?:this|it|these|them)\s+(?:to|into)\b/i,
    /^(?:more|harder|easier|shorter|longer|simpler|explain more|add examples|add numericals|regenerate)\.?$/i,
  ];

  if (refinementPatterns.some((pattern) => pattern.test(msg))) {
    return { shouldContinue: true, pluginId: exec.pluginId, reason: "refinement_phrase" };
  }

  // Interactive Study Companion continues naturally while directly replying to companion
  if (exec.pluginId === "study-companion" && !/^(?:exit|back to chat|switch|new topic)\b/i.test(msg)) {
    return { shouldContinue: true, pluginId: exec.pluginId, reason: "companion_dialogue" };
  }

  return { shouldContinue: false };
}

/**
 * Validates whether required user inputs exist before firing an AI call, returning a
 * friendly in-chat waiting_input prompt when necessary (never wasting tokens or faking outputs).
 */
export function checkPluginMissingInput(
  plugin: LamPlugin,
  prompt: string,
  hasReadableAttachment: boolean,
  hasImageAttachment: boolean,
  isFollowUp: boolean,
  context: {
    subjectTitle?: string;
    chapterTitle?: string;
    recordedMistakeCount?: number;
    studiedChapterCount?: number;
  },
): {
  missing: boolean;
  waitingMessage?: string;
  suggestions?: string[];
  requiresImage?: boolean;
} {
  if (isFollowUp) return { missing: false };
  const clean = prompt.trim();

  if (plugin.id === "homework-scanner") {
    if (!hasImageAttachment && clean.length < 12) {
      return {
        missing: true,
        requiresImage: true,
        waitingMessage:
          "Attach a clear PNG, JPEG, or WebP photo of your homework question (or paste the full question text) so Image Analysis can extract it with OCR and build a hint + step-by-step solution.",
        suggestions: [],
      };
    }
  }

  if (plugin.id === "answer-evaluator") {
    const looksLikeFullSubmission =
      hasReadableAttachment ||
      clean.length >= 45 ||
      (/\b(?:question|q:)/i.test(clean) && /\b(?:answer|ans:)/i.test(clean));
    if (!looksLikeFullSubmission) {
      return {
        missing: true,
        waitingMessage:
          "Paste the **exam question** along with **your written answer** (e.g. *Question: State Newton's 2nd law (3 marks). My answer: ...*) and I will grade it step-by-step using CBSE marking rubrics.",
        suggestions: [
          "Question: State and derive the work-energy theorem (3 marks). Answer: Work done by net force equals change in kinetic energy.",
        ],
      };
    }
  }

  if (plugin.id === "mistake-analyzer") {
    const hasHistory = (context.recordedMistakeCount ?? 0) > 0;
    if (!hasReadableAttachment && clean.length < 10 && !hasHistory) {
      return {
        missing: true,
        waitingMessage:
          "Tell me which question you got wrong or paste your incorrect solution (e.g. *I wrote $(a+b)^2 = a^2 + b^2$* or *My sign came out negative in lens formula*).",
        suggestions: [
          "Analyze: I used v = u + at for a non-uniform acceleration problem and got the wrong distance.",
          "Analyze: I mixed up endothermic and exothermic ΔH signs.",
        ],
      };
    }
  }

  if (plugin.id === "life-saver" && clean.length < 4) {
    return {
      missing: true,
      waitingMessage:
        "Take one breath — tell me briefly what's overwhelming you right now (or tap one below), and I'll give you one immediate next step.",
      suggestions: [
        "I have a Physics exam tomorrow and haven't revised derivations",
        "My backlog across Maths and Chemistry feels huge right now",
        "I can't focus at all today — help me restart in 10 minutes",
      ],
    };
  }

  if (plugin.id === "memory-predictor" && (context.studiedChapterCount ?? 0) === 0 && !clean) {
    return {
      missing: true,
      waitingMessage:
        "No chapter progress is recorded yet in your profile. Mark a chapter in Study or list the chapters you studied recently so I can prioritise your revision honestly without inventing retention percentages.",
      suggestions: [
        "Prioritise Laws of Motion and Atomic Structure studied 3 days ago",
      ],
    };
  }

  return { missing: false };
}
