import { describe, expect, test } from "bun:test";
import {
  SCHOLAR_WORKSPACES,
  resolveScholarDestination,
  searchScholarAliases,
} from "../src/lib/shrinking-scholar";
import {
  LAM_PLUGINS,
  availablePlugins,
  pluginById,
  plannedPlugins,
  searchLamPlugins,
} from "../src/lib/lam/plugin-registry";
import { composeLamMessage, formatAttachmentSize } from "../src/lib/lam/attachments";
import {
  checkPluginMissingInput,
  detectPluginFollowUp,
  extractConversationalPluginContext,
  parseMarkdownSections,
  resolvePluginOutputType,
} from "../src/lib/lam/plugin-prompts";
import type { LamMessage } from "../src/lib/lam/types";
import { isScholarRoute } from "../src/lib/routes";
import { NAV_ITEMS } from "../src/lib/nav";

describe("legacy destinations", () => {
  test("old view ids resolve to the merged workspace and mode", () => {
    const cases: Array<[string, string, string | undefined]> = [
      ["practice", "question-practice", "practice"],
      ["quiz", "question-practice", "quiz"],
      ["past-papers", "question-practice", "past-papers"],
      ["answer-lab", "doubt-lab", "solve"],
      ["doubt-history", "doubt-lab", "history"],
      ["lab", "experiment-lab", "experiments"],
      ["practicals", "experiment-lab", "practicals"],
      ["nigtube", "study-media", "lamtube"],
      ["lamtube", "study-media", "lamtube"],
      ["music", "study-media", "music"],
      ["live-tutor", "lam-ai", "chat"],
      ["ai-tutor", "lam-ai", "tutor"],
      ["ai-tools", "lam-ai", "plugins"],
      ["downloads", "resources", "downloads"],
    ];
    for (const [legacy, viewId, mode] of cases) {
      const destination = resolveScholarDestination({ viewId: legacy });
      expect(destination.viewId).toBe(viewId);
      expect(destination.mode).toBe(mode);
      expect(destination.legacy).toBe(true);
    }
  });

  test("Scholar Intelligence moves into Settings", () => {
    const destination = resolveScholarDestination({ viewId: "intelligence" });
    expect(destination.viewId).toBe("settings");
    expect(destination.settingsCategory).toBe("intelligence");
  });

  test("legacy and canonical routes remain valid", () => {
    for (const route of ["question-practice", "doubt-lab", "experiment-lab", "study-media", "lam-ai", "resources"]) {
      expect(isScholarRoute([route])).toBe(true);
    }
    for (const route of ["quiz", "practice", "past-papers", "answer-lab", "doubt-history", "nigtube", "music", "ai-tools", "ai-tutor", "downloads", "intelligence"]) {
      expect(isScholarRoute([route])).toBe(true);
    }
  });
});

describe("search aliases", () => {
  test("every required legacy term reaches the right merged mode", () => {
    const expected: Array<[string, string, string | undefined]> = [
      ["Question Practice", "question-practice", "practice"],
      ["Quiz", "question-practice", "quiz"],
      ["Quizzes", "question-practice", "quiz"],
      ["Past Papers", "question-practice", "past-papers"],
      ["PYQ", "question-practice", "past-papers"],
      ["Previous Year Questions", "question-practice", "past-papers"],
      ["Question Bank", "question-practice", "past-papers"],
      ["Answer Lab", "doubt-lab", "solve"],
      ["Doubt History", "doubt-lab", "history"],
      ["Doubt Lab", "doubt-lab", "history"],
      ["Solve a Doubt", "doubt-lab", "solve"],
      ["My Doubts", "doubt-lab", "history"],
      ["Practical Lab", "experiment-lab", "practicals"],
      ["Experimental Lab", "experiment-lab", "practicals"],
      ["Experimental Lab Plus", "experiment-lab", "practicals"],
      ["Experiment Lab", "experiment-lab", "experiments"],
      ["LAMTube", "study-media", "lamtube"],
      ["Study Music", "study-media", "music"],
      ["Study Media", "study-media", "lamtube"],
      ["AI Tutor", "lam-ai", "tutor"],
      ["AI Tools", "lam-ai", "plugins"],
      ["Downloads", "resources", "downloads"],
      ["My Downloads", "resources", "downloads"],
      ["Saved Files", "resources", "downloads"],
      ["Resources", "resources", "library"],
    ];
    for (const [query, viewId, mode] of expected) {
      const matches = searchScholarAliases(query);
      expect(matches.some((match) => match.viewId === viewId && match.mode === mode)).toBe(true);
    }
  });

  test("Scholar Intelligence alias opens Settings", () => {
    for (const query of ["Scholar Intelligence", "Personalization", "Learning Intelligence"]) {
      const matches = searchScholarAliases(query);
      expect(matches.some((match) => match.viewId === "settings" && match.settingsCategory === "intelligence")).toBe(true);
    }
  });

  test("AI Tools and academic plugin names deep-link to real plugins", () => {
    for (const [query, pluginId] of [
      ["PDF Generator", "ai-pdf-studio"],
      ["Mistake Analyzer", "mistake-analyzer"],
      ["Academic Coach", "academic-coach"],
      ["One Night Exam Prep", "one-night-exam"],
      ["Image Analysis", "homework-scanner"],
      ["AISIG", "aisig"],
      ["Slideshow Generator", "slideshow-maker"],
      ["Concept Explainer", "concept-explainer"],
      ["Chapter Summarizer", "chapter-summarizer"],
      ["Flashcard Maker", "flashcard-maker"],
      ["Formula Sheet Generator", "formula-sheet-generator"],
      ["Notes-to-Quiz", "notes-to-quiz"],
      ["Answer Evaluator", "answer-evaluator"],
      ["PYQ Solver", "pyq-solver"],
      ["NCERT Question Generator", "ncert-question-generator"],
      ["Mistake Pattern Tracker", "mistake-pattern-tracker"],
    ]) {
      const matches = searchScholarAliases(query, 15);
      const match = matches.find((item) => item.viewId === "lam-ai" && item.pluginId === pluginId);
      expect(Boolean(match)).toBe(true);
    }
  });
});

