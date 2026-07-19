import { z } from "zod";

export const aiModeSchema = z.enum([
  "chat",
  "stream",
  "json",
  "lesson",
  "checkpoint",
  "flashcards",
  "mock-exam",
  "answer-evaluation",
  "friend-chat",
  "community-persona",
  "study-plan",
  "summary",
]);

export type AIMode = z.infer<typeof aiModeSchema>;

export const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().trim().min(1).max(20_000),
});

export const aiRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(30),
  persona: z.string().trim().min(1).max(80).optional().default("default"),
  mode: aiModeSchema.optional(),
  temperature: z.number().min(0).max(1.5).optional().default(0.6),
  json: z.boolean().optional().default(false),
  scholarClass: z.union([z.literal(9), z.literal(11)]).optional().default(9),
  jeeMode: z.boolean().optional().default(false),
});

export type AIRequest = z.infer<typeof aiRequestSchema>;

export const checkpointSchema = z.object({
  question: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).min(2).max(6),
  correctAnswer: z.union([z.number().int().nonnegative(), z.string().trim().min(1)]),
  explanation: z.string().trim().min(1),
});

export const flashcardSchema = z.object({
  front: z.string().trim().min(1),
  back: z.string().trim().min(1),
  explanation: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).max(12).optional(),
});

export const flashcardsSchema = z.object({
  cards: z.array(flashcardSchema).min(1).max(50),
});

export const mockExamQuestionSchema = z.object({
  id: z.string().trim().min(1),
  question: z.string().trim().min(1),
  type: z.enum(["mcq", "short", "long"]),
  marks: z.number().positive().max(20),
  options: z.array(z.string().trim().min(1)).min(2).max(6).nullable().optional(),
  correctAnswer: z.union([z.number().int().nonnegative(), z.string().trim().min(1)]).optional(),
  modelAnswer: z.string().trim().min(1).optional(),
  chapterId: z.string().trim().min(1),
  chapterTitle: z.string().trim().min(1),
}).superRefine((question, context) => {
  if (question.type === "mcq") {
    if (!question.options || question.options.length !== 4) {
      context.addIssue({ code: "custom", message: "MCQs require exactly four options", path: ["options"] });
    }
    if (question.correctAnswer === undefined) {
      context.addIssue({ code: "custom", message: "MCQs require correctAnswer", path: ["correctAnswer"] });
    }
  } else if (!question.modelAnswer) {
    context.addIssue({ code: "custom", message: "Descriptive questions require modelAnswer", path: ["modelAnswer"] });
  }
});

export const mockExamSchema = z.object({
  questions: z.array(mockExamQuestionSchema).min(1).max(100),
});

export const answerEvaluationSchema = z.object({
  score: z.number().nonnegative(),
  maxScore: z.number().positive(),
  correctConcepts: z.array(z.string().trim().min(1)).max(30),
  missingConcepts: z.array(z.string().trim().min(1)).max(30),
  formulaFeedback: z.string().trim().min(1),
  unitsFeedback: z.string().trim().min(1),
  stepFeedback: z.string().trim().min(1),
  markingBreakdown: z.array(z.object({
    criterion: z.string().trim().min(1),
    marksAwarded: z.number().nonnegative(),
    maxMarks: z.number().positive(),
    feedback: z.string().trim().min(1),
  })).min(1).max(20),
  improvedAnswer: z.string().trim().min(1),
}).superRefine((evaluation, context) => {
  if (evaluation.score > evaluation.maxScore) {
    context.addIssue({ code: "custom", message: "score cannot exceed maxScore", path: ["score"] });
  }
  for (const [index, item] of evaluation.markingBreakdown.entries()) {
    if (item.marksAwarded > item.maxMarks) {
      context.addIssue({ code: "custom", message: "marksAwarded cannot exceed maxMarks", path: ["markingBreakdown", index, "marksAwarded"] });
    }
  }
});

export const imageRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(4_000),
  subject: z.string().trim().min(1).max(120).optional(),
  chapter: z.string().trim().min(1).max(160).optional(),
  style: z.string().trim().min(1).max(160).optional(),
  aspectRatio: z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]).optional().default("1:1"),
});

export function schemaForMode(mode: AIMode): z.ZodType<unknown> | null {
  switch (mode) {
    case "checkpoint":
      return checkpointSchema;
    case "flashcards":
      return flashcardsSchema;
    case "mock-exam":
      return mockExamSchema;
    case "answer-evaluation":
      return answerEvaluationSchema;
    default:
      return null;
  }
}
