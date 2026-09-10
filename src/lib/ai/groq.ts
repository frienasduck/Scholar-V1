import "server-only";

// LAM and the rest of Scholar share provider policy, deadlines and fallbacks.
export {
  generateScholarGroqText as generateGroqText,
  generateScholarGroqJSON as generateGroqJSON,
  streamScholarGroqText as streamGroqText,
} from "@/lib/ai/scholar-groq";
export type { ScholarGroqRequest as GroqGenerationOptions } from "@/lib/ai/scholar-groq";
