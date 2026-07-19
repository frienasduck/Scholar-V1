export type LamDraft = { prompt: string; ocrText?: string };
export type LamRuntimeContext = { subjectTitle?: string; chapterTitle?: string; ebookTitle?: string; sourcePageNumber?: number; selectedQuestionId?: string };

let pendingDraft: LamDraft | null = null;
let runtimeContext: LamRuntimeContext = {};

export function setLamDraft(draft: LamDraft) {
  pendingDraft = draft;
}

export function consumeLamDraft(): LamDraft | null {
  const draft = pendingDraft;
  pendingDraft = null;
  return draft;
}

export function setLamPageContext(context: LamRuntimeContext) {
  runtimeContext = context;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("scholar:lam-context", { detail: context }));
}

export function getLamPageContext() { return runtimeContext; }
