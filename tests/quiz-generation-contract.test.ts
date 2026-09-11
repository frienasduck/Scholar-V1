import { expect, test } from "bun:test";
import { quizGenerationSchema } from "../src/lib/ai/schemas";

const question = { question: "What is the net force on a 2 kg mass accelerating at 3 m/s²?", options: ["2 N", "3 N", "6 N", "9 N"], correctAnswer: "6 N", explanation: "F = ma = 2 × 3 = 6 N." };
test("quiz contract accepts both class answer formats", () => {
  expect(quizGenerationSchema.safeParse({ questions: [question] }).success).toBe(true);
  expect(quizGenerationSchema.safeParse({ questions: [{ ...question, correctAnswer: undefined, answer: "6 N" }] }).success).toBe(true);
});
test("quiz contract rejects absent answers and duplicate options", () => {
  expect(quizGenerationSchema.safeParse({ questions: [{ ...question, correctAnswer: "12 N" }] }).success).toBe(false);
  expect(quizGenerationSchema.safeParse({ questions: [{ ...question, options: ["6 N", "6 N", "3 N", "9 N"] }] }).success).toBe(false);
});
test("quiz contract rejects the contradictions observed in production", () => {
  for (const explanation of ["a = 19.6/8 = 2.45 m/s². None match. Correct answer should be 2.45 m/s².", "Actually 64 m not listed. Correct answer should be 60 m."]) {
    expect(quizGenerationSchema.safeParse({ questions: [{ ...question, explanation }] }).success).toBe(false);
  }
});
