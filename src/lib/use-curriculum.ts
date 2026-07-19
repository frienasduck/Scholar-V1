"use client";
import { useStore } from "@/lib/store";
import { CURRICULUM } from "@/lib/curriculum";
import { CURRICULUM_CLASS11 } from "@/lib/curriculum-class11";
// Re-export the Class 11 Chapter/Subject types (a superset of the Class 9 types)
// so consumers can use the rich per-chapter metadata fields when available.
import type { Subject, Chapter } from "@/lib/curriculum-class11";

export function useCurriculum(): Subject[] {
  const scholarClass = useStore((s) => s.user.scholarClass);
  return scholarClass === 11 ? CURRICULUM_CLASS11 : CURRICULUM;
}

export function useCurriculumSubject(subjectId: string): Subject | undefined {
  const curriculum = useCurriculum();
  return curriculum.find((s) => s.id === subjectId);
}

export { CURRICULUM, CURRICULUM_CLASS11 };
export type { Subject, Chapter };
