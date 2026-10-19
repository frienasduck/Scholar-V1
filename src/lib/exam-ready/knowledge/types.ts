import type { Citation, ResourceRecord } from "@/lib/resources/types";
import type { Question, Lesson } from "../model";

export const KNOWLEDGE_VERSION = "exam-ready-knowledge-3.3.0";
export type Scope = { grade: 9 | 11; subjectId: string; chapterId: string };
export type KnowledgeState = "READY" | "LINK_ONLY" | "PROCESSING" | "NEEDS_OCR" | "NEEDS_REVIEW" | "FAILED";
export type KnowledgeMaterial = ResourceRecord & {
  domain: "EXAM_READY"; version: string; reviewStatus: string; objectiveIds: string[];
  indexedChunks: number; pages?: number; limitations: string[];
};
export type TeachingUnit = Scope & {
  id: string; topicIndexes: number[]; title: string; explanation: string;
  formula?: string; conditions: string; mistakes: string[]; revision: string[];
  examples: NonNullable<Lesson["example"]>[];
  checks: Omit<Question, "id" | "subjectId" | "chapterId" | "objectiveId" | "topic" | "source">[];
  references: { title: string; url: string; checkedAt: string }[];
  checkObjectiveIndexes?: number[];
  prerequisites?: string[];
  derivation?: string[];
  diagram?: string;
  misconceptions?: { wrong: string; repair: string; diagnostic: string; transfer: string }[];
  scopeNote?: string;
  reviewStatus: "reference-checked" | "review-needed";
};
export type KnowledgePassage = { citation: Citation; text: string; version: string; objectiveIds: string[]; origin: "SCHOLAR_AUTHORED" | "LICENSED_SOURCE" | "USER_UPLOAD"; reviewStatus: string };
export type MaterialTrace = {
  domain: "EXAM_READY"; version: string; at: number; policy: string;
  selectedIds: string[]; excludedIds: string[];
  retrieved: { sourceId: string; version: string; heading: string; page?: number; citationId: string }[];
  used: { sourceId: string; version: string; citationId: string }[];
};
