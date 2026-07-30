export type AIProviderInventoryItem = {
  feature: string;
  routeOrModule: string;
  currentProvider: "groq" | "nvidia" | "gemini" | "other";
  currentModel?: string;
  targetProvider: "groq" | "unchanged";
  exclusionReason?: "LAM" | "AISIG_IMAGE_GENERATION";
};

export type ScholarAIProviderPolicy = {
  lam: "unchanged";
  aisigImageGeneration: "unchanged";
  aisigPromptEnhancement: "groq";
  allOtherTextGeneration: "groq";
};

export const SCHOLAR_AI_PROVIDER_POLICY: ScholarAIProviderPolicy = {
  lam: "unchanged",
  aisigImageGeneration: "unchanged",
  aisigPromptEnhancement: "groq",
  allOtherTextGeneration: "groq",
};

const GROQ_TEXT_ROUTE = "src/app/api/ai/route.ts";

const GROQ_TEXT_FEATURES = [
  "AI Tutor and doubt solving",
  "Study and current-page assistants outside LAM",
  "Question coach and practice explanations",
  "Study planner, revision coach, and focus companion outside LAM",
  "Code tutor and derivation explanations",
  "E-Book companion and inline answers",
  "ELAM page answers",
  "Experiment guide",
  "AI slideshow outline and slide generation",
  "Slideshow narration, regeneration, and editing",
  "Quiz generation and explanations",
  "Mock-exam generation, evaluation, and solutions",
  "AI notes, summaries, and chapter material",
  "AI flashcards and formula material",
  "File summarisation and file questions",
  "PDF text generation and analysis",
  "Community and friend AI assistance",
  "Study missions and progress recommendations",
  "Mistake analysis and revision material",
  "AISIG prompt enhancement",
] as const;

export const AI_PROVIDER_INVENTORY: readonly AIProviderInventoryItem[] = [
  ...GROQ_TEXT_FEATURES.map(
    (feature): AIProviderInventoryItem => ({
      feature,
      routeOrModule: GROQ_TEXT_ROUTE,
      currentProvider: "nvidia",
      currentModel: "Retired NVIDIA text model configuration",
      targetProvider: "groq",
    }),
  ),
  {
    feature: "LAM",
    routeOrModule: "src/app/api/lam/chat/route.ts",
    currentProvider: "groq",
    currentModel: "LAM existing GROQ_MODEL configuration",
    targetProvider: "unchanged",
    exclusionReason: "LAM",
  },
  {
    feature: "AISIG image generation",
    routeOrModule: "src/app/api/ai-image/route.ts",
    currentProvider: "nvidia",
    currentModel: "Existing AISIG NVIDIA image endpoint",
    targetProvider: "unchanged",
    exclusionReason: "AISIG_IMAGE_GENERATION",
  },
] as const;

export function getDevelopmentProviderDiagnostics(
  environment?: string,
): Readonly<Record<string, string>> | null {
  if ((environment ?? process.env.NODE_ENV) !== "development") return null;
  return {
    "AI Tutor": "Groq",
    "Doubt Solver": "Groq",
    "Slideshow Maker": "Groq",
    "Quiz Master": "Groq",
    "AISIG Prompt Enhancer": "Groq",
    "AISIG Image Generator": "Unchanged",
    LAM: "Unchanged",
  };
}
