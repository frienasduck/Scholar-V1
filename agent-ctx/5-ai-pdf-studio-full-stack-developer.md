# Task ID: 5 — Add highlighted AI PDF Studio flagship tool to ai-tools.tsx

**Agent**: full-stack-developer
**File modified**: `/home/z/my-project/src/components/views/ai-tools.tsx` (single `"use client"` file)
**Date**: 2025 session

## Objective
Add the FLAGSHIP "AI PDF Studio" tool to the existing AI Tools view. AI PDF Studio is an AI-powered professional document creation platform — the user types a prompt and receives a polished, print-ready PDF in seconds (Canva + Notion + Apple Pages + Gamma + ChatGPT feel).

## Files Modified
- **Edited only** `src/components/views/ai-tools.tsx`. Foundation files (store.ts, ai.ts, pdf.ts, shared.tsx, curriculum.ts, ui/*) untouched.

## What changed

### 1. Imports extended
- Added Lucide icons: `FileText`, `Layout`, `Palette`, `Settings2`, `History`, `RotateCcw`, `Maximize2`, `Minimize2`
- Added shadcn components: `Switch` (from `@/components/ui/switch`), `Collapsible` + `CollapsibleContent` (from `@/components/ui/collapsible`)

### 2. ToolMeta interface extended
- Added `highlight?: boolean` and `badge?: string` fields.

### 3. TOOLS array — AI PDF Studio inserted at position 0
```ts
{ id: "ai-pdf-studio", name: "AI PDF Studio",
  blurb: "Turn a single prompt into a stunning, publication-ready PDF — Canva + Notion + AI for students.",
  icon: FileText, accent: "#f43f5e", gradient: "from-rose-500 to-orange-500",
  highlight: true, badge: "FLAGSHIP" }
```

### 4. ToolContent router — added `case "ai-pdf-studio": return <AIPDFStudio />;` as the first case.

### 5. AIPDFStudio component (the big one — ~556 lines) inserted before the router
Builds all 8 features requested:

**A. Prompt input** — 5-row `<Textarea>` with the exact requested placeholder. Below it, 10 example prompt chips (`EXAMPLE_PROMPTS`) that fill the input on click — Biology revision guide, aesthetic Chemistry notes, exam crash course, study planner, Formula Handbook, Research Report, colorful Geography guide, handwritten-style History notes, Minimalist Maths booklet, AI Workbook.

**B. Configuration panel** — Radix `Collapsible`. 8 selects + 1 switch:
- Document Type (27 options: Revision Notes → Newsletter)
- Writing Style (9: Academic → Detailed)
- Difficulty (5: Primary → Competitive Exams)
- Length (5: One Page → Unlimited)
- Tone (5: Formal → Modern)
- Template (20: Modern Glass → Interactive Workbook)
- Page Size (3: A4, Letter, A3)
- AI Visuals Switch

**C. Generate button** — "Generate Document" with Sparkles icon, rose→orange gradient. On click calls `askAI(prompt, "chapter-builder")` with a comprehensive prompt that includes user prompt + all config. Loading state cycles through 4 stages (`PROGRESS_STAGES = ["Designing layout…", "Writing content…", "Adding visuals…", "Polishing…"]`) every 2.2s, with a progress bar that animates 25%→50%→75%→100% and a 4-segment stage indicator.

**D. Live preview** — `splitIntoPages()` helper splits markdown into page-sized chunks (either by `---` horizontal rules or by grouping 3 H1/H2 sections / 1200+ chars). Each page renders inside a `.pdf-page` styled div (white background, dark serif text, 720px max-width, 6px rose→orange left accent stripe, premium box shadow). Page breaks visualized with `.pdf-page-divider` ("— page break —"). Stats strip shows page count + word count + template + page size.

**E. Enhancement actions** — 11 one-click AI buttons in a horizontal wrap: Make more aesthetic, Simplify, Add examples, Add diagrams, Add practice questions, Add flashcards, Add mnemonics, Add summaries, Improve layout, Reduce pages, Expand content. Each maps to a detailed instruction in `ENHANCE_INSTRUCTIONS` and calls `askAI` with current doc + instruction, then replaces preview. Only the clicked button shows a spinner; others are disabled.

**F. Export controls** — 4 buttons in a 2×2 / 4-col grid:
- **Export PDF** → `exportPDF({title, subtitle, bodyHtml: mdToHtml(doc), accent: "#f43f5e"})`
- **Copy MD** → `navigator.clipboard.writeText(doc)`
- **To Files** → toast ("Saved to Files") + `pushActivity`
- **History** → toggles the version history panel

**G. Version history** — Every generation + enhancement saved to `localStorage["pdf-studio-history"]` (max 30 entries). Renders as a `ScrollArea` (max-h-72) of version rows: icon (★ for generate, ✦ for enhance), first-line preview (truncated 60 chars), relative time (`just now`, `5m ago`, `2h ago`, or DD Mon), kind/label. Each row has a `RotateCcw` restore button. First row gets a green "LATEST" badge. "Clear all" link wipes the history.

**H. Templates gallery** — Collapsible "Browse Templates (20)" section. Each of the 20 templates is rendered as a 80px-tall button with its own CSS gradient/pattern background (defined in `TEMPLATE_THUMBS` — 20 unique gradients including Aurora, Cyberpunk, Notebook lines, Newspaper columns, Luxury Black gold, etc.). Active template gets rose border + scale + Check badge.

### 6. Flagship grid highlighting (both desktop right-panel list + mobile list)
Both grids now compute `const flagship = !!t.highlight && t.badge === "FLAGSHIP";` and conditionally apply:
- `ring-2 ring-rose-500/50` glowing rose border
- `bg-gradient-to-br from-rose-500/20 via-orange-500/15 to-rose-500/10` animated gradient bg
- `<motion.div>` overlay with `animate={{ opacity: [0.15, 0.4, 0.15] }}` for a subtle pulsing glow (3s loop)
- `<Badge>` in top-right corner: `bg-rose-500 text-white text-[9px] ★ FLAGSHIP`
- Otherwise the standard `bloom-glass` styling is preserved

### 7. Hero count updated
- Landing subtitle: "Ten specialised AI tools" → `{TOOLS.length} specialised AI tools` (now "11")
- Right-panel pill: "10 Tools" → `{TOOLS.length} Tools` (now "11 Tools")

## Design notes
- The tool-page parent already provides the video background + `bloom-glass-strong` container + `.tool-content` color overrides. AIPDFStudio respects this — uses white/white-70 text and white/5 backgrounds throughout.
- The PDF PREVIEW is the intentional contrast exception: pure white paper, dark serif text (Georgia), rose accent stripe. Premium feel.
- A scoped `<style>{PDF_STUDIO_CSS}</style>` is rendered inside the component. Uses `.tool-content .pdf-page .prose-neha <tag>` selectors (specificity 0,3,1 + `!important`) to override both the parent's `.tool-content` white-on-dark rules AND the global `.prose-neha` rules, ensuring headings render rose (#9f1239, #be123c, #c026d3), callout boxes render with rose-50 bg + rose-500 border, etc.

## Verification
- `bun run lint` → **0 errors, 0 warnings** (exit 0)
- `npx tsc --noEmit` → **0 errors in ai-tools.tsx** (only pre-existing errors in unrelated files: assignments.tsx, examples/, skills/)
- File grew from **1161 → 1974 lines** (+813 lines)
- AIPDFStudio component itself: ~556 lines
- Constants + helpers (`PDF_DOC_TYPES` through `genId`): ~208 lines

## Notes for future agents
- The `askAI(prompt, "chapter-builder")` persona is reused for both initial generation and enhancements — it's already optimized for document creation in the `/api/ai` route.
- `splitIntoPages` is heuristic — it prefers `---` horizontal rules (which the AI is encouraged to produce via the "Improve layout" enhancement), falling back to ~3 sections / 1200 chars per page.
- Version history is capped at 30 entries to keep localStorage bounded. Each entry stores the full markdown content (could grow large for "Twenty Pages" docs); if size becomes an issue, consider truncating stored content.
- The `pdf-studio-history` localStorage key is namespaced to avoid collision with the existing `aisig-history` from the AISIG tool.
