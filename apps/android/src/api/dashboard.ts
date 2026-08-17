import { apiFetch } from "./client";

export type MasteryEstimate = {
  subject: string;
  chapter?: string;
  topic?: string;
  level: string;
  score: number | null;
  evidenceCount: number;
  accuracy: number | null;
  lastAttemptAt?: number;
  needsRefresh?: boolean;
};

export type WeakTopic = {
  subject: string;
  chapter?: string;
  topic?: string;
  severity?: string;
  accuracy?: number;
  attempts?: number;
  suggestion?: string;
};

export type IntelligenceSnapshot = {
  mastery: MasteryEstimate[];
  weakTopics: WeakTopic[];
  evidenceCount: number;
  updatedAt: number;
};

export function getIntelligenceSnapshot(): Promise<IntelligenceSnapshot> {
  return apiFetch<IntelligenceSnapshot>("/api/v2/intelligence/state");
}
