/**
 * Scholar Intelligence — API input schemas (zod).
 *
 * Every client→server write goes through these schemas. The server never
 * trusts client-computed mastery — it stores validated evidence events and
 * recomputes state with the same pure engine.
 */

import { z } from "zod";
import type { EvidenceEvent, MistakeRecord } from "./types";

export const evidenceKindSchema = z.enum([
  "quiz_attempt",
  "question_result",
  "practice",
  "mistake",
  "revision",
  "confidence",
  "study",
]);

export const difficultySchema = z.enum(["foundation", "standard", "advanced", "challenge"]);

export const evidenceSourceSchema = z.enum([
  "quiz",
  "practice",
  "ai-tutor",
  "assignment",
  "exam-sim",
  "revision-hub",
  "flashcards",
  "notes",
  "manual",
]);

export const evidenceEventSchema = z.object({
  id: z.string().min(1).max(120),
  kind: evidenceKindSchema,
  subject: z.string().min(1).max(80),
  chapter: z.string().max(120).optional(),
  topic: z.string().max(160).optional(),
  correct: z.boolean().optional(),
  score: z.number().min(0).max(1).optional(),
  total: z.number().int().min(1).max(500).optional(),
  difficulty: difficultySchema.optional(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  at: z.number().min(1_000_000_000_000 - 31_536_000_000).max(4_100_000_000_000), // recent past → far future
  source: evidenceSourceSchema.optional(),
});

/** Batched ingest — bounded so one request can't flood the ledger. */
export const ingestEventsSchema = z.object({
  events: z.array(evidenceEventSchema).min(1).max(200),
});

export const mistakeTypeSchema = z.enum([
  "Concept Error",
  "Formula Error",
  "Calculation Error",
  "Reading Error",
  "Guess",
  "Memory Error",
  "Other",
]);

export const mistakeRecordSchema = z.object({
  id: z.string().min(1).max(120),
  subject: z.string().min(1).max(80),
  chapter: z.string().max(120).optional(),
  topic: z.string().max(160).optional(),
  question: z.string().min(1).max(2_000),
  userAnswer: z.string().max(1_000).optional(),
  correctAnswer: z.string().max(1_000).optional(),
  explanation: z.string().max(2_000).optional(),
  mistakeType: mistakeTypeSchema,
  originalType: z.string().max(120).optional(),
  source: evidenceSourceSchema,
  at: z.number().min(1_000_000_000_000 - 31_536_000_000).max(4_100_000_000_000),
});

export const ingestMistakesSchema = z.object({
  mistakes: z.array(mistakeRecordSchema).min(1).max(200),
});

/** Revision review rating update. */
export const reviewUpdateSchema = z.object({
  itemId: z.string().min(1).max(160),
  rating: z.enum(["again", "hard", "good", "easy"]),
  at: z.number().min(1_000_000_000_000 - 31_536_000_000).max(4_100_000_000_000),
});

export const manualOrderSchema = z.object({
  order: z.array(z.string().min(1).max(160)).max(500),
});

export type IngestEventsInput = z.infer<typeof ingestEventsSchema>;
export type IngestMistakesInput = z.infer<typeof ingestMistakesSchema>;
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;
export type EvidenceEventInput = z.infer<typeof evidenceEventSchema>;

/** Narrow the validated input to the internal event shape. */
export function toEvidenceEvent(input: EvidenceEventInput): EvidenceEvent {
  return input;
}

export function toMistakeRecord(input: z.infer<typeof mistakeRecordSchema>): MistakeRecord {
  return {
    ...input,
    resolved: false,
  };
}
