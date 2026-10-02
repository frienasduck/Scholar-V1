import type { Citation, IndexedChunk } from "./types";
export const ARTIFACT_TYPES = ["summary", "flashcards", "formula-sheet", "definitions", "practice"] as const;
export type ArtifactType = typeof ARTIFACT_TYPES[number];
export interface StudyArtifact { type: ArtifactType; generator: string; quality: string; items: { front: string; back: string; citation: Citation; term?: string; expression?: string }[]; license: string }
export const ARTIFACT_GENERATOR = "scholar-extractive-v2";
function excerpt(text: string, limit: number) {
  if (text.length <= limit) return text;
  const end = Math.max(text.lastIndexOf(". ", limit), text.lastIndexOf("\n", limit));
  return text.slice(0, end > limit / 2 ? end + 1 : text.lastIndexOf(" ", limit)).trim();
}
/** Extractive study aids: no invented exam questions, counts, answers or unsupported formulas. */
export function deriveArtifact(type: ArtifactType, chunks: { chunk: IndexedChunk; citation: Citation }[], license: string): StudyArtifact {
  const candidates = chunks.filter(({ chunk }) => chunk.text.length > 40 && !/^(references|navigation|external links|contents)$/i.test(chunk.heading));
  const definitions = candidates.flatMap(({ chunk, citation }) => chunk.text.split(/\n|(?<=\.)\s+/).flatMap(line => {
    const match = line.trim().match(/^([\p{L}\p{N}\s'’()μ-]{2,70}?)(?::\s+|\s+(?:is|refers to|means)\s+)(.{30,})$/u);
    if (!match || match[1].trim().split(/\s+/).length > 6 || /^(there|this|it|that|these|those|they|he|she|why|what|how|however|also|when|once|if|according|for|at|in|on|the above|the following)\b|\b(states|describes|shows|says|explains)\b/i.test(match[1].trim())) return [];
    const term = match[1].trim();
    return [{ term, front: term, back: excerpt(match[2], 650), citation }];
  }));
  let items: StudyArtifact["items"];
  if (type === "definitions") items = definitions;
  else if (type === "flashcards" && definitions.length) items = definitions.map(item => ({ ...item, front: `Define ${item.term}.` }));
  else if (type === "formula-sheet") items = candidates.flatMap(({ chunk, citation }) => {
    const expressions = [...chunk.text.matchAll(/\$\$?([^$]{1,1500})\$\$?/g)].filter(m => /[=≤≥∑∫√]|\\(?:frac|sum|le|ge)/.test(m[1]));
    if (expressions.length) return expressions.map(m => ({ front: chunk.heading, expression: m[1], back: `${m[0]}\n\n${excerpt(chunk.text.slice(Math.max(0, m.index! - 120), m.index! + m[0].length + 250), 600)}`, citation }));
    return /[=∑∫√]|\\(?:frac|sum)|formula|equation/i.test(chunk.text) ? [{ front: chunk.heading, back: excerpt(chunk.text, 650), citation }] : [];
  });
  else items = candidates.map(({ chunk, citation }) => ({
    front: type === "practice" ? `Explain ${chunk.heading} in your own words, then compare with the source.` : type === "flashcards" ? `Explain the key idea in ${chunk.heading}.` : chunk.heading,
    back: excerpt(chunk.text, type === "summary" ? 900 : 650), citation,
  }));
  const seen = new Set<string>();
  items = items.filter(item => { const key = `${item.front}:${item.expression ?? item.back}`; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 12);
  return { type, generator: ARTIFACT_GENERATOR, quality: "Source extracts · review before exam use; not academically verified", license, items };
}
