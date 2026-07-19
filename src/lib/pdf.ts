"use client";

// ============================================================================
// Scholar — Publication-grade PDF generator (Class 9 / Class 11 aware)
// ----------------------------------------------------------------------------
// Produces magazine-quality PDFs via the browser print window ("Save as PDF").
// Features: full-bleed gradient cover, table of contents with dotted leaders,
// styled callouts (tip/warning/info/formula/example), branded tables, running
// headers/footers with page numbers, and auto-generated supporting sections
// (executive summary, key takeaways, FAQ, resources, conclusion).
//
// Dedicated exporters:
//   • exportPDF            — single document (reports, notes, summaries)
//   • exportStudyPackPDF   — multi-chapter study pack
//   • exportQuizReportPDF  — quiz score + question breakdown
//   • exportAnalyticsPDF   — stat cards + CSS bar charts + insights
//
// The print-optimised CSS uses CSS Paged Media (`@page` margin boxes) for
// running headers/footers and the built-in `page` counter for page numbers.
// ============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocType = "report" | "notes" | "summary" | "generic";

export interface ExportPDFOpts {
  title: string;
  subtitle?: string;
  bodyHtml: string;
  accent?: string;
  author?: string;          // default derived from scholarClass
  className?: string;       // default derived from scholarClass
  brandName?: string;       // default derived from scholarClass ("Neha's Scholar" / "Ishan's Scholar")
  scholarClass?: 9 | 11;    // 9 by default (legacy callers)
  type?: DocType; // affects cover styling
}

export interface StudyPackChapter {
  title: string;
  content: string; // markdown
}

export interface StudyPackOpts {
  title: string;
  chapters: StudyPackChapter[];
  accent?: string;
  scholarClass?: 9 | 11;
}

export interface QuizQuestion {
  question: string;
  yourAnswer: string;
  correctAnswer: string;
  correct: boolean;
  explanation?: string;
}

export interface QuizReportOpts {
  title: string;
  subject: string;
  score: number;
  total: number;
  questions: QuizQuestion[];
  timeSpent?: number; // seconds
  scholarClass?: 9 | 11;
}

export interface AnalyticsStat {
  label: string;
  value: string;
}

export interface SubjectBreakdown {
  subject: string;
  mastery: number;
  score: number;
}

