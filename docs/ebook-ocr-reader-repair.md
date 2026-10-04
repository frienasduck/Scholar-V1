# E-Book OCR and reader repair — 4 October 2026

## Story

Open an uploaded PDF in Scholar's familiar large-page reader → extract a scanned page → review and save its text → search or study that page with LAM using the owner-scoped saved index.

## Causes and repairs

- Uploaded canvases used the minimum of width-fit and screen-height-fit, even in normal reading. The normal reader now fits available width; immersive fit-page remains a separate option.
- Private uploaded scans had no OCR-and-review action. The new owner-scoped `/api/ebooks/[ebookId]/ocr` renders just the requested PDF page, runs local English recognition, and requires explicit review before persistence.
- Reviewed saves lock the owned book, preserve other pages and original bytes, rebuild page-numbered chunks and invalidate cached derived artifacts in one transaction. Existing LAM retrieval reads that authoritative page text.
- Built-in OCR captured the initial book ID in a callback and could save error strings as page text. Requests now use the active book, cancel on page/book changes and separate errors from text. Prior saved error strings are ignored.
- Built-in page context could overwrite an uploaded reader's context; opening LAM could merge a previous book's private IDs. Only the active reader publishes context, and the opener uses the current context rather than the previous conversation's file fields.
- Built-in notes, bookmarks and reviewed text now have book/class-scoped keys. Existing Physics-only legacy data remains a non-destructively readable fallback.
- Worker and English trained data are explicitly packaged for the relevant serverless routes. Debug maps, abandoned Prisma downloads and unused alternative scan/language files are excluded from those route traces. Automatic segmentation handles multiple textbook columns. Local trained data follows the [official Tesseract data packaging guidance](https://github.com/naptha/tessdata/blob/gh-pages/README.md).

## Validation evidence

- 48 relevant tests pass (each Bun suite in a separate process), including three real OCR/PDF tests. Typecheck, lint and the production build pass. These checks do not remove the live database blocker below.
- Final production traces retain English data, all three LSTM hardware variants and the native Prisma engine; the private OCR route also retains PDF fonts. Unused runtime variants are excluded. Unique Windows-build trace sizes are approximately 230 MB for built-in OCR and 110 MB for private OCR (not a claim about a deployed Linux bundle).
- Real PDF → native canvas → English OCR recovers the fixture's actual page-2 physics content. Blank scans and invalid pages fail without producing saved text.
- Physics scan page 9: 1,987 characters, 78% OCR confidence. This is recognition evidence, not an assertion of equation-perfect transcription.
- Mocked API/data-flow tests verify guest/other-owner rejection, explicit review, atomic rollback, original-PDF retention, source-page preservation and LAM receiving server-saved OCR instead of a fabricated client excerpt.
- The actual shared reader shell was browser-checked at 1366×768 and 390×844 using a public scan. Default page widths were approximately 1027 and 363 px respectively, with no document-level horizontal overflow. Page navigation, zoom and the phone tools dialog worked; its console was clean. Temporary visual-only QA route was removed after checks.
- The live built-in OCR dialog was checked against the database failure: it shows the service/configuration error separately, leaves the reviewed text blank, and disables Save. Error messages cannot become book content.
- Screenshots: `test-artifacts/ebook-ocr-reader-laptop-2026-10-04.jpg`, `test-artifacts/ebook-ocr-reader-mobile-2026-10-04.jpg`. These are layout previews, not real private-book acceptance screenshots.

## Known external blocker

The configured database URL is SQLite, while this app's Prisma schema requires PostgreSQL. A direct sanitized database check returns `PrismaClientInitializationError`, `P1012`. The live `/api/ocr` request now reports an actionable 503 instead of a misleading bad-image error; its rate limiter still fails closed. Full signed-in OCR/save/live-AI/cross-device acceptance cannot be claimed until an authorized working PostgreSQL configuration and the existing additive migrations are available. No credentials, provider selection, auth bypass or production migration were changed.

## Remaining limitations

English OCR is page-by-page and requires human review. Equations, small symbols, handwriting and non-English text can need corrections. Only pages whose text has been extracted/saved support text-grounded tools; the original PDF remains readable regardless. LAM's current-screen context preference is still respected.
