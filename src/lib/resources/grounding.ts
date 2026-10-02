import { getCurriculum } from "@/lib/curriculum-helper";
import type { Citation } from "./types";
export function chapterContext(grade: 9 | 11, subject?: string, chapter?: string) {
  const curriculum = getCurriculum(grade);
  const match = curriculum.find(s => s.id === subject || s.name.toLowerCase() === subject?.toLowerCase());
  const item = match?.chapters.find(c => c.id === chapter || c.title.toLowerCase() === chapter?.toLowerCase());
  return { grade, subjectId: match?.id, chapterId: item?.id };
}
function label(value: string) { return value.replace(/[\[\]()*_`<>\r\n]/g, " ").slice(0, 250); }
/** Hold only a possible split citation token, not the response, to retain fast streaming. */
export function citationStream(ids: string[]) {
  const allowed = new Set(ids);
  let pending = "";
  const clean = (text: string) => text.replace(/\[(S\d+)\]/g, (match, id: string) => allowed.has(id) ? match : "[unverified source]");
  return {
    push(delta: string) {
      const text = pending + delta;
      const start = text.lastIndexOf("[");
      const tail = start >= 0 ? text.slice(start) : "";
      if (tail.length <= 32 && /^\[S?\d*$/.test(tail)) { pending = tail; return clean(text.slice(0, start)); }
      pending = "";
      return clean(text);
    },
    finish() { const tail = /^\[S\d+/.test(pending) ? "[unverified source]" : pending; pending = ""; return clean(tail); },
  };
}
/** Only IDs actually retrieved from permitted source text may become citation links. */
export function citationFooter(text: string, sources: { citation: Citation; text: string }[]) {
  const allowed = new Map(sources.map(s => [s.citation.id, s.citation]));
  const used = new Set<string>();
  const clean = text.replace(/\[(S\d+)\]/g, (match, id: string) => { if (!allowed.has(id)) return "[unverified source]"; used.add(id); return match; });
  const footer = [...used].map(id => { const c = allowed.get(id)!; const title = `${label(c.title)} — ${label(c.heading)}${c.page ? `, p. ${c.page}` : ""}${c.timestamp ? `, ${c.timestamp}s` : ""}`; return `[${id}] ${c.url?.startsWith("https://") ? `[${title}](${c.url})` : `${title} (private source)`}`; }).join("\n\n");
  return { text: footer ? `${clean}\n\n### Sources\n\n${footer}` : clean, citations: [...used].map(id => allowed.get(id)!) };
}
export function groundStructured(value: unknown, sources: { citation: Citation; text: string }[]) {
  const ids = sources.map(s => s.citation.id);
  function clean(item: unknown): unknown {
    if (typeof item === "string") { const filter = citationStream(ids); return filter.push(item) + filter.finish(); }
    if (Array.isArray(item)) return item.map(clean);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, clean(child)]));
    return item;
  }
  const data = clean(value);
  return { data, citations: citationFooter(JSON.stringify(data), sources).citations };
}
