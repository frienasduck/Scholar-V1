import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { pdfPageScale } from "../src/lib/ebooks/page-layout";
import { PageReaderShell } from "../src/components/ebook/page-reader-shell";
test("normal uploaded pages use available width even on a short laptop screen", () => {
  const page = { width: 600, height: 800 };
  expect(pdfPageScale(1200, page, "width", 578)).toBe(2);
  expect(pdfPageScale(1200, page, "page", 578)).toBe(578 / 800);
  expect(pdfPageScale(360, page, "width", 650)).toBe(0.6);
});
test("shared reader exposes recognizable accessible study actions and real page navigation", () => {
  const noop = () => {};
  const html = renderToStaticMarkup(<PageReaderShell title="Uploaded physics" page={2} totalPages={5} chapters={[{ title: "Forces", page: 1 }]} bookmarked textReady status="Saved" renderPage={() => <canvas aria-label="PDF page 2" />} tools={<p>Notes</p>} onClose={noop} onPage={noop} onBookmark={noop} onOCR={noop} onAsk={noop} onBookMode={noop} onSearch={async () => []} />);
  for (const label of ["Extract text (OCR)", "Ask LAM", "Practice &amp; summary", 'aria-label="Study tools"', 'aria-label="Page number"', 'aria-label="Go to page 5"', 'aria-current="page"', "Forces"]) expect(html).toContain(label);
});
