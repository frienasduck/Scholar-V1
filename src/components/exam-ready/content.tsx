"use client";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";

// Shared by teacher, answer feedback and mistake memory. Prose with =, / or
// superscripts is never guessed to be one giant display-math expression.
export function ExamContent({ content }: { content: string }) {
    return <ScholarAIContent content={content} normalizeLegacy={false}/>;
}
