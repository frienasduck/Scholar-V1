# Task 4-b-4 — Downloads / Offline Center (full-stack-developer)

## Assignment
Build the `DownloadsView` for Neha's Scholar — a cinematic glassmorphism Downloads & Offline Center: 20-item catalog (notes / formulas / flashcards / experiment videos / chapter summaries / mock papers / mind maps / audio summaries), simulated downloads with progress, offline mode toggle, storage meter + breakdown, AI picks, and a printable manifest export.

## File
- `/home/z/my-project/src/components/views/downloads.tsx` (overwritten completely, 1175 lines)
- Export name: `DownloadsView`

## What was built
1. **Cinematic hero** — staggered Framer Motion entrance (icon badge, italic-serif title "Downloads & Offline", subtitle, 4 stat pills with 80ms stagger: Total Items / Storage Used / Available Offline / Pending Downloads), plus an Offline Mode Switch in the header (persisted to `localStorage("dl-offline")`).
2. **Background video** (autoplay/muted/loop/playsInline, object-cover, z-0) + `bg-black/55` overlay; content z-10. Inline `<style>` with unique `dl-` prefix for `.dl-glass`, `.dl-glass-strong`, `.dl-display` (Instrument Serif italic), `.dl-body` (Inter), `.dl-scroll`, and `[data-slot=...]` overrides so shadcn Dialog/Tabs/Input render on the video.
3. **20-item catalog** seeded across 8 type labels and 6 subjects (Mathematics / Science / English / Social Science / Hindi / General). Item shape `{ id, title, type, category, subject, sizeMB, downloaded, downloadedAt?, offlineReady, url }`.
4. **Download simulation** — `setInterval` at 100ms incrementing 4–12%/tick (~2s total); animated progress bar on the card during download; on completion marks downloaded + offlineReady, awards +2 XP via `addXP`, pushes activity, toasts success. Active intervals tracked in a ref + cleaned on unmount.
5. **Offline mode** — Switch in header; when ON, library list filters to downloaded-only + amber "You're offline" banner with "Go online" link. Persisted to localStorage.
6. **Storage meter** (Storage tab) — sum of downloaded sizes vs 500 MB limit, animated progress bar; amber > 70%, red > 90%, with warning text. Breakdown-by-type horizontal bar chart with per-category color and size/%.
7. **Search + filters** — search input (title/subject), type filter chips (All / Notes / Videos / Flashcards / Formulas / Audio), subject filter chips (All + 5 curriculum + General). All filter the Library grid reactively via `useMemo`.
8. **Manage downloads** (Downloads tab) — list of downloaded items with Open (toast "Opening {title}…") + Remove buttons; bulk "Clear All Downloads" opens a confirm dialog that resets all items to not-downloaded.
9. **Tabs** — Library / Downloads / Storage via shadcn Tabs (overridden to glass styling). Storage tab also includes a "Clear cache" button (same confirm flow).
10. **AI Pick for You** — glass-strong card at top of Library tab; "Get picks" button calls `askAIJSON` with the user's 2 weakest subjects (from `store.mastery`) + full catalog → `{ recommendations: [{ title, reason, type, subject }] }`. Renders each as a highlighted row with type icon, subject badge, AI reason, and a contextual "Get"/"Open" button. Errors handled with toast.
11. **Export Manifest** — header button calls `exportPDF({ title: "Download Manifest", subtitle, bodyHtml: mdToHtml(md), accent: "#6366f1", type: "report" })` with a markdown table of all downloaded items + storage-by-type breakdown. Empty-state toast when nothing is downloaded.

## Style fidelity
- Background video (the exact URL from the spec), `bg-black/55` overlay, z-10 content layer.
- Unique `dl-` prefix for all CSS classes — no collisions with other views.
- `@import` for Instrument Serif (italic display) + Inter (body) at top of the inline `<style>`.
- shadcn Dialog/Tabs/Input styling overridden via `.dl-root [data-slot="..."]` selectors so they render correctly on the video (dark glass background, white text, transparent input).
- Framer Motion staggered entrance on hero, `whileHover={{ y: -3 }}` on library cards, `AnimatePresence mode="popLayout"` for card exit animations.
- Responsive mobile-first: 1→2→3 col grid, `flex-wrap` action rows, scrollable Downloads list (`max-h-[60vh] overflow-y-auto dl-scroll`).
- All text white / white-70 on video; gradient accents use indigo→teal (no blue-only palettes).

## Lint result
`bun run lint` → **0 errors, 0 warnings** (exit 0). Also verified `bunx tsc --noEmit --skipLibCheck` produces no errors in `src/` (only pre-existing errors in `examples/` and `skills/` unrelated to this task).

## Notable implementation details
- `intervalsRef` (a `Record<string, ReturnType<typeof setInterval>>`) tracks active download timers; cleaned up on unmount to avoid setState-after-unmount warnings.
- localStorage hydration on mount merges any saved state with new seed items (so catalog updates still flow through to existing users).
- Storage breakdown filters to non-zero categories and sorts by size for a clean chart.
- The destructuring-with-rest pattern was avoided (would trigger `no-unused-vars` on the discarded binding); `delete rest[item.id]` is used instead.
- AI prompt explicitly asks for titles that EXACTLY match catalog titles, so recommendations can be cross-referenced to real `DLItem`s for the "Get"/"Open" button.
- The Pending Downloads pill shows a spinner (`animate-spin`) when > 0 — subtle, lively feedback.
