// Class-aware curriculum helper — returns the correct curriculum based on scholarClass
import { CURRICULUM } from "./curriculum";
import { CURRICULUM_CLASS11 } from "./curriculum-class11";
import type { Subject } from "./curriculum";

export function getCurriculum(scholarClass: 9 | 11 = 9): Subject[] {
  return scholarClass === 11 ? CURRICULUM_CLASS11 : CURRICULUM;
}

export function getSubjectById(scholarClass: 9 | 11, subjectId: string): Subject | undefined {
  return getCurriculum(scholarClass).find((s) => s.id === subjectId);
}

export { CURRICULUM, CURRICULUM_CLASS11 };
export type { Subject, Chapter } from "./curriculum";