export interface AnalyticsOpts {
  title: string;
  stats: AnalyticsStat[];
  subjectBreakdown: SubjectBreakdown[];
  insights: string[];
  scholarClass?: 9 | 11;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDIGO = "#6366f1";
const TEAL = "#14b8a6";
const VIOLET = "#8b5cf6";
const AMBER = "#f59e0b";
const ROSE = "#f43f5e";
const EMERALD = "#10b981";

// ---------------------------------------------------------------------------
// Class-aware defaults — every PDF "knows" which profile produced it so the
// cover, branding, and supporting copy never leak across profiles.
// ---------------------------------------------------------------------------

interface ClassProfile {
  author: string;
  className: string;
  brandName: string;
  studentName: string;
  syllabus: string;     // e.g. "Class 9 CBSE"
}

const PROFILE_CLASS9: ClassProfile = {
  author: "Neha Salah",
  className: "Class 9 • CBSE",
  brandName: "Neha's Scholar",
  studentName: "Neha",
  syllabus: "CBSE Class 9",
};

const PROFILE_CLASS11: ClassProfile = {
  author: "Ishan",
  className: "Class 11 • CBSE (PCM + CS)",
  brandName: "Ishan's Scholar",
  studentName: "Ishan",
  syllabus: "CBSE Class 11",
};

function profileFor(scholarClass?: 9 | 11): ClassProfile {
  return scholarClass === 11 ? PROFILE_CLASS11 : PROFILE_CLASS9;
}

// Legacy constants — kept for backward compatibility with any caller that
// doesn't yet pass `scholarClass`. They default to Class 9.
const DEFAULT_AUTHOR = PROFILE_CLASS9.author;
const DEFAULT_CLASS = PROFILE_CLASS9.className;
const DEFAULT_BRAND = PROFILE_CLASS9.brandName;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function today(): string {
  return new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function escText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Escape a string for use inside a CSS `content: "..."` double-quoted string.
function escCssString(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\A ")
    .replace(/\r/g, "");
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function coverGradient(type: DocType, accent: string): string {
  switch (type) {
    case "notes":
      return `linear-gradient(135deg, ${TEAL} 0%, ${accent} 55%, ${VIOLET} 100%)`;
    case "summary":
      return `linear-gradient(135deg, ${VIOLET} 0%, ${accent} 55%, ${TEAL} 100%)`;
    case "report":
      return `linear-gradient(135deg, ${accent} 0%, ${VIOLET} 50%, ${TEAL} 100%)`;
    case "generic":
    default:
      return `linear-gradient(135deg, ${accent} 0%, ${VIOLET} 55%, ${TEAL} 100%)`;
  }
}

function blockquoteLabel(kind: string): string {
  const map: Record<string, string> = {
    tip: "💡 Tip",
    warning: "⚠️ Warning",
    info: "ℹ️ Note",
    formula: "🧮 Formula",
    example: "📝 Example",
    note: "📌 Note",
    danger: "⛔ Important",
  };
  return map[kind] || "📌 Note";
}

// ---------------------------------------------------------------------------
// CSS theme
// ---------------------------------------------------------------------------

function themeCSS(opts: {
  accent: string;
  type: DocType;
  docTitle: string;
  dateStr: string;
  className: string;
  brandName?: string;
}): string {
  const { accent, type, docTitle, dateStr, className, brandName = DEFAULT_BRAND } = opts;
  const gradient = coverGradient(type, accent);
  const safeTitle = escCssString(docTitle);
  const safeDate = escCssString(dateStr);
  const safeClass = escCssString(className);
  const safeBrand = escCssString(brandName);

  return `
:root {
  --indigo: ${INDIGO};
  --teal: ${TEAL};
  --violet: ${VIOLET};
  --amber: ${AMBER};
  --rose: ${ROSE};
  --emerald: ${EMERALD};
  --ink: #18181b;
  --ink-2: #3f3f46;
  --muted: #71717a;
  --muted-2: #a1a1aa;
  --line: #e4e4e7;
  --line-2: #f4f4f5;
  --bg: #ffffff;
  --bg-soft: #fafafa;
  --accent: ${accent};
}

/* ----- Paged media: running header + footer + page numbers ----- */
@page {
  margin: 22mm 18mm 22mm;
  @top-left {
    content: "${safeTitle}";
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 8.5pt;
    color: #a1a1aa;
    vertical-align: bottom;
    padding-bottom: 3mm;
  }
  @top-right {
    content: "${safeBrand}";
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 8.5pt;
    color: ${accent};
    font-weight: 600;
    vertical-align: bottom;
    padding-bottom: 3mm;
  }
  @bottom-left {
    content: "${safeDate}";
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 8pt;
    color: #a1a1aa;
    vertical-align: top;
    padding-top: 3mm;
  }
  @bottom-center {
    content: counter(page);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 9.5pt;
    color: ${accent};
    font-weight: 700;
    vertical-align: top;
    padding-top: 3mm;
  }
  @bottom-right {
    content: "${safeClass}";
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 8pt;
    color: #a1a1aa;
    vertical-align: top;
    padding-top: 3mm;
  }
}

/* Cover page: full-bleed, no margins, no header/footer */
@page :first {
  margin: 0;
  @top-left { content: ""; }
  @top-right { content: ""; }
  @bottom-left { content: ""; }
  @bottom-center { content: ""; }
  @bottom-right { content: ""; }
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #27272a;
  line-height: 1.7;
  font-size: 11pt;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ---------- Cover ---------- */
.cover {
  position: relative;
  min-height: 100vh;
  background: ${gradient};
  color: #fff;
  padding: 26mm 22mm;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cover::before {
  content: "";
  position: absolute;
  top: -18%;
  right: -12%;
  width: 60vh;
  height: 60vh;
  background: radial-gradient(circle, rgba(255,255,255,0.20), transparent 65%);
  border-radius: 50%;
  pointer-events: none;
}
.cover::after {
  content: "";
  position: absolute;
  bottom: -22%;
  left: -12%;
  width: 55vh;
  height: 55vh;
  background: radial-gradient(circle, rgba(255,255,255,0.14), transparent 65%);
  border-radius: 50%;
  pointer-events: none;
}
.cover-watermark {
  position: absolute;
  right: -4vh;
  bottom: -6vh;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 60vh;
  font-weight: 700;
  color: rgba(255,255,255,0.07);
  line-height: 0.8;
  pointer-events: none;
  user-select: none;
}
.cover-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 2;
}
.cover-logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255,255,255,0.20);
  display: grid;
  place-items: center;
  font-family: Georgia, serif;
  font-weight: 700;
  font-size: 22px;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.35);
}
.cover-brand-text {
  font-size: 11pt;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 600;
  opacity: 0.94;
}
.cover-spacer { flex: 1; min-height: 20mm; }
.cover-eyebrow {
  position: relative;
  z-index: 2;
  display: inline-block;
  padding: 6px 14px;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.35);
  border-radius: 999px;
  font-size: 9pt;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 18px;
  width: fit-content;
}
.cover-title {
  position: relative;
  z-index: 2;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 44pt;
  font-weight: 700;
  line-height: 1.06;
  letter-spacing: -0.01em;
  margin: 0 0 16px;
  text-shadow: 0 2px 14px rgba(0,0,0,0.20);
}
.cover-subtitle {
  position: relative;
  z-index: 2;
  font-size: 14pt;
  font-weight: 400;
  opacity: 0.94;
  margin: 0 0 26px;
  max-width: 80%;
  line-height: 1.45;
}
.cover-rule {
  position: relative;
  z-index: 2;
  width: 80px;
  height: 4px;
  background: rgba(255,255,255,0.9);
  border-radius: 2px;
  margin-bottom: 22px;
}
.cover-meta {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 36px;
  margin-top: auto;
  padding-top: 22px;
  border-top: 1px solid rgba(255,255,255,0.28);
}
.cover-meta-item .label {
  font-size: 8pt;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  opacity: 0.80;
  margin-bottom: 4px;
}
.cover-meta-item .value {
  font-size: 13pt;
  font-weight: 600;
  font-family: Georgia, serif;
}

/* ---------- Sections ---------- */
.section { page-break-before: always; }
.section-eyebrow {
  font-size: 9pt;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 700;
  color: ${accent};
  margin-bottom: 6px;
}
h1.section-title {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 24pt;
  color: var(--ink);
  margin: 0 0 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
h2 {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 17pt;
  color: var(--ink);
  margin: 24px 0 10px;
  font-weight: 700;
  padding-bottom: 6px;
  border-bottom: 2px solid ${accent};
}
h3 {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 13.5pt;
  color: var(--ink-2);
  margin: 16px 0 6px;
  font-weight: 700;
}
h4 {
  font-family: Inter, sans-serif;
  font-size: 11pt;
  color: var(--ink-2);
  margin: 12px 0 4px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
p { margin: 0 0 10px; }
ul, ol { margin: 8px 0 12px; padding-left: 22px; }
li { margin: 4px 0; }
strong { color: var(--ink); font-weight: 700; }
em { color: var(--ink-2); }
a { color: ${accent}; text-decoration: none; border-bottom: 1px dotted ${accent}; }

/* ---------- Table of contents ---------- */
.toc { list-style: none; padding: 0; margin: 0; }
.toc-item {
  display: flex;
  align-items: baseline;
  padding: 9px 0;
  border-bottom: 1px dashed var(--line);
  font-size: 11.5pt;
}
.toc-num {
  font-family: Georgia, serif;
  font-weight: 700;
  color: ${accent};
  width: 36px;
  flex-shrink: 0;
}
.toc-title { color: var(--ink); font-weight: 500; }
.toc-sub {
  display: flex;
  align-items: baseline;
  padding: 5px 0 5px 36px;
  font-size: 10.5pt;
  color: var(--ink-2);
  border-bottom: 1px dotted var(--line-2);
}
.toc-sub .toc-num { color: var(--muted); width: 36px; font-size: 10pt; }
.toc-sub .toc-title { color: var(--ink-2); font-weight: 400; }
.toc-leader {
  flex: 1;
  border-bottom: 1px dotted var(--muted-2);
  margin: 0 8px;
  position: relative;
  top: -3px;
}
.toc-page {
  font-family: Georgia, serif;
  font-weight: 700;
  color: var(--muted);
  font-size: 10.5pt;
  min-width: 32px;
  text-align: right;
}

/* ---------- Callouts ---------- */
.callout {
  margin: 14px 0;
  padding: 12px 16px;
  border-radius: 10px;
  border-left: 4px solid;
  page-break-inside: avoid;
}
.callout-label {
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.callout-body { font-size: 10.5pt; line-height: 1.6; }
.callout-body p:last-child { margin-bottom: 0; }
.callout-tip     { background: #ecfdf5; border-color: ${TEAL}; }
.callout-tip .callout-label     { color: #0f766e; }
.callout-warning { background: #fffbeb; border-color: ${AMBER}; }
.callout-warning .callout-label { color: #b45309; }
.callout-info    { background: #eef2ff; border-color: ${INDIGO}; }
.callout-info .callout-label    { color: #4338ca; }
.callout-formula { background: #f5f3ff; border-color: ${VIOLET}; }
.callout-formula .callout-label { color: #6d28d9; }
.callout-formula .callout-body  { font-family: "JetBrains Mono", "SF Mono", Menlo, monospace; font-size: 10.5pt; }
.callout-example { background: #fff7ed; border-color: #fb923c; }
.callout-example .callout-label { color: #c2410c; }
.callout-danger  { background: #fef2f2; border-color: ${ROSE}; }
.callout-danger .callout-label  { color: #b91c1c; }
.callout-note    { background: #f0f9ff; border-color: #0ea5e9; }
.callout-note .callout-label    { color: #0369a1; }

/* ---------- Tables ---------- */
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 14px 0;
  font-size: 10.5pt;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 0 1px var(--line);
  page-break-inside: avoid;
}
thead th {
  background: linear-gradient(135deg, ${accent}, ${TEAL});
  color: #fff;
  padding: 9px 12px;
  text-align: left;
  font-weight: 600;
  font-size: 10pt;
  letter-spacing: 0.03em;
}
tbody td {
  padding: 8px 12px;
  border-top: 1px solid var(--line-2);
  color: #27272a;
}
tbody tr:nth-child(even) td { background: #fafafa; }
tbody tr:nth-child(odd) td  { background: #fff; }

/* ---------- Code ---------- */
code {
  background: #f4f4f5;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: "JetBrains Mono", "SF Mono", Menlo, monospace;
  font-size: 10pt;
  color: #be185d;
}
pre {
  background: #18181b;
  color: #f4f4f5;
  padding: 14px 16px;
  border-radius: 10px;
  overflow-x: auto;
  font-family: "JetBrains Mono", "SF Mono", Menlo, monospace;
  font-size: 10pt;
  line-height: 1.5;
  margin: 12px 0;
  page-break-inside: avoid;
}
pre code { background: transparent; color: inherit; padding: 0; }

/* ---------- Blockquote ---------- */
blockquote {
  border-left: 4px solid ${accent};
  background: linear-gradient(90deg, ${accent}11, transparent);
  margin: 12px 0;
  padding: 10px 16px;
  color: var(--ink-2);
  font-style: italic;
  border-radius: 0 8px 8px 0;
}

/* ---------- Divider ---------- */
hr.divider, .divider {
  height: 2px;
  background: linear-gradient(90deg, transparent, ${accent}, ${TEAL}, transparent);
  margin: 26px 0;
  border: 0;
  border-radius: 1px;
}

/* ---------- Pills ---------- */
.pill {
  display: inline-block;
  background: ${accent}1a;
  color: ${accent};
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 9pt;
  font-weight: 600;
  letter-spacing: 0.03em;
}

/* ---------- Takeaways ---------- */
.takeaway-list { list-style: none; padding: 0; margin: 0; }
.takeaway-list li {
  position: relative;
  padding: 11px 14px 11px 40px;
  margin: 8px 0;
  background: #fafafa;
  border-radius: 8px;
  border-left: 3px solid ${accent};
  font-size: 11pt;
  page-break-inside: avoid;
}
.takeaway-list li::before {
  content: "✦";
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: ${accent};
  font-size: 14pt;
  font-weight: 700;
}

/* ---------- FAQ ---------- */
.faq-item {
  margin: 12px 0;
  page-break-inside: avoid;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.faq-q {
  background: linear-gradient(135deg, ${accent}14, ${TEAL}14);
  padding: 10px 14px;
  font-weight: 700;
  color: var(--ink);
  font-size: 11pt;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.faq-q .q-mark {
  font-family: Georgia, serif;
  color: ${accent};
  font-size: 13pt;
  line-height: 1.2;
  flex-shrink: 0;
  font-weight: 700;
}
.faq-a {
  padding: 10px 14px;
  color: var(--ink-2);
  font-size: 10.5pt;
  line-height: 1.65;
}

/* ---------- Resources ---------- */
.resource-list { list-style: none; padding: 0; margin: 0; }
.resource-list li {
  padding: 10px 14px;
  margin: 6px 0;
  background: #fafafa;
  border-radius: 8px;
  border-left: 3px solid ${TEAL};
  font-size: 10.5pt;
  page-break-inside: avoid;
}
.resource-list li strong { color: var(--ink); }

/* ---------- Quiz report ---------- */
.score-card {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin: 16px 0 18px;
}
.score-tile {
  background: linear-gradient(135deg, ${accent}0f, ${TEAL}0f);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}
.score-tile .num {
  font-family: Georgia, serif;
  font-size: 26pt;
  font-weight: 700;
  color: ${accent};
  line-height: 1.05;
}
.score-tile .num.small { font-size: 16pt; }
.score-tile .lbl {
  font-size: 9pt;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-top: 6px;
  font-weight: 600;
}
.score-bar {
  height: 12px;
  background: var(--line-2);
  border-radius: 999px;
  overflow: hidden;
  margin: 12px 0 4px;
}
.score-bar > div {
  height: 100%;
  background: linear-gradient(90deg, ${accent}, ${TEAL});
  border-radius: 999px;
}
.qrow {
  display: grid;
  grid-template-columns: 28px 1fr 110px;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  margin: 8px 0;
  font-size: 10.5pt;
  page-break-inside: avoid;
}
.qrow.wrong { background: #fef2f2; border-color: #fecaca; }
.qrow.right { background: #f0fdf4; border-color: #bbf7d0; }
.qrow .qnum {
  font-family: Georgia, serif;
  font-weight: 700;
  color: ${accent};
  text-align: center;
}
.qrow .qstatus {
  font-weight: 700;
  font-size: 9pt;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: right;
  align-self: start;
}
.qrow.right .qstatus { color: #15803d; }
.qrow.wrong .qstatus { color: #b91c1c; }

/* ---------- Analytics ---------- */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 14px 0 22px;
}
.stat-tile {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #fff, ${accent}08);
  page-break-inside: avoid;
}
.stat-tile .v {
  font-family: Georgia, serif;
  font-size: 22pt;
  font-weight: 700;
  color: ${accent};
  line-height: 1.1;
}
.stat-tile .l {
  font-size: 9pt;
  color: var(--muted);
  margin-top: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.bar-row { margin: 12px 0; page-break-inside: avoid; }
.bar-row .bar-head {
  display: flex;
  justify-content: space-between;
  font-size: 10.5pt;
  margin-bottom: 4px;
}
.bar-row .bar-head .name { font-weight: 600; color: var(--ink); }
.bar-row .bar-head .val { font-family: Georgia, serif; color: ${accent}; font-weight: 700; }
.bar-track {
  height: 14px;
  background: var(--line-2);
  border-radius: 999px;
  overflow: hidden;
  position: relative;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, ${accent}, ${TEAL});
  border-radius: 999px;
}
.insight-list { list-style: none; padding: 0; margin: 0; }
.insight-list li {
  padding: 11px 14px 11px 38px;
  margin: 6px 0;
  background: #fffbeb;
  border-radius: 8px;
  border-left: 3px solid ${AMBER};
  font-size: 10.5pt;
  position: relative;
  page-break-inside: avoid;
}
.insight-list li::before {
  content: "💡";
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
}

/* ---------- Print optimizations ---------- */
@media print {
  .no-print { display: none !important; }
  a { color: inherit; text-decoration: none; border-bottom: 0; }
  .callout, .faq-item, .qrow, table, pre, blockquote, .bar-row, .stat-tile, .score-tile, .takeaway-list li { break-inside: avoid; }
}

/* ---------- Screen preview ---------- */
@media screen {
  body { background: #f4f4f5; padding: 24px; }
  .cover, .section {
    max-width: 210mm;
    margin: 0 auto 18px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.10);
  }
  .cover { min-height: 297mm; border-radius: 4px; }
  .section { padding: 22mm 18mm; border-radius: 4px; background: #fff; }
  .print-hint {
    position: fixed; top: 14px; right: 14px;
    background: #18181b; color: #fff;
    padding: 8px 14px; border-radius: 999px;
    font-size: 11px; font-family: Inter, sans-serif;
    z-index: 9999;
  }
}
`;
}

// ---------------------------------------------------------------------------
// Cover HTML
// ---------------------------------------------------------------------------

function coverHTML(opts: {
  title: string;
  subtitle?: string;
  author: string;
  className: string;
  dateStr: string;
  type: DocType;
  brandName?: string;
}): string {
  const { title, subtitle, author, className, dateStr, type, brandName = DEFAULT_BRAND } = opts;
  const eyebrowMap: Record<DocType, string> = {
    report: "Study Report",
    notes: "Revision Notes",
    summary: "Chapter Summary",
    generic: "Study Material",
  };
  const eyebrow = eyebrowMap[type];
  const initial = brandName.charAt(0);
  return `
<section class="cover">
  <div class="cover-watermark">${initial}</div>
  <div class="cover-brand">
    <div class="cover-logo">${initial}</div>
    <div class="cover-brand-text">${escText(brandName)}</div>
  </div>
  <div class="cover-spacer"></div>
  <div class="cover-eyebrow">${escText(eyebrow)}</div>
  <h1 class="cover-title">${escText(title)}</h1>
  ${subtitle ? `<p class="cover-subtitle">${escText(subtitle)}</p>` : ""}
  <div class="cover-rule"></div>
  <div class="cover-meta">
    <div class="cover-meta-item">
      <div class="label">Prepared for</div>
      <div class="value">${escText(author)}</div>
    </div>
    <div class="cover-meta-item">
      <div class="label">Class</div>
      <div class="value">${escText(className)}</div>
    </div>
    <div class="cover-meta-item">
      <div class="label">Date</div>
      <div class="value">${escText(dateStr)}</div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Content extraction helpers
// ---------------------------------------------------------------------------

function extractH2s(html: string): string[] {
  const matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)];
  return matches
    .map((m) => stripHtml(m[1]))
    .filter((s) => s.trim().length > 0)
    .slice(0, 8);
}

function extractLis(html: string): string[] {
  const matches = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  return matches
    .map((m) => stripHtml(m[1]))
    .filter((s) => s.trim().length > 0);
}

function extractFirstParagraph(html: string): string {
  const m = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
  if (m) return stripHtml(m[1]);
  return stripHtml(html).slice(0, 320);
}

// ---------------------------------------------------------------------------
// Auto-generated section builders — every builder receives the active
// ClassProfile so its copy (brand name, class label, student name) always
// matches the profile that produced the PDF.
// ---------------------------------------------------------------------------

function execSummaryHTML(bodyHtml: string, title: string, profile: ClassProfile): string {
  const firstP = extractFirstParagraph(bodyHtml);
  const text =
    firstP.length > 0
      ? firstP
      : `This document presents ${title}, curated and organised by ${profile.brandName} for ${profile.syllabus}.`;
  const summary = text.length > 340 ? text.slice(0, 340).trim() + "…" : text;
  return `
<p>${escText(summary)}</p>
<p>This study material has been curated to align with the ${profile.syllabus} syllabus and is designed to strengthen conceptual understanding, support revision, and prepare for assessments. Each section builds on the previous one, moving from foundational ideas to worked examples and applied practice.</p>
<div class="callout callout-info">
  <div class="callout-label">ℹ️ How to use this document</div>
  <div class="callout-body"><p>Read the main content thoroughly, then revisit the Key Takeaways for quick revision. Attempt the FAQ section to self-test, and follow up with the resources listed at the end for deeper practice.</p></div>
</div>`;
}

function tocHTML(bodyHtml: string): string {
  const h2s = extractH2s(bodyHtml);
  const mainSections: { name: string; icon: string }[] = [
    { name: "Executive Summary", icon: "📖" },
    { name: "Table of Contents", icon: "📑" },
    { name: "Main Content", icon: "📚" },
    { name: "Key Takeaways", icon: "🎯" },
    { name: "Frequently Asked Questions", icon: "❓" },
    { name: "Resources & References", icon: "🔗" },
    { name: "Conclusion", icon: "✨" },
  ];
  let items = "";
  mainSections.forEach((s, i) => {
    items += `
<li class="toc-item">
  <span class="toc-num">${String(i + 1).padStart(2, "0")}</span>
  <span class="toc-title">${s.icon} ${escText(s.name)}</span>
  <span class="toc-leader"></span>
  <span class="toc-page">§${i + 1}</span>
</li>`;
    if (s.name === "Main Content" && h2s.length > 0) {
      h2s.forEach((h, j) => {
        items += `
<li class="toc-sub">
  <span class="toc-num">${i + 1}.${j + 1}</span>
  <span class="toc-title">${escText(h)}</span>
  <span class="toc-leader"></span>
  <span class="toc-page"></span>
</li>`;
      });
    }
  });
  return `<ul class="toc">${items}</ul>`;
}

function takeawaysHTML(bodyHtml: string, title: string, profile: ClassProfile): string {
  const lis = extractLis(bodyHtml).slice(0, 7);
  let items: string[];
  if (lis.length >= 3) {
    items = lis.map((l) => escText(l));
  } else {
    const short = title.length > 50 ? title.slice(0, 50) + "…" : title;
    items = [
      `Master the core concepts of ${short} as outlined in this document.`,
      `Apply the formulas and worked examples to ${profile.syllabus} problems.`,
      `Revise regularly using flashcards and practice quizzes in ${profile.brandName}.`,
      `Connect these ideas to related chapters for deeper, integrated understanding.`,
      `Track your progress in the analytics dashboard and revisit weak areas.`,
    ];
  }
  return `<ul class="takeaway-list">${items.map((it) => `<li>${it}</li>`).join("")}</ul>`;
}

function faqHTML(title: string, profile: ClassProfile): string {
  const short = title.length > 48 ? title.slice(0, 48) + "…" : title;
  const faqs = [
    {
      q: `What is the main focus of "${short}"?`,
      a: `This material focuses on the key concepts, formulas, and applications of ${short} as per the ${profile.syllabus} syllabus. It is structured to build understanding step by step, with examples and practice points throughout.`,
    },
    {
      q: `How should I revise this chapter effectively?`,
      a: `Start by reading the main content thoroughly, then review the Key Takeaways for a quick recap. Create flashcards for important terms, attempt the practice questions, and revisit any section that feels unclear after 24 hours to strengthen retention.`,
    },
    {
      q: `What are common mistakes to avoid?`,
      a: `Students often rush through definitions, skip worked examples, or memorise formulas without understanding their derivation. Take time to work through each example, verify your reasoning, and double-check units and signs in numerical answers.`,
    },
    {
      q: `How does this connect to other chapters?`,
      a: `The concepts here link to several other ${profile.syllabus} topics. Refer to the Resources & References section for related chapters, and use ${profile.brandName}'s mind map view to visualise connections across subjects.`,
    },
    {
      q: `Where can I practice more questions?`,
      a: `Use the Quiz view in ${profile.brandName} for subject-specific questions, explore the Exam Prep section for previous year patterns, and try the Formula Sheet for quick recall during revision sessions.`,
    },
  ];
  return faqs
    .map(
      (f) => `
<div class="faq-item">
  <div class="faq-q"><span class="q-mark">Q.</span><span>${escText(f.q)}</span></div>
  <div class="faq-a">${escText(f.a)}</div>
</div>`,
    )
    .join("");
}

function resourcesHTML(_title: string, profile: ClassProfile): string {
  const classNum = profile === PROFILE_CLASS11 ? 11 : 9;
  const items = [
    {
      name: `NCERT Class ${classNum} Textbook`,
      desc: "Primary reference for concepts, examples, and exercises aligned to the CBSE syllabus.",
    },
    {
      name: "NCERT Exemplar Problems",
      desc: "Higher-order thinking questions to test deep conceptual understanding.",
    },
    {
      name: "Diksha Portal",
      desc: "Free concept videos and interactive lessons from the Ministry of Education.",
    },
    {
      name: `${profile.brandName} — Quiz View`,
      desc: "Attempt chapter-wise quizzes to test your mastery and track accuracy.",
    },
    {
      name: `${profile.brandName} — Flashcards`,
      desc: "Spaced-repetition decks for active recall of key terms and definitions.",
    },
    {
      name: `${profile.brandName} — Mind Map`,
      desc: "Visualise how this chapter connects to related concepts across subjects.",
    },
  ];
  return `<ul class="resource-list">
    ${items.map((it) => `<li><strong>${escText(it.name)}.</strong> ${escText(it.desc)}</li>`).join("")}
  </ul>
  <p style="margin-top:16px;color:var(--muted);font-size:10pt;font-style:italic;">Generated by ${profile.brandName} — a premium study OS for ${profile.syllabus}.</p>`;
}

function conclusionHTML(title: string, profile: ClassProfile): string {
  const short = title.length > 60 ? title.slice(0, 60) + "…" : title;
  return `
<p>${escText(short)} is an important part of the ${profile.syllabus} curriculum, and mastering it lays a strong foundation for board examinations and senior secondary studies. By combining conceptual clarity with regular practice, ${profile.studentName} can approach this topic with confidence and consistency.</p>
<p>This document has summarised the key ideas, provided structured takeaways, and pointed to further resources. Continue to revisit this material, attempt quizzes in the app, and use the analytics dashboard to identify areas that need more attention. Consistent, mindful study — even 25 focused minutes a day — produces remarkable results over time.</p>
<div class="callout callout-tip">
  <div class="callout-label">💡 Final Note</div>
  <div class="callout-body"><p>You've got this, ${profile.studentName}. Keep going — one chapter at a time.</p></div>
</div>`;
}

// ---------------------------------------------------------------------------
// Print window helper
// ---------------------------------------------------------------------------

function openPrintWindow(html: string): void {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Please allow popups to export the PDF.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function htmlShell(opts: {
  title: string;
  css: string;
  body: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escAttr(opts.title)}</title>
<style>${opts.css}</style>
</head>
<body>
<div class="no-print print-hint">Press Ctrl/Cmd+P · Choose "Save as PDF"</div>
${opts.body}
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API: exportPDF
// ---------------------------------------------------------------------------

export function exportPDF(opts: ExportPDFOpts): void {
  const profile = profileFor(opts.scholarClass);
  const {
    title,
    subtitle,
    bodyHtml,
    accent = INDIGO,
    author = profile.author,
    className = profile.className,
    brandName = profile.brandName,
    type = "generic",
  } = opts;

  const dateStr = today();
  const css = themeCSS({ accent, type, docTitle: title, dateStr, className, brandName });
  const cover = coverHTML({ title, subtitle, author, className, dateStr, type, brandName });
  const summary = execSummaryHTML(bodyHtml, title, profile);
  const toc = tocHTML(bodyHtml);
  const takeaways = takeawaysHTML(bodyHtml, title, profile);
  const faq = faqHTML(title, profile);
  const resources = resourcesHTML(title, profile);
  const conclusion = conclusionHTML(title, profile);

  const body = `
${cover}
<section class="section">
  <div class="section-eyebrow">📖 Introduction</div>
  <h1 class="section-title">Executive Summary</h1>
  ${summary}
</section>
<section class="section">
  <div class="section-eyebrow">📑 Contents</div>
  <h1 class="section-title">Table of Contents</h1>
  ${toc}
</section>
<section class="section">
  <div class="section-eyebrow">📚 Main Content</div>
  <h1 class="section-title">${escText(title)}</h1>
  ${bodyHtml}
</section>
<section class="section">
  <div class="section-eyebrow">🎯 Revision</div>
  <h1 class="section-title">Key Takeaways</h1>
  <p style="color:var(--muted);font-size:10.5pt;margin-bottom:14px;">A condensed summary of the most important points from this document — perfect for last-minute revision.</p>
  ${takeaways}
</section>
<section class="section">
  <div class="section-eyebrow">❓ Self-Test</div>
  <h1 class="section-title">Frequently Asked Questions</h1>
  ${faq}
</section>
<section class="section">
  <div class="section-eyebrow">🔗 Learn More</div>
  <h1 class="section-title">Resources &amp; References</h1>
  ${resources}
</section>
<section class="section">
  <div class="section-eyebrow">✨ Wrap-Up</div>
  <h1 class="section-title">Conclusion</h1>
  ${conclusion}
</section>`;

  openPrintWindow(htmlShell({ title, css, body }));
}

// ---------------------------------------------------------------------------
// Public API: exportStudyPackPDF
// ---------------------------------------------------------------------------

export function exportStudyPackPDF(opts: StudyPackOpts): void {
  const profile = profileFor(opts.scholarClass);
  const { title, chapters, accent = INDIGO } = opts;
  const dateStr = today();
  const css = themeCSS({
    accent,
    type: "report",
    docTitle: title,
    dateStr,
    className: profile.className,
    brandName: profile.brandName,
  });
  const cover = coverHTML({
    title,
    subtitle: `${chapters.length} chapters · ${profile.syllabus} Study Pack`,
    author: profile.author,
    className: profile.className,
    dateStr,
    type: "report",
    brandName: profile.brandName,
  });

  // TOC
  let tocItems = "";
  chapters.forEach((c, i) => {
    tocItems += `
<li class="toc-item">
  <span class="toc-num">${String(i + 1).padStart(2, "0")}</span>
  <span class="toc-title">📚 ${escText(c.title)}</span>
  <span class="toc-leader"></span>
  <span class="toc-page">§${i + 1}</span>
</li>`;
  });
  const toc = `<ul class="toc">${tocItems}</ul>`;

  // Chapters
  const chaptersHtml = chapters
    .map(
      (c, i) => `
<section class="section">
  <div class="section-eyebrow">Chapter ${String(i + 1).padStart(2, "0")}</div>
  <h1 class="section-title">${escText(c.title)}</h1>
  ${mdToHtml(c.content)}
</section>`,
    )
    .join("");

  // Closing
  const closing = `
<section class="section">
  <div class="section-eyebrow">✨ Wrap-Up</div>
  <h1 class="section-title">Conclusion</h1>
  ${conclusionHTML(title, profile)}
</section>`;

  const body = `
${cover}
<section class="section">
  <div class="section-eyebrow">📑 Contents</div>
  <h1 class="section-title">Table of Contents</h1>
  ${toc}
</section>
${chaptersHtml}
${closing}`;

  openPrintWindow(htmlShell({ title, css, body }));
}

// ---------------------------------------------------------------------------
// Public API: exportQuizReportPDF
// ---------------------------------------------------------------------------

export function exportQuizReportPDF(opts: QuizReportOpts): void {
  const profile = profileFor(opts.scholarClass);
  const { title, subject, score, total, questions, timeSpent } = opts;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const accent = pct >= 80 ? EMERALD : pct >= 50 ? AMBER : ROSE;
  const dateStr = today();
  const css = themeCSS({
    accent,
    type: "report",
    docTitle: title,
    dateStr,
    className: profile.className,
    brandName: profile.brandName,
  });
  const cover = coverHTML({
    title,
    subtitle: `${subject} · Quiz Report`,
    author: profile.author,
    className: profile.className,
    dateStr,
    type: "report",
    brandName: profile.brandName,
  });

  const correctCount = questions.filter((q) => q.correct).length;
  const wrongCount = questions.length - correctCount;
  const mins = timeSpent ? Math.floor(timeSpent / 60) : 0;
  const secs = timeSpent ? timeSpent % 60 : 0;
  const timeStr = timeSpent ? `${mins}m ${secs}s` : "—";

  const grade =
    pct >= 90
      ? "Outstanding"
      : pct >= 75
        ? "Excellent"
        : pct >= 60
          ? "Good"
          : pct >= 40
            ? "Needs Practice"
            : "Keep Trying";

  const analysis =
    pct >= 75
      ? "Strong performance across the quiz. You've demonstrated solid understanding of the material. To push further, tackle a few advanced problems and try timed practice to build speed."
      : pct >= 50
        ? "A decent attempt. Review the questions you missed and re-read the related concepts before retaking. Focus on understanding why the correct answers are right, not just memorising them."
        : "This topic needs more attention. Revisit the chapter, work through the examples step by step, and try again after focused revision. Don't get discouraged — every expert started here.";

  const qrows = questions
    .map(
      (q, i) => `
<div class="qrow ${q.correct ? "right" : "wrong"}">
  <div class="qnum">${i + 1}</div>
  <div>
    <div style="font-weight:600;margin-bottom:4px;">${escText(q.question)}</div>
    <div style="font-size:10pt;color:var(--muted);">Your answer: <strong style="color:${q.correct ? "#15803d" : "#b91c1c"}">${escText(q.yourAnswer || "—")}</strong></div>
    ${!q.correct ? `<div style="font-size:10pt;color:var(--muted);">Correct answer: <strong style="color:#15803d">${escText(q.correctAnswer)}</strong></div>` : ""}
    ${q.explanation ? `<div style="font-size:10pt;color:var(--ink-2);margin-top:4px;font-style:italic;">${escText(q.explanation)}</div>` : ""}
  </div>
  <div class="qstatus">${q.correct ? "✓ Correct" : "✗ Wrong"}</div>
</div>`,
    )
    .join("");

  const body = `
${cover}
<section class="section">
  <div class="section-eyebrow">📊 Performance Summary</div>
  <h1 class="section-title">Score Summary</h1>
  <div class="score-card">
    <div class="score-tile"><div class="num">${score}/${total}</div><div class="lbl">Score</div></div>
    <div class="score-tile"><div class="num">${pct}%</div><div class="lbl">Accuracy</div></div>
    <div class="score-tile"><div class="num small">${grade}</div><div class="lbl">Grade</div></div>
  </div>
  <div class="score-bar"><div style="width:${pct}%"></div></div>
  <p style="font-size:10pt;color:var(--muted);margin-top:8px;">${correctCount} correct · ${wrongCount} incorrect · Time: ${timeStr}</p>
  <div class="callout callout-info">
    <div class="callout-label">📈 Performance Analysis</div>
    <div class="callout-body"><p>${escText(analysis)}</p></div>
  </div>
</section>
<section class="section">
  <div class="section-eyebrow">📝 Question Review</div>
  <h1 class="section-title">Question-by-Question Breakdown</h1>
  <p style="color:var(--muted);font-size:10.5pt;margin-bottom:14px;">Review each question below. Green rows are correct; red rows need another look.</p>
  ${qrows}
</section>`;

  openPrintWindow(htmlShell({ title, css, body }));
}

// ---------------------------------------------------------------------------
// Public API: exportAnalyticsPDF
// ---------------------------------------------------------------------------

export function exportAnalyticsPDF(opts: AnalyticsOpts): void {
  const profile = profileFor(opts.scholarClass);
  const { title, stats, subjectBreakdown, insights } = opts;
  const accent = TEAL;
  const dateStr = today();
  const css = themeCSS({
    accent,
    type: "report",
    docTitle: title,
    dateStr,
    className: profile.className,
    brandName: profile.brandName,
  });
  const cover = coverHTML({
    title,
    subtitle: "Learning Analytics Report",
    author: profile.author,
    className: profile.className,
    dateStr,
    type: "report",
    brandName: profile.brandName,
  });

  const statTiles = stats
    .map(
      (s) => `
<div class="stat-tile">
  <div class="v">${escText(s.value)}</div>
  <div class="l">${escText(s.label)}</div>
</div>`,
    )
    .join("");

  const maxMastery = Math.max(100, ...subjectBreakdown.map((s) => s.mastery));
  const bars = subjectBreakdown
    .map((s) => {
      const w = Math.round((s.mastery / maxMastery) * 100);
      return `
<div class="bar-row">
  <div class="bar-head"><span class="name">${escText(s.subject)}</span><span class="val">${s.mastery}% mastery · ${s.score}% quiz</span></div>
  <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
</div>`;
    })
    .join("");

  const insightList =
    insights.length > 0
      ? insights.map((i) => `<li>${escText(i)}</li>`).join("")
      : `<li>Continue your daily study streak to maintain momentum.</li>`;

  const body = `
${cover}
<section class="section">
  <div class="section-eyebrow">📊 Overview</div>
  <h1 class="section-title">Statistics</h1>
  <p style="color:var(--muted);font-size:10.5pt;margin-bottom:14px;">A snapshot of your study activity and progress across all subjects.</p>
  <div class="stat-grid">${statTiles}</div>
</section>
<section class="section">
  <div class="section-eyebrow">🎓 Mastery</div>
  <h1 class="section-title">Subject Breakdown</h1>
  <p style="color:var(--muted);font-size:10.5pt;margin-bottom:14px;">Mastery level and average quiz score for each subject. Longer bars indicate stronger grasp.</p>
  ${bars || '<p style="color:var(--muted);">No subject data yet.</p>'}
</section>
<section class="section">
  <div class="section-eyebrow">💡 Recommendations</div>
  <h1 class="section-title">Insights &amp; Next Steps</h1>
  <ul class="insight-list">${insightList}</ul>
</section>`;

  openPrintWindow(htmlShell({ title, css, body }));
}

// ---------------------------------------------------------------------------
// Markdown → HTML converter (enhanced)
// ---------------------------------------------------------------------------
// Supports:
//   • Headings #, ##, ###, ####, #####, ######
//   • Bold **text**, italic *text*, inline code `code`, links [text](url)
//   • Unordered lists (-, *, +) and ordered lists (1.)
//   • Tables with | pipes (GitHub-style, with separator row)
//   • Fenced code blocks ```lang ... ```
//   • Horizontal rules ---, ***, ___
//   • Blockquotes > ...
//   • GitHub-style callouts: > [!TIP], > [!WARNING], > [!INFO], > [!FORMULA],
//     > [!EXAMPLE], > [!NOTE], > [!DANGER]
// ---------------------------------------------------------------------------

export function mdToHtml(md: string): string {
  const src = md.replace(/\r\n/g, "\n");
  const lines = src.split("\n");
  let html = "";
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let tableHasHeader = false;
  let tableHasBody = false;
  let inCode = false;
  let codeBuf: string[] = [];
  let bqBuf: string[] = [];
  let bqKind: string | null = null;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inline = (s: string) =>
    esc(s)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const closeLists = () => {
    if (inUl) {
      html += "</ul>";
      inUl = false;
    }
    if (inOl) {
      html += "</ol>";
      inOl = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      if (tableHasBody) html += "</tbody>";
      html += "</table>";
      inTable = false;
      tableHasHeader = false;
      tableHasBody = false;
    }
  };
  const closeCode = () => {
    if (inCode) {
      html += `<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`;
      codeBuf = [];
      inCode = false;
    }
  };
  const closeBq = () => {
    if (bqKind !== null) {
      const body = bqBuf.map(inline).join("<br/>");
      if (bqKind === "plain") {
        html += `<blockquote>${body}</blockquote>`;
      } else {
        const label = blockquoteLabel(bqKind);
        html += `<div class="callout callout-${bqKind}"><div class="callout-label">${label}</div><div class="callout-body"><p>${body}</p></div></div>`;
      }
      bqBuf = [];
      bqKind = null;
    }
  };

  for (const raw of lines) {
    const line = raw;

    // Fenced code block
    const fence = /^(\s*)(```|~~~)(.*)$/.exec(line);
    if (fence) {
      if (inCode) {
        closeCode();
      } else {
        closeLists();
        closeTable();
        closeBq();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    // Table row
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      closeLists();
      closeBq();
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^[-:\s]+$/.test(c))) {
        // separator row — header is done
        tableHasHeader = true;
        continue;
      }
      if (!inTable) {
        html += "<table>";
        inTable = true;
      }
      if (!tableHasHeader) {
        // first row treated as header
        html += `<thead><tr>${cells.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`;
        tableHasHeader = true;
      } else {
        if (!tableHasBody) {
          html += "<tbody>";
          tableHasBody = true;
        }
        html += `<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`;
      }
      continue;
    }
    closeTable();

    // Headings
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      closeLists();
      closeBq();
      const level = h[1].length;
      html += `<h${level}>${inline(h[2])}</h${level}>`;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      closeLists();
      closeBq();
      html += '<hr class="divider"/>';
      continue;
    }

    // Blockquote / callout
    if (line.startsWith(">")) {
      const content = line.replace(/^>\s?/, "");
      closeLists();
      const alertMatch = /^\[!(TIP|WARNING|INFO|FORMULA|EXAMPLE|NOTE|DANGER)\]\s*(.*)$/i.exec(
        content,
      );
      if (alertMatch) {
        // Start a new callout of this kind (close any existing one first)
        if (bqKind !== null) closeBq();
        bqKind = alertMatch[1].toLowerCase();
        if (alertMatch[2].trim()) bqBuf.push(alertMatch[2]);
      } else {
        if (bqKind === null) bqKind = "plain";
        if (content.trim()) bqBuf.push(content);
      }
      continue;
    }
    closeBq();

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      if (inOl) {
        html += "</ol>";
        inOl = false;
      }
      if (!inUl) {
        html += "<ul>";
        inUl = true;
      }
      html += `<li>${inline(line.replace(/^\s*[-*+]\s+/, ""))}</li>`;
      continue;
    }
    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      if (inUl) {
        html += "</ul>";
        inUl = false;
      }
      if (!inOl) {
        html += "<ol>";
        inOl = true;
      }
      html += `<li>${inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`;
      continue;
    }
    closeLists();

    // Empty line — paragraph break
    if (line.trim() === "") continue;

    html += `<p>${inline(line)}</p>`;
  }
  // Close any open structures
  closeCode();
  closeLists();
  closeTable();
  closeBq();
  return html;
}
