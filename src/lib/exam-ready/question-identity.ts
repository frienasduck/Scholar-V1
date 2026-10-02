import "server-only";
import { createHash } from "node:crypto";

// Repeated wording is still the same evidence, even if a different teacher
// turn or mock generated it. Answer keys are deliberately not fingerprinted.
export function questionIdentity(subjectId: string, chapterId: string, question: string, options?: string[]) {
  const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");
  const content = [subjectId, chapterId, normalize(question), options?.map(normalize).sort()];
  return `ai:${createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 28)}`;
}
