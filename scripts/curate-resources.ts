// Controlled manifest only. Does not crawl links or touch any database.
import { readFileSync, writeFileSync } from "node:fs";
import { manifest } from "../src/lib/resources/manifest";
import { safeFetch, plainHtml } from "../src/lib/resources/safe-fetch";
import { normalizeText, contentHash } from "../src/lib/resources/engine";
import type { ResourceRecord, Snapshot, SourceSection } from "../src/lib/resources/types";

const catalogPath = new URL("../src/lib/resources/catalog.json", import.meta.url);
const snapshotPath = new URL("../src/lib/resources/snapshots.json", import.meta.url);
const existing = JSON.parse(readFileSync(catalogPath, "utf8")) as ResourceRecord[];
const snapshots = new Map((JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot[]).map(s => [s.resourceId, s]));
const refresh = process.argv.includes("--refresh");
const refreshText = process.argv.includes("--refresh-text");
const previousReviews = JSON.parse(readFileSync(new URL("../src/lib/resources/curation-review.json", import.meta.url), "utf8")) as { url: string; title: string; reason: string }[];
const outcomes: ResourceRecord[] = [];
const reviews: { url: string; title: string; reason: string }[] = [];
const queue = manifest();
async function processSource() {
  while (queue.length) {
    const record = queue.shift()!;
    const saved = existing.find(r => r.id === record.id);
    if (saved?.lastCheckedAt && !refresh && !(refreshText && record.canStoreCopy)) { outcomes.push(saved); const review = previousReviews.find(r => r.url === record.canonicalUrl); if (review) reviews.push(review); continue; }
    try {
      if (record.canStoreCopy && new URL(record.canonicalUrl!).hostname === "en.wikibooks.org") {
        const fetched = await safeFetch(record.canonicalUrl!, { maxBytes: 1_500_000 });
        const html = fetched.bytes.toString("utf8");
        if (!html.includes("creativecommons.org/licenses/by-sa/4.0") && !html.includes("Creative Commons Attribution-ShareAlike")) throw new Error("License not confirmed on source page.");
        if (/There is currently no text in this page|Wikibooks does not have a book/i.test(html)) throw new Error("Missing source page.");
        const start = html.search(/<div[^>]+class="[^"]*mw-parser-output/);
        if (start < 0) throw new Error("Unrecognised article markup.");
        const end = html.indexOf('class="printfooter"', start);
        const article = html.slice(start, end > start ? end : html.indexOf('id="catlinks"', start)).replace(/<table\b[^>]*(?:class="[^"]*noprint|id="toc")[\s\S]*?<\/table>/gi, "");
        const sections: SourceSection[] = []; let heading = record.title;
        for (const part of article.split(/(<h[2-4]\b[^>]*>[\s\S]*?<\/h[2-4]>)/i)) {
          if (/^<h[2-4]/i.test(part)) { heading = normalizeText(plainHtml(part)).replace(/\[edit.*?\]/g, ""); continue; }
          const text = normalizeText(plainHtml(part)).replace(/\[edit\s*\|\s*edit source\]/g, "");
          if (text.length > 80) sections.push({ heading, text, sourceUrl: record.canonicalUrl! });
        }
        if (!sections.length || sections.reduce((n, s) => n + s.text.length, 0) < 180) throw new Error("Source page is too incomplete.");
        const revision = html.match(/oldid=(\d+)/)?.[1] ?? contentHash(JSON.stringify(sections));
        record.sourceMetadata = { ...record.sourceMetadata, revision, historyUrl: `${record.canonicalUrl}?action=history`, ingestionMode: "TEXT", modifications: "Navigation removed; headings and formula alt text retained. Source text not academically certified by Scholar." };
        record.contentHash = contentHash(JSON.stringify(sections));
        record.state = "READY";
        snapshots.set(record.id, { resourceId: record.id, revision, retrievedAt: new Date().toISOString(), sections });
      } else {
        await safeFetch(record.canonicalUrl!, { head: true });
        record.state = "LINK_ONLY";
      }
      record.lastCheckedAt = new Date().toISOString();
      console.log(`OK ${record.title}`);
      outcomes.push(record);
    } catch (error) { const reason = error instanceof Error ? error.message : "Unavailable"; console.log(`REVIEW ${record.title}: ${reason}`); reviews.push({ url: record.canonicalUrl!, title: record.title, reason }); if (saved) outcomes.push(saved); }
  }
}
await Promise.all(Array.from({ length: 4 }, () => processSource()));
outcomes.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(catalogPath, JSON.stringify(outcomes, null, 2) + "\n");
writeFileSync(snapshotPath, JSON.stringify([...snapshots.values()].filter(s => outcomes.some(r => r.id === s.resourceId)), null, 2) + "\n");
writeFileSync(new URL("../src/lib/resources/curation-review.json", import.meta.url), JSON.stringify(reviews, null, 2) + "\n");
console.log(JSON.stringify({ verified: outcomes.length, indexed: snapshots.size, chapters: new Set(outcomes.flatMap(r => r.mappings.map(m => `${m.grade}:${m.subjectId}:${m.chapterId}`))).size }));
