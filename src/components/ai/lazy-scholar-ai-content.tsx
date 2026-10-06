"use client";

import dynamic from "next/dynamic";
export type { ScholarAIContentMode, ScholarAIContentProps } from "./scholar-ai-renderer";

// Only shell-adjacent, interaction-owned content uses this boundary. Visible
// teaching pages import the synchronous renderer to preserve their SSR contract.
const loadRenderer = () => import("./scholar-ai-renderer");
export const ScholarAIContent = dynamic(() => import("./scholar-ai-renderer").then(m => m.ScholarAIContent));
export function preloadScholarAIContent(): void {
  void loadRenderer().catch(() => { /* Actual rendering retries through Next's error boundary. */ });
}