describe("LAM plugin registry", () => {
  test("only real tools are available and every available plugin has an adapter", () => {
    expect(availablePlugins().length).toBeGreaterThanOrEqual(23);
    for (const plugin of availablePlugins()) {
      expect(typeof plugin.toolId).toBe("string");
      expect(plugin.availability).toBe("available");
    }
    for (const plugin of plannedPlugins()) {
      expect(plugin.toolId).toBeUndefined();
    }
  });

  test("registry has no duplicate ids", () => {
    const ids = LAM_PLUGINS.map((plugin) => plugin.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("plus gates are preserved on the real Plus tools", () => {
    expect(pluginById("aisig")?.entitlement).toBe("aisig");
    expect(pluginById("homework-scanner")?.entitlement).toBe("homework_scanner");
    expect(pluginById("slideshow-maker")?.plus).toBe(true);
  });

  test("@ search matches names and aliases across existing and new academic plugins", () => {
    expect(searchLamPlugins("pdf generator")[0]?.id).toBe("ai-pdf-studio");
    expect(searchLamPlugins("mistake analyzer")[0]?.id).toBe("mistake-analyzer");
    expect(searchLamPlugins("slideshow generator")[0]?.id).toBe("slideshow-maker");
    expect(searchLamPlugins("one night exam prep")[0]?.id).toBe("one-night-exam");
    expect(searchLamPlugins("homework scan")[0]?.id).toBe("homework-scanner");
    expect(searchLamPlugins("image analysis")[0]?.id).toBe("homework-scanner");
    expect(searchLamPlugins("concept explainer")[0]?.id).toBe("concept-explainer");
    expect(searchLamPlugins("flashcard maker")[0]?.id).toBe("flashcard-maker");
    expect(searchLamPlugins("chapter summarizer")[0]?.id).toBe("chapter-summarizer");
    expect(searchLamPlugins("formula sheet")[0]?.id).toBe("formula-sheet-generator");
    expect(searchLamPlugins("notes-to-quiz")[0]?.id).toBe("notes-to-quiz");
    expect(searchLamPlugins("answer evaluator")[0]?.id).toBe("answer-evaluator");
    expect(searchLamPlugins("study planner")[0]?.id).toBe("revision-planner");
    expect(searchLamPlugins("flowchart builder")[0]?.id).toBe("diagram-flowchart-builder");
    expect(searchLamPlugins("pyq solver")[0]?.id).toBe("pyq-solver");
    expect(searchLamPlugins("ncert question generator")[0]?.id).toBe("ncert-question-generator");
    expect(searchLamPlugins("mistake pattern tracker")[0]?.id).toBe("mistake-pattern-tracker");
    expect(searchLamPlugins("zzzz-no-plugin")).toHaveLength(0);
  });
});

describe("LAM attachments", () => {
  test("formatAttachmentSize formats bytes, KB and MB cleanly", () => {
    expect(formatAttachmentSize(512)).toBe("512 B");
    expect(formatAttachmentSize(2048)).toBe("2.0 KB");
    expect(formatAttachmentSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  test("composeLamMessage attaches study material excerpt within character budget", () => {
    const composed = composeLamMessage("Summarise this chapter", [
      {
        id: "att-1",
        name: "kinematics.txt",
        kind: "text",
        size: 1200,
        chars: 48,
        excerpt: "Velocity is the rate of change of displacement.",
      },
    ]);
    expect(composed).toContain("Summarise this chapter");
    expect(composed).toContain("kinematics.txt");
    expect(composed).toContain("Velocity is the rate of change of displacement.");
    expect(composed.length).toBeLessThanOrEqual(4000);
  });
});

describe("navigation", () => {
  test("primary navigation contains exactly the merged learning destinations", () => {
    const ids = NAV_ITEMS.map((item) => item.id);
    for (const id of ["question-practice", "doubt-lab", "experiment-lab", "study-media", "lam-ai", "resources"]) {
      expect(ids).toContain(id);
    }
    for (const removed of ["quiz", "practice", "past-papers", "answer-lab", "doubt-history", "lab", "practicals", "nigtube", "music", "ai-tutor", "ai-tools", "intelligence", "downloads"]) {
      expect(ids).not.toContain(removed);
    }
  });

  test("workspace modes match the required structure", () => {
    expect(SCHOLAR_WORKSPACES["question-practice"].modes.map((mode) => mode.id)).toEqual(["practice", "quiz", "past-papers"]);
    expect(SCHOLAR_WORKSPACES["doubt-lab"].modes.map((mode) => mode.id)).toEqual(["history", "solve"]);
    expect(SCHOLAR_WORKSPACES["experiment-lab"].modes.map((mode) => mode.id)).toEqual(["experiments", "practicals"]);
    expect(SCHOLAR_WORKSPACES["study-media"].modes.map((mode) => mode.id)).toEqual(["lamtube", "music"]);
    expect(SCHOLAR_WORKSPACES["lam-ai"].modes.map((mode) => mode.id)).toEqual(["chat", "tutor", "plugins"]);
    expect(SCHOLAR_WORKSPACES["resources"].modes.map((mode) => mode.id)).toEqual(["library", "downloads"]);
  });
});

describe("In-Chat LAM Plugin Unified Execution", () => {
  test("every available plugin has a verified outputType and valid execution mapping", () => {
    const plugins = availablePlugins();
    expect(plugins.length).toBeGreaterThanOrEqual(23);

    const validOutputTypes = new Set([
      "quiz",
      "ncert-set",
      "flashcards",
      "slideshow",
      "formula-sheet",
      "pdf",
      "explainer",
      "image",
      "homework",
      "evaluator",
      "planner",
      "flowchart",
      "analytics",
      "pyq",
      "companion",
      "generic",
    ]);

    for (const plugin of plugins) {
      const outputType = resolvePluginOutputType(plugin.id);
      expect(validOutputTypes.has(outputType)).toBe(true);
      expect(typeof plugin.name).toBe("string");
      expect(plugin.name.length).toBeGreaterThan(0);
      expect(typeof plugin.description).toBe("string");
      expect(plugin.availability).toBe("available");
    }
  });

  test("specific specialized plugins resolve to their dedicated chat widget types", () => {
    expect(resolvePluginOutputType("notes-to-quiz")).toBe("quiz");
    expect(resolvePluginOutputType("ncert-question-generator")).toBe("ncert-set");
    expect(resolvePluginOutputType("flashcard-maker")).toBe("flashcards");
    expect(resolvePluginOutputType("slideshow-maker")).toBe("slideshow");
    expect(resolvePluginOutputType("formula-sheet-generator")).toBe("formula-sheet");
    expect(resolvePluginOutputType("ai-pdf-studio")).toBe("pdf");
    expect(resolvePluginOutputType("chapter-summarizer")).toBe("pdf");
    expect(resolvePluginOutputType("chapter-builder")).toBe("pdf");
    expect(resolvePluginOutputType("concept-explainer")).toBe("explainer");
    expect(resolvePluginOutputType("aisig")).toBe("image");
    expect(resolvePluginOutputType("homework-scanner")).toBe("homework");
    expect(resolvePluginOutputType("answer-evaluator")).toBe("evaluator");
    expect(resolvePluginOutputType("revision-planner")).toBe("planner");
    expect(resolvePluginOutputType("one-night-exam")).toBe("planner");
    expect(resolvePluginOutputType("diagram-flowchart-builder")).toBe("flowchart");
    expect(resolvePluginOutputType("mistake-pattern-tracker")).toBe("analytics");
    expect(resolvePluginOutputType("memory-predictor")).toBe("analytics");
    expect(resolvePluginOutputType("pyq-solver")).toBe("pyq");
    expect(resolvePluginOutputType("daily-briefing")).toBe("companion");
    expect(resolvePluginOutputType("life-saver")).toBe("companion");
    expect(resolvePluginOutputType("study-companion")).toBe("companion");
  });

  test("conversational context memory extracts previous plugin data for refinement turns", () => {
    const mockHistory: LamMessage[] = [
      {
        id: "turn-1",
        role: "user",
        content: "[@Notes-to-Quiz] Generate 3 questions on Optics",
        createdAt: new Date().toISOString(),
      },
      {
        id: "turn-1-assist",
        role: "assistant",
        content: "Here is your Optics quiz.",
        createdAt: new Date().toISOString(),
        pluginExecution: {
          pluginId: "notes-to-quiz",
          pluginName: "Notes-to-Quiz",
          status: "completed",
          outputType: "quiz",
          quiz: [
            {
              question: "What is Snell's Law?",
              options: ["n1 sin θ1 = n2 sin θ2", "E = mc^2", "F = ma", "V = IR"],
              answer: "n1 sin θ1 = n2 sin θ2",
              explanation: "Refraction formula",
            },
          ],
        },
      },
    ];

    const { isFollowUp, contextSummary } = extractConversationalPluginContext("notes-to-quiz", mockHistory);
    expect(isFollowUp).toBe(true);
    expect(contextSummary).toContain("Snell's Law");
    expect(contextSummary).toContain("Refraction formula");
  });

  test("conversational follow-up detector refines active plugin without hijacking normal chat questions", () => {
    const quizTurn: LamMessage[] = [
      {
        id: "q-1",
        role: "assistant",
        content: "Quiz ready",
        createdAt: new Date().toISOString(),
        pluginExecution: {
          pluginId: "notes-to-quiz",
          pluginName: "Notes-to-Quiz",
          status: "completed",
          outputType: "quiz",
        },
      },
    ];

    expect(detectPluginFollowUp("Make it harder", quizTurn)).toEqual({
      shouldContinue: true,
      pluginId: "notes-to-quiz",
      reason: "refinement_phrase",
    });
    expect(detectPluginFollowUp("Add 3 more numericals", quizTurn).shouldContinue).toBe(true);
    // Normal short questions must NOT be hijacked into the last plugin
    expect(detectPluginFollowUp("What is photosynthesis?", quizTurn).shouldContinue).toBe(false);
    expect(detectPluginFollowUp("Who discovered electrons?", quizTurn).shouldContinue).toBe(false);
  });

  test("checkPluginMissingInput validates required photo or student answer cleanly", () => {
    const hw = pluginById("homework-scanner")!;
    const evalPlugin = pluginById("answer-evaluator")!;
    expect(checkPluginMissingInput(hw, "", false, false, false, {}).missing).toBe(true);
    expect(checkPluginMissingInput(hw, "", false, true, false, {}).missing).toBe(false);
    expect(checkPluginMissingInput(evalPlugin, "grade this", false, false, false, {}).missing).toBe(true);
    expect(
      checkPluginMissingInput(
        evalPlugin,
        "Question: State Newton's 2nd law (3 marks). My answer: Rate of change of momentum equals applied force F=dp/dt.",
        false,
        false,
        false,
        {},
      ).missing,
    ).toBe(false);
  });

  test("parseMarkdownSections splits cleanly along headings without truncating prose", () => {
    const md = `# Motion\nIntro line\n## First Law\nInertia law body.\n## Second Law\nF = ma formula explanation.`;
    const sections = parseMarkdownSections(md);
    expect(sections).toHaveLength(3);
    expect(sections[0]).toEqual({ heading: "Motion", body: "Intro line" });
    expect(sections[1]).toEqual({ heading: "First Law", body: "Inertia law body." });
    expect(sections[2]).toEqual({ heading: "Second Law", body: "F = ma formula explanation." });
  });

  test("conversational context returns empty string when no previous execution exists", () => {
    const emptyHistory: LamMessage[] = [];
    const { isFollowUp, contextSummary } = extractConversationalPluginContext("notes-to-quiz", emptyHistory);
    expect(isFollowUp).toBe(false);
    expect(contextSummary).toBe("");
  });
});
