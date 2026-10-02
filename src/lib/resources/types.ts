export const RESOURCE_TYPES = ["textbook", "notes", "video", "reference", "question-bank", "sample-paper", "past-paper", "syllabus", "simulation", "summary", "formula-sheet", "definitions", "flashcards", "practice"] as const;
export type ResourceType = typeof RESOURCE_TYPES[number];
export type ResourceState = "DISCOVERED" | "VALIDATING" | "ACQUIRING" | "EXTRACTING" | "CLASSIFYING" | "INDEXING" | "READY" | "LINK_ONLY" | "NEEDS_REVIEW" | "FAILED" | "REJECTED";
export interface Mapping { curriculumId: string; grade: number; subjectId: string; chapterId: string; topicId?: string; relevance?: number }
export interface ResourceRecord {
  id: string; title: string; description: string; resourceType: string; sourceType: string;
  canonicalUrl: string | null; publisher: string; author?: string | null; language: string;
  licenseType: string; licenseUrl: string | null; attributionText: string;
  canStoreCopy: boolean; canGenerateDerivatives: boolean;
  visibility: string; ownerUserId: string | null; ebookId?: string | null;
  state: string; qualityStatus: string; confidence?: number; mappings: Mapping[];
  lastCheckedAt?: string | null; contentHash?: string | null; deletedAt?: string | null;
  sourceMetadata?: Record<string, unknown>;
}
export interface SourceSection { heading: string; text: string; page?: number; timestamp?: number; sourceUrl?: string }
export interface IndexedChunk extends SourceSection { ordinal: number }
export interface Citation { id: string; resourceId: string; title: string; publisher: string; url: string | null; heading: string; page?: number; timestamp?: number }
export interface ResourceQuery { q?: string; grade?: number; subjectId?: string; chapterId?: string; topic?: string; type?: string; scope?: "all" | "built-in" | "personal"; publisher?: string; language?: string; page?: number; limit?: number }
export interface ResourceResult { resources: (ResourceRecord & { reason: string })[]; total: number; page: number; pages: number; privateAvailable: boolean }
export interface Snapshot { resourceId: string; revision: string; retrievedAt: string; sections: SourceSection[] }
