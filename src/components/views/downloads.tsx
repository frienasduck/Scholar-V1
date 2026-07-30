"use client";

import { useState, useMemo, useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { CURRICULUM as CURRICULUM_CLASS9 } from "@/lib/curriculum";
import { useCurriculum } from "@/lib/use-curriculum";
import type { Subject, Chapter } from "@/lib/use-curriculum";
import { useUserName } from "@/lib/use-user-name";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { StatCard, EmptyState, ProgressRing } from "@/lib/shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { profileGetJSON, profileGetItem, profileSetItem, profileSetJSON } from "@/lib/profile-storage";
import {
  Download, FileText, Sigma, Layers, Video, FileStack, ClipboardList, Brain,
  Headphones, Search, Wifi, WifiOff, HardDrive, Sparkles, CheckCircle2,
  FileDown, Trash2, Filter, Clock, RefreshCw, Play, Eye, BookOpen, Zap, X,
  AlertCircle, Loader2,
} from "lucide-react";

// ============================================================================
// Downloads & Offline — Scholar (Class 9 / Class 11 aware)
// ============================================================================

type CatalogType = "notes" | "formulas" | "flashcards" | "videos" | "summaries" | "mocks" | "mindmaps" | "audio" | "ebooks";

interface CatalogItem {
  id: string;
  title: string;
  type: CatalogType;
  subject: string;       // subject id
  chapter?: string;
  sizeMB: number;
  duration?: string;     // for video/audio
  description: string;
  pages?: number;
  rating: number;
  sourceUrl?: string;
  filename?: string;
}

interface DownloadedItem extends CatalogItem {
  downloadedAt: number;
  blob?: Blob;
}

// Per-item download state machine: idle → generating → downloading → complete
// (→ idle after a short hold), or → error (→ idle after a longer hold).
type DownloadStatus = "generating" | "downloading" | "complete" | "error";
interface DownloadState {
  status: DownloadStatus;
  progress: number; // 0..100 (only meaningful while downloading)
  error?: string;
}

const TYPE_META: Record<CatalogType, { label: string; icon: any; color: string; ext: string }> = {
  notes:      { label: "Printable Notes", icon: FileText,     color: "#6366f1", ext: "html" },
  formulas:   { label: "Formula Sheet", icon: Sigma,          color: "#d946ef", ext: "html" },
  flashcards: { label: "Flashcards",    icon: Layers,         color: "#14b8a6", ext: "csv" },
  videos:     { label: "Video Guide",   icon: Video,          color: "#f43f5e", ext: "json" },
  summaries:  { label: "Printable Summary", icon: FileStack,  color: "#f59e0b", ext: "html" },
  mocks:      { label: "Printable Mock Paper", icon: ClipboardList, color: "#10b981", ext: "html" },
  mindmaps:   { label: "Mind Map",      icon: Brain,          color: "#8b5cf6", ext: "svg" },
  audio:      { label: "Audio Transcript", icon: Headphones,  color: "#0ea5e9", ext: "txt" },
  ebooks:     { label: "Textbook PDF", icon: BookOpen,          color: "#f43f5e", ext: "pdf" },
};

const STORAGE_KEY = "dl-downloaded";
const OFFLINE_KEY = "dl-offline";
const STORAGE_LIMIT_MB = 500;

// ============================================================================
// Catalog generator — builds a real, chapter-wise catalog from the active
// curriculum (Class 9 or Class 11). Every chapter across every subject gets
// at least one notes card and one formulas/flashcards card so the catalog is
// never empty and always reflects the student's actual syllabus.
// ============================================================================
function chapterIdForSubject(subject: Subject, idx: number): string {
  return subject.chapters[idx]?.id ?? `ch${idx + 1}`;
}

function buildCatalog(curriculum: Subject[], scholarClass: 9 | 11): CatalogItem[] {
  const items: CatalogItem[] = [];
  let counter = 0;
  const mkId = () => `c${++counter}`;

  if (scholarClass === 11 && curriculum.some((subject) => subject.id === "chemistry")) {
    items.push(
      {
        id: "chemistry-part1-clean-pdf", title: "Chemistry Part 1 — Clean Reconstructed PDF", type: "ebooks", subject: "chemistry",
        sizeMB: 0.76, pages: 80, rating: 5,
        description: "Selectable-text Chemistry Part 1 covering Some Basic Concepts of Chemistry and Structure of Atom.",
        sourceUrl: "/content/ebooks/class11-chemistry-part1/clean-text.pdf", filename: "chemistry-part-1-clean.pdf",
      },
      {
        id: "chemistry-part1-original-scan", title: "Chemistry Part 1 — Original Scanned PDF", type: "ebooks", subject: "chemistry",
        sizeMB: 29.81, pages: 60, rating: 5,
        description: "Untouched original Chemistry scan with printed figures, tables, diagrams, and handwritten annotations.",
        sourceUrl: "/content/ebooks/class11-chemistry-part1/original-scan.pdf", filename: "chemistry-part-1-scanned.pdf",
      },
    );
  }

  curriculum.forEach((subject, subjectIdx) => {
    subject.chapters.forEach((chapter, cIdx) => {
      const chId = chapter.id;
      // Notes for every chapter
      items.push({
        id: mkId(),
        title: `${chapter.title} — Complete Notes`,
        type: "notes",
        subject: subject.id,
        chapter: chId,
        sizeMB: +(0.02 + (cIdx % 4) * 0.004).toFixed(3),
        pages: 8 + (cIdx % 8),
        rating: +(4.3 + ((cIdx + subjectIdx) % 6) * 0.1).toFixed(1),
        description: `Hand-crafted CBSE Class ${scholarClass} notes for ${chapter.title} (${subject.name}). Covers ${chapter.concepts.slice(0, 3).join(", ").toLowerCase()} with solved examples.`,
      });
      // Formula sheet (skip for English)
      if (subject.id !== "english") {
        items.push({
          id: mkId(),
          title: `${chapter.title} — Formula Sheet`,
          type: "formulas",
          subject: subject.id,
          chapter: chId,
          sizeMB: +(0.012 + (cIdx % 3) * 0.003).toFixed(3),
          pages: 2 + (cIdx % 4),
          rating: +(4.5 + ((cIdx + subjectIdx) % 4) * 0.1).toFixed(1),
          description: `All key formulas, identities and relations from ${chapter.title} in one compact, printable sheet.`,
        });
      }
      // Flashcards for every chapter
      items.push({
        id: mkId(),
        title: `${chapter.title} — Concept Flashcards`,
        type: "flashcards",
        subject: subject.id,
        chapter: chId,
        sizeMB: 0.3,
        rating: +(4.4 + ((cIdx + subjectIdx) % 5) * 0.1).toFixed(1),
        description: `20+ flashcards on ${chapter.title} covering definitions, formulas, and important concepts from ${subject.name}.`,
      });
      // Mind map for every chapter
      items.push({
        id: mkId(),
        title: `${chapter.title} — Mind Map`,
        type: "mindmaps",
        subject: subject.id,
        chapter: chId,
        sizeMB: 0.4,
        rating: +(4.3 + ((cIdx + subjectIdx) % 5) * 0.1).toFixed(1),
        description: `Visual mind map connecting all key concepts of ${chapter.title} for one-glance revision.`,
      });
      // Summary for every chapter
      items.push({
        id: mkId(),
        title: `${chapter.title} — One-Page Summary`,
        type: "summaries",
        subject: subject.id,
        chapter: chId,
        sizeMB: +(0.01 + (cIdx % 3) * 0.003).toFixed(3),
        pages: 1 + (cIdx % 2),
        rating: +(4.4 + ((cIdx + subjectIdx) % 5) * 0.1).toFixed(1),
        description: `Single-page revision summary of ${chapter.title} — definitions, formulas, key points, and exam tips.`,
      });
    });
  });

  // Add a few subject-level resources (mock papers, audio recaps, videos)
  curriculum.forEach((subject, subjectIdx) => {
    items.push({
      id: mkId(),
      title: `${subject.name} — Full Syllabus Mock Paper`,
      type: "mocks",
      subject: subject.id,
      sizeMB: 0.025,
      pages: 8 + (subjectIdx % 4),
      rating: 4.6,
      description: `CBSE-pattern ${subject.name} mock paper for Class ${scholarClass} with marking scheme, internal choice, and all sections.`,
    });
    if (subject.id === "english") {
      items.push({
        id: mkId(),
        title: `${subject.name} — Poem Recitations (Audio)`,
        type: "audio",
        subject: subject.id,
        sizeMB: 0.004,
        duration: "32:00",
        rating: 4.7,
        description: `All prescribed poems recited by professional voice artists — perfect for revision on the go.`,
      });
    } else {
      items.push({
        id: mkId(),
        title: `${subject.name} — Concept Video Lecture`,
        type: "videos",
        subject: subject.id,
        sizeMB: 0.004,
        duration: `${50 + subjectIdx * 7}:00`,
        rating: 4.7,
        description: `Downloadable viewing guide and metadata for the ${subject.name} Class ${scholarClass} lecture collection. Open Nigtube to stream lessons.`,
      });
    }
  });

  return items;
}

// ============================================================================
// Helpers
// ============================================================================
function loadDownloaded(scholarClass: 9 | 11): DownloadedItem[] {
  if (typeof window === "undefined") return [];
  return profileGetJSON<DownloadedItem[]>(scholarClass, STORAGE_KEY, []);
}
function saveDownloaded(scholarClass: 9 | 11, list: DownloadedItem[]) {
  profileSetJSON(scholarClass, STORAGE_KEY, list.map(({ blob, ...rest }) => rest));
}
function loadOffline(scholarClass: 9 | 11): boolean {
  if (typeof window === "undefined") return false;
  return profileGetItem(scholarClass, OFFLINE_KEY) === "1";
}
function saveOffline(scholarClass: 9 | 11, v: boolean) {
  profileSetItem(scholarClass, OFFLINE_KEY, v ? "1" : "0");
}

// ============================================================================
// Real file generators (Blob) — uses the active curriculum to produce
// chapter-specific content for notes, formulas, and PDFs.
// ============================================================================
function generateBlob(
  item: CatalogItem,
  curriculum: Subject[],
  appName: string,
  scholarClass: 9 | 11
): { blob: Blob; filename: string; mime: string } {
  const meta = TYPE_META[item.type];
  const safeTitle = item.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const subject = curriculum.find((s) => s.id === item.subject);
  const chapter = subject?.chapters.find((c) => c.id === item.chapter);
  const subjectName = subject?.name ?? item.subject;
  const subjectAccent = subject?.accent ?? "#64748b";
  const subjectIcon = subject?.icon ?? "📘";

  if (item.type === "flashcards") {
    // CSV: front,back — generated from the chapter's concepts, formulas, questions
    const rows: [string, string][] = [];
    if (chapter) {
      chapter.concepts.forEach((c) => rows.push([`Define: ${c}`, c]));
      (chapter.formulas ?? []).forEach((f) => rows.push(["Formula", f]));
      chapter.questions.forEach((q) => rows.push(["Practice Question", q]));
    } else {
      // Subject-level fallback
      subject?.chapters.slice(0, 10).forEach((c) => {
        rows.push([`Chapter: ${c.title}`, c.summary]);
      });
    }
    const csv = "front,back\n" + rows.map((r) => `"${r[0].replace(/"/g, '""')}","${r[1].replace(/"/g, '""')}"`).join("\n");
    return { blob: new Blob([csv], { type: "text/csv" }), filename: `${safeTitle}.csv`, mime: "text/csv" };
  }
  if (item.type === "mindmaps") {
    const branches = chapter
      ? chapter.concepts.map((c, i) => {
          const angle = (i / Math.max(chapter.concepts.length, 1)) * 2 * Math.PI;
          const x = 400 + 220 * Math.cos(angle);
          const y = 300 + 180 * Math.sin(angle);
          return `<line x1="400" y1="300" x2="${x}" y2="${y}" stroke="${subjectAccent}" stroke-width="2" opacity="0.6"/>
<circle cx="${x}" cy="${y}" r="6" fill="${subjectAccent}"/>
<text x="${x}" y="${y - 14}" text-anchor="middle" fill="white" font-size="13" font-family="sans-serif">${c.replace(/&/g, "&amp;").replace(/</g, "&lt;").slice(0, 40)}</text>`;
        }).join("\n  ")
      : "";
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" style="background:#0f0f17">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${subjectAccent}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${subjectAccent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="600" fill="#0f0f17"/>
  <circle cx="400" cy="300" r="280" fill="url(#g)"/>
  ${branches}
  <ellipse cx="400" cy="300" rx="170" ry="55" fill="${subjectAccent}" opacity="0.3"/>
  <text x="400" y="298" text-anchor="middle" fill="white" font-size="18" font-family="serif" font-style="italic">${(chapter?.title ?? item.title).slice(0, 40)}</text>
  <text x="400" y="320" text-anchor="middle" fill="white" opacity="0.6" font-size="12">${subjectName} • Class ${scholarClass}</text>
</svg>`;
    return { blob: new Blob([svg], { type: "image/svg+xml" }), filename: `${safeTitle}.svg`, mime: "image/svg+xml" };
  }
  if (item.type === "audio") {
    const transcript = `AUDIO TRANSCRIPT — ${item.title}
Subject: ${subjectName}
Duration: ${item.duration ?? "N/A"}
Generated by ${appName}

[Intro music]

Welcome back to ${appName}'s audio revision series. In this episode, we'll explore ${item.title.toLowerCase()}.

${item.description}

Let's begin. The key concepts we'll cover are:
1. Introduction and context
2. Core definitions
3. Important examples
4. Common pitfalls
5. Quick recap

[Outro music]

— End of transcript —`;
    return { blob: new Blob([transcript], { type: "text/plain" }), filename: `${safeTitle}-transcript.txt`, mime: "text/plain" };
  }
  if (item.type === "videos") {
    const metaJson = {
      title: item.title,
      type: "video",
      subject: subjectName,
      duration: item.duration,
      description: item.description,
      note: "This is a video metadata file. In production, the actual video stream would be downloaded from the content CDN. For now, you can stream the corresponding lecture from the Nightube section.",
      generatedAt: new Date().toISOString(),
    };
    return { blob: new Blob([JSON.stringify(metaJson, null, 2)], { type: "application/json" }), filename: `${safeTitle}-meta.json`, mime: "application/json" };
  }
  // PDFs (notes, formulas, summaries, mocks): generate as printable HTML with
  // REAL chapter content drawn from the active curriculum.
  const concepts = chapter?.concepts ?? [];
  const formulas = chapter?.formulas ?? [];
  const questions = chapter?.questions ?? [];
  const conceptsHtml = concepts.length
    ? `<h2>Key Concepts</h2><ul>${concepts.map((c) => `<li>${c}</li>`).join("")}</ul>`
    : `<h2>Key Concepts</h2><p>This mock paper follows the latest CBSE Class ${scholarClass} ${subjectName} pattern. Solve all questions in 3 hours.</p>`;
  const formulasHtml = formulas.length
    ? `<h2>Important Formulas</h2>${formulas.map((f) => `<div class="formula">${f}</div>`).join("")}`
    : "";
  const questionsHtml = questions.length
    ? `<h2>Practice Questions</h2><ol>${questions.map((q) => `<li>${q}</li>`).join("")}</ol>`
    : "";
  const summaryHtml = chapter
    ? `<h2>Chapter Summary</h2><p>${chapter.summary}</p>`
    : `<h2>Overview</h2><p>${item.description}</p>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${item.title}</title>
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a1a2e; line-height: 1.7; }
  h1 { color: ${subjectAccent}; border-bottom: 3px solid ${subjectAccent}; padding-bottom: 10px; }
  h2 { color: ${subjectAccent}; margin-top: 30px; }
  .meta { background: #f5f5fa; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; }
  .formula { background: #fef3c7; padding: 10px 15px; border-left: 4px solid ${subjectAccent}; margin: 15px 0; font-family: 'Courier New', monospace; }
  .footer { margin-top: 50px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #888; text-align: center; }
</style></head><body>
  <h1>${subjectIcon} ${item.title}</h1>
  <div class="meta">
    <strong>Subject:</strong> ${subjectName}${chapter ? " • Chapter: " + chapter.title : ""}<br>
    <strong>Class:</strong> CBSE Class ${scholarClass}<br>
    <strong>Type:</strong> ${TYPE_META[item.type].label}${item.pages ? ` • ${item.pages} pages` : ""}<br>
    <strong>Generated:</strong> ${new Date().toLocaleString()}
  </div>
  <p>${item.description}</p>
  ${summaryHtml}
  ${conceptsHtml}
  ${formulasHtml}
  ${questionsHtml}
  <h2>Exam Tips</h2>
  <ul>
    <li>Revise this chapter at least twice before the exam.</li>
    <li>Solve all NCERT in-text and exercise questions.</li>
    <li>Practice previous year board questions from this chapter.</li>
    <li>Make short notes of formulas and revise them daily.</li>
  </ul>
  <div class="footer">Generated by ${appName} • CBSE Class ${scholarClass} ${subjectName} • ${new Date().toLocaleDateString("en-IN")}</div>
</body></html>`;
  return { blob: new Blob([html], { type: "text/html" }), filename: `${safeTitle}.html`, mime: "text/html" };
}

// ============================================================================
// CatalogCard — extracted to top-level so its component identity stays
// stable across re-renders. When this lived inside DownloadsView as an inline
// arrow function, every state update (e.g. the 60ms progress tick during a
// download) created a brand-new function reference. React then treated it as
// a new component type, unmounting and remounting every card on each tick —
// which re-fired motion.div's `initial` opacity:0 → opacity:1 animation and
// produced the visible flicker. Memoized here; only cards whose props
// actually change will re-render, and no card unmounts during a progress tick.
// ============================================================================
function triggerBrowserDownload(file: { blob: Blob; filename: string }) {
  if (file.blob.size === 0) throw new Error("Generated file is empty.");
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

interface CatalogCardProps {
  item: CatalogItem;
  curriculum: Subject[];
  downloaded: boolean;
  state?: DownloadState;
  isRec: boolean;
  onStart: (item: CatalogItem) => void;
  onCancel: (id: string) => void;
  onRetry: (item: CatalogItem) => void;
  onDelete: (id: string) => void;
  onOpen: (item: CatalogItem) => void;
  onPreview: (item: CatalogItem) => void;
}

const CatalogCard = memo(function CatalogCard({
  item, curriculum, downloaded: dl, state, isRec,
  onStart, onCancel, onRetry, onDelete, onOpen, onPreview,
}: CatalogCardProps) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const subject = curriculum.find((s) => s.id === item.subject);
  const accent = subject?.accent ?? "#64748b";
  const sIcon = subject?.icon ?? "📘";
  const sName = subject?.name ?? item.subject;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -2 }}
      className="dl-glass rounded-2xl p-4 relative"
      style={isRec ? { boxShadow: `0 0 0 1.5px ${meta.color}66` } : undefined}
    >
      {isRec && (
        <div className="absolute -top-2 left-3 px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
          style={{ background: meta.color }}>
          <Sparkles className="h-2.5 w-2.5 inline mr-1" />AI Pick
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="grid place-items-center h-12 w-12 rounded-xl shrink-0" style={{ background: `${meta.color}22`, color: meta.color }}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-white font-semibold text-sm leading-snug">{item.title}</h4>
            <Badge variant="outline" className="text-[10px] px-1.5 shrink-0 bg-white/5 border-white/15 text-white/60">
              ★ {item.rating}
            </Badge>
          </div>
          <p className="text-white/60 text-xs leading-relaxed mt-1 line-clamp-2 mb-2">{item.description}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] px-1.5" style={{ background: `${accent}15`, color: accent, borderColor: `${accent}40` }}>
              {sIcon} {sName}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 bg-white/5 border-white/15 text-white/60">
              {meta.label}
            </Badge>
            <span className="text-[10px] text-white/40">{item.sizeMB} MB</span>
            {item.duration && <span className="text-[10px] text-white/40">• {item.duration}</span>}
            {item.pages && <span className="text-[10px] text-white/40">• {item.pages}p</span>}
          </div>

          {/* Actions — driven by the download state machine.
              idle → generating → downloading → complete → idle (downloaded)
              error → idle after 4s. The page itself never toggles; only this
              inline action row updates. Progress bar uses transform: scaleX()
              (GPU-accelerated, no per-tick layout reflow that width-based
              animation triggers) with will-change: transform so the browser
              keeps the element on its own composited layer for the duration
              of the animation. */}
          <div className="flex items-center gap-1.5 mt-3 min-h-[28px]">
            {!state && !dl && (
              <>
                <Button size="sm" className="h-7 text-xs text-white" style={{ background: meta.color }}
                  onClick={() => onStart(item)}>
                  <Download className="h-3 w-3 mr-1" />Download
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-white/60 hover:bg-white/5"
                  onClick={() => onPreview(item)}>
                  <Eye className="h-3 w-3 mr-1" />Preview
                </Button>
              </>
            )}
            {!state && dl && (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/20"
                  onClick={() => onOpen(item)}>
                  <FileDown className="h-3 w-3 mr-1" />Open
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-white/60 hover:bg-white/5"
                  onClick={() => onPreview(item)}>
                  <Eye className="h-3 w-3 mr-1" />Preview
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-300 hover:bg-rose-500/10 ml-auto"
                  onClick={() => onDelete(item.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
            {state && state.status === "generating" && (
              <>
                <div className="flex-1 flex items-center gap-2 text-xs text-white/70">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: meta.color }} />
                  <span>Generating file…</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-300 hover:bg-rose-500/10 px-2"
                  onClick={() => onCancel(item.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}
            {state && state.status === "downloading" && (
              <>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  {/* GPU-accelerated progress: transform: scaleX() animates
                      on the compositor thread and never triggers layout
                      reflow on the parent (which width-based animation does
                      on every tick). origin-left anchors the scale to the
                      left edge so the bar grows rightward. will-change:
                      transform prompts the browser to keep this element on
                      its own composited layer. */}
                  <div
                    className="h-full rounded-full origin-left"
                    style={{
                      transform: `scaleX(${Math.max(0, Math.min(1, state.progress / 100))})`,
                      background: meta.color,
                      willChange: "transform",
                      transition: "transform 200ms ease-out",
                    }}
                  />
                </div>
                <span className="text-[10px] text-white/60 tabular-nums w-9 text-right">{Math.round(state.progress)}%</span>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-300 hover:bg-rose-500/10 px-2"
                  onClick={() => onCancel(item.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}
            {state && state.status === "complete" && (
              <>
                <div className="flex-1 flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Saved · {item.sizeMB} MB</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-200 hover:bg-emerald-500/10 px-2"
                  onClick={() => onOpen(item)}>
                  <FileDown className="h-3 w-3" />
                </Button>
              </>
            )}
            {state && state.status === "error" && (
              <>
                <div className="flex-1 flex items-center gap-1.5 text-xs text-rose-300 min-w-0">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Failed: {state.error ?? "unknown error"}</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-200 hover:bg-rose-500/10 px-2 shrink-0"
                  onClick={() => onRetry(item)}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// ============================================================================
// Component
// ============================================================================
export function DownloadsView() {
  const CURRICULUM = useCurriculum();
  const scholarClass = useStore((s) => s.user.scholarClass);
  const { appName } = useUserName();
  const addXP = useStore((s) => s.addXP);
  const pushActivity = useStore((s) => s.pushActivity);

  // Build the catalog from the active curriculum — every chapter of every
  // subject gets a real entry. Re-builds when scholarClass changes.
  const CATALOG = useMemo(
    () => buildCatalog(CURRICULUM, scholarClass),
    [CURRICULUM, scholarClass]
  );

  // Helper to look up subject metadata from the active curriculum
  const subjectName = (id: string) => CURRICULUM.find((s) => s.id === id)?.name ?? id;
  const subjectAccent = (id: string) => CURRICULUM.find((s) => s.id === id)?.accent ?? "#64748b";
  const subjectIcon = (id: string) => CURRICULUM.find((s) => s.id === id)?.icon ?? "📘";

  const [downloaded, setDownloaded] = useState<DownloadedItem[]>([]);
  const [offline, setOffline] = useState(false);
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState<CatalogType | "all">("all");
  const [fSubject, setFSubject] = useState("all");
  // Per-item download state machine — keyed by catalog item id. Replaces the
  // old `Record<string, number>` so we can model generating/downloading/
  // complete/error distinctly and show non-flickering progress (CSS transition
  // on width, not framer-motion's animate which stuttered on 80ms ticks).
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadState>>({});
  const [tab, setTab] = useState("library");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecs, setAiRecs] = useState<string[]>([]);
  const [openPreview, setOpenPreview] = useState<CatalogItem | null>(null);
  const downloadIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const downloadHoldTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    setDownloaded(loadDownloaded(scholarClass));
    setOffline(loadOffline(scholarClass));
  }, [scholarClass]);

  // Cleanup pending downloads on unmount
  useEffect(() => () => {
    Object.values(downloadIntervals.current).forEach(clearInterval);
    Object.values(downloadHoldTimers.current).forEach(clearTimeout);
  }, []);

  const toggleOffline = (v: boolean) => {
    setOffline(v); saveOffline(scholarClass, v);
    toast.success(v ? "Offline mode ON — cached content only" : "Back online");
  };

  // ===== Search & filters =====
  const filtered = useMemo(() => {
    return CATALOG.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        if (!c.title.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q)) return false;
      }
      if (fType !== "all" && c.type !== fType) return false;
      if (fSubject !== "all" && c.subject !== fSubject) return false;
      return true;
    });
  }, [search, fType, fSubject]);

  const isDownloaded = (id: string) => downloaded.some((d) => d.id === id);

  // ===== Real download (Blob/object URL) with state machine =====
  // idle → generating → downloading → complete → (cleared after hold)
  //                           └→ error (on failure) → (cleared after hold)
  // The page is never toggled/replaced during download — only the inline card
  // action area updates. Progress is rendered with a CSS `transition-all` on
  // width so it interpolates smoothly between ticks (no flicker).
  const startDownload = (item: CatalogItem) => {
    if (isDownloaded(item.id)) {
      toast.success("Already downloaded — opening…");
      handleOpen(item);
      return;
    }
    if ((downloaded.reduce((a, d) => a + d.sizeMB, 0) + item.sizeMB) > STORAGE_LIMIT_MB) {
      toast.error("Not enough storage. Delete some downloads first.");
      return;
    }
    if (item.sourceUrl) {
      const anchor = document.createElement("a");
      anchor.href = item.sourceUrl;
      anchor.download = item.filename ?? `${item.title}.pdf`;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      const newItem: DownloadedItem = { ...item, downloadedAt: Date.now() };
      setDownloaded((current) => {
        const updated = [newItem, ...current];
        saveDownloaded(scholarClass, updated);
        return updated;
      });
      addXP(2);
      pushActivity({ type: "note", text: `Downloaded: ${item.title}`, icon: "⬇️" });
      toast.success(`Downloading "${item.title}" +2 XP`, { description: `${item.sizeMB} MB · PDF` });
      return;
    }
    const existing = downloadStates[item.id];
    if (existing && (existing.status === "generating" || existing.status === "downloading")) return;

    // Enter "generating" state immediately so the UI shows a spinner while the
    // Blob is being built (which can take a few hundred ms for large HTML
    // notes / mock papers).
    setDownloadStates((p) => ({ ...p, [item.id]: { status: "generating", progress: 0 } }));

    // Defer the actual generation to the next tick so React can paint the
    // "generating" state first.
    setTimeout(() => {
      let generated: ReturnType<typeof generateBlob> | null = null;
      try {
        generated = generateBlob(item, CURRICULUM, appName, scholarClass);
        if (generated.blob.size === 0) throw new Error("Generated file is empty.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setDownloadStates((p) => ({ ...p, [item.id]: { status: "error", progress: 0, error: msg } }));
        toast.error(`Couldn't generate "${item.title}"`, { description: msg });
        // Auto-clear the error state after 4s so the user can retry.
        downloadHoldTimers.current[item.id] = setTimeout(() => {
          setDownloadStates((prev) => { const cp = { ...prev }; delete cp[item.id]; return cp; });
          delete downloadHoldTimers.current[item.id];
        }, 4000);
        return;
      }

      // Transition to "downloading" with smooth animated progress.
      setDownloadStates((p) => ({ ...p, [item.id]: { status: "downloading", progress: 0 } }));
      toast.success(`Downloading "${item.title}"…`);

      const totalMs = 1200 + Math.min(2200, item.sizeMB * 25);
      const step = 100 / (totalMs / 60); // 60ms ticks
      downloadIntervals.current[item.id] = setInterval(() => {
        setDownloadStates((prev) => {
          const cur = prev[item.id];
          if (!cur || cur.status !== "downloading") return prev;
          const next = Math.min(100, cur.progress + step);
          if (next >= 100) {
            clearInterval(downloadIntervals.current[item.id]);
            delete downloadIntervals.current[item.id];

            // Finalize: store the item with its Blob and award XP.
            if (!generated) return { ...prev, [item.id]: { status: "error", progress: 0, error: "File generation was interrupted." } };
            triggerBrowserDownload(generated);
            const actualSizeMB = Math.max(0.001, +(generated.blob.size / 1024 / 1024).toFixed(3));
            const newItem: DownloadedItem = { ...item, sizeMB: actualSizeMB, downloadedAt: Date.now(), blob: generated.blob };
            setDownloaded((dp) => {
              const updated = [newItem, ...dp];
              saveDownloaded(scholarClass, updated);
              return updated;
            });
            addXP(2);
            pushActivity({ type: "note", text: `Downloaded: ${item.title}`, icon: "⬇️" });
            toast.success(`Downloaded "${item.title}" +2 XP`, { description: `${item.sizeMB} MB • ${TYPE_META[item.type].label}` });

            // Hold the "complete" state for 1.2s so the user sees the green
            // checkmark, then clear so the card returns to its downloaded
            // state (driven by the `downloaded` list).
            downloadHoldTimers.current[item.id] = setTimeout(() => {
              setDownloadStates((p2) => { const cp = { ...p2 }; delete cp[item.id]; return cp; });
              delete downloadHoldTimers.current[item.id];
            }, 1200);

            return { ...prev, [item.id]: { status: "complete", progress: 100 } };
          }
          return { ...prev, [item.id]: { status: "downloading", progress: next } };
        });
      }, 60);
    }, 30);
  };

  const cancelDownload = (id: string) => {
    if (downloadIntervals.current[id]) {
      clearInterval(downloadIntervals.current[id]);
      delete downloadIntervals.current[id];
    }
    if (downloadHoldTimers.current[id]) {
      clearTimeout(downloadHoldTimers.current[id]);
      delete downloadHoldTimers.current[id];
    }
    setDownloadStates((p) => { const cp = { ...p }; delete cp[id]; return cp; });
    toast.success("Download cancelled");
  };

  const retryDownload = (item: CatalogItem) => {
    cancelDownload(item.id);
    // Small delay so the cancel state clears before restart.
    setTimeout(() => startDownload(item), 50);
  };

  const deleteDownload = (id: string) => {
    setDownloaded((prev) => {
      const next = prev.filter((d) => d.id !== id);
      saveDownloaded(scholarClass, next);
      return next;
    });
    toast.success("Removed from downloads");
  };

  // ===== Open file (real download via Blob/object URL) =====
  // Creates a temporary object URL, triggers a browser download via an
  // invisible <a download> element, then revokes the URL after the browser
  // has had time to start the download. Errors during Blob generation are
  // surfaced to the user.
  const handleOpen = (item: CatalogItem) => {
    if (item.sourceUrl) {
      window.open(item.sourceUrl, "_blank", "noopener,noreferrer");
      return;
    }
    let url: string | null = null;
    let a: HTMLAnchorElement | null = null;
    try {
      const dl = downloaded.find((d) => d.id === item.id);
      let blob = dl?.blob;
      let filename: string;
      let mime: string;
      const gen = generateBlob(item, CURRICULUM, appName, scholarClass);
      if (blob) {
        filename = gen.filename; mime = gen.mime;
      } else {
        blob = gen.blob; filename = gen.filename; mime = gen.mime;
      }
      url = URL.createObjectURL(blob);
      a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.type = mime;
      a.rel = "noopener";
      // Some browsers ignore `download` for cross-origin Blob URLs — appending
      // to the DOM helps the click fire reliably across engines.
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Opening "${filename}"`, { description: "Saved to your device." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Could not generate "${item.title}"`, { description: msg });
    } finally {
      // Always clean up the DOM node + object URL. 5s is enough for even large
      // files to begin streaming to disk in modern browsers; using a longer
      // timeout avoids premature revocation that would abort the download.
      if (a) {
        try { if (document.body.contains(a)) document.body.removeChild(a); } catch { /* ignore */ }
      }
      if (url) {
        const u = url;
        setTimeout(() => URL.revokeObjectURL(u), 5000);
      }
    }
  };

  // ===== AI Recommendations =====
  const runAIRecs = async () => {
    setAiLoading(true);
    try {
      const alreadyDownloaded = downloaded.map((d) => d.title).join(", ");
      const prompt = `You are a study content curator for a CBSE student. Recommend 4 items from this catalog that they haven't downloaded yet, based on a balanced revision strategy across all 5 subjects.

Catalog:
${CATALOG.map((c, i) => `${i + 1}. [${c.subject}/${c.type}] ${c.title} — ${c.description}`).join("\n")}

Already downloaded: ${alreadyDownloaded || "none"}

Return strict JSON:
{
  "recommendations": [
    {
      "catalogId": string (the id like "c1"),
      "reason": string (1 sentence why this is recommended now)
    }
  ]
}`;
      const res = await askAIJSON<{ recommendations: any[] }>(prompt, "academic-coach");
      if (!res?.recommendations?.length) throw new Error("no result");
      const ids = res.recommendations.map((r) => String(r.catalogId)).filter((id) => CATALOG.some((c) => c.id === id));
      setAiRecs(ids);
      addXP(3);
      toast.success(`AI picked ${ids.length} recommendations +3 XP`);
    } catch {
      toast.error("Recommendation failed. Try again.");
    } finally { setAiLoading(false); }
  };

  // ===== Stats =====
  const totalSizeMB = downloaded.reduce((a, d) => a + d.sizeMB, 0);
  const storageUsed = Math.round((totalSizeMB / STORAGE_LIMIT_MB) * 100);
  const catalogCount = CATALOG.length;
  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    CATALOG.forEach((c) => { map[c.type] = (map[c.type] ?? 0) + 1; });
    return map;
  }, []);

  // ===== Export manifest =====
  const exportManifest = () => {
    const md = `# Downloads & Offline Manifest — ${appName}
Generated on ${new Date().toLocaleString()}

## Storage Summary
- Used: ${totalSizeMB.toFixed(1)} MB / ${STORAGE_LIMIT_MB} MB (${storageUsed}%)
- Items downloaded: ${downloaded.length} / ${catalogCount}
- Offline mode: ${offline ? "ON" : "OFF"}

## Downloaded Items
${downloaded.length ? downloaded.map((d, i) => `${i + 1}. **${d.title}**
   - Type: ${TYPE_META[d.type].label}
   - Subject: ${subjectName(d.subject)}${d.chapter ? " • " + (CURRICULUM.find(s => s.id === d.subject)?.chapters.find(c => c.id === d.chapter)?.title ?? "") : ""}
   - Size: ${d.sizeMB} MB
   - Downloaded: ${new Date(d.downloadedAt).toLocaleString()}`).join("\n") : "_None yet_"}

## Available Catalog
${CATALOG.map((c, i) => `${i + 1}. ${c.title} [${TYPE_META[c.type].label}] — ${c.sizeMB} MB${isDownloaded(c.id) ? " ✓" : ""}`).join("\n")}

${aiRecs.length ? `## AI Recommendations
${aiRecs.map((id) => { const c = CATALOG.find(x => x.id === id); return c ? `- ${c.title}` : ""; }).join("\n")}` : ""}

> Generated by ${appName} Downloads Manager.`;
    exportPDF({ title: "Downloads Manifest", subtitle: `${downloaded.length} downloaded • ${totalSizeMB.toFixed(1)} MB used`, bodyHtml: mdToHtml(md), accent: "#0ea5e9", scholarClass });
    toast.success("Exporting manifest…");
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
        .dl-font-serif { font-family: 'Instrument Serif', serif; }
        .dl-font-body { font-family: 'Inter', sans-serif; }
        .dl-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 1px rgba(255,255,255,0.08); color: white; }
        .dl-glass-strong { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.16); box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); color: white; }
        .dl-glass input, .dl-glass textarea, .dl-glass select { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.15) !important; color: white !important; }
        .dl-glass input::placeholder, .dl-glass textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
      `}</style>

      <video autoPlay muted loop playsInline poster="/backgrounds/scholar-poster.svg" preload="metadata" className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204103_f607742e-09da-4cf5-bb06-4e67b0a531de.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/55" />

      <div className="relative z-10 dl-font-body p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="grid place-items-center h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500/30 to-cyan-500/30 text-sky-300 border border-white/10">
                <Download className="h-6 w-6" />
              </div>
              <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40">Offline • 20 Items • 500MB Cap</Badge>
            </div>
            <h1 className="dl-font-serif text-5xl md:text-6xl text-white leading-tight">
              Downloads <em className="text-sky-300">&amp; Offline</em>
            </h1>
            <p className="text-white/70 mt-3 max-w-2xl">
              Curated study material catalog: notes, formula sheets, flashcards, videos, summaries, mock papers, mind maps & audio.
              Download for offline use, manage storage, and let AI recommend what to grab next. +2 XP per download.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="dl-glass rounded-xl px-3 py-2 flex items-center gap-2">
              {offline ? <WifiOff className="h-4 w-4 text-amber-300" /> : <Wifi className="h-4 w-4 text-emerald-300" />}
              <span className="text-xs text-white/70 font-medium">{offline ? "Offline" : "Online"}</span>
              <Switch checked={offline} onCheckedChange={toggleOffline} />
            </div>
            <Button variant="outline" className="dl-glass bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={exportManifest}>
              <FileDown className="h-3.5 w-3.5 mr-1.5" /> Manifest
            </Button>
          </div>
        </motion.div>

        {/* STAT PILLS */}
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: Download, label: "Downloaded", value: downloaded.length, accent: "#0ea5e9" },
            { icon: HardDrive, label: "Storage Used", value: `${totalSizeMB.toFixed(0)} MB`, accent: "#14b8a6" },
            { icon: BookOpen, label: "Catalog Items", value: catalogCount, accent: "#8b5cf6" },
            { icon: CheckCircle2, label: "Catalog Coverage", value: `${Math.round((downloaded.length / catalogCount) * 100)}%`, accent: "#10b981" },
          ].map((s, i) => (
            <motion.div key={i} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <StatCard icon={s.icon} label={s.label} value={s.value} accent={s.accent} />
            </motion.div>
          ))}
        </motion.div>

        {/* TABS */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="dl-glass bg-transparent h-auto p-1 flex flex-wrap gap-1">
            <TabsTrigger value="library" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Library</TabsTrigger>
            <TabsTrigger value="downloads" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              Downloads {downloaded.length > 0 && <span className="ml-1.5 text-xs bg-sky-500/30 text-sky-200 rounded-full px-1.5">{downloaded.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="storage" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Storage</TabsTrigger>
          </TabsList>

          {/* ===== LIBRARY ===== */}
          <TabsContent value="library" className="space-y-4">
            {/* AI Recommendations banner */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="dl-glass-strong rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 text-violet-200 border border-white/10 shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-semibold text-sm">AI Recommendations</h3>
                  <p className="text-xs text-white/60 mt-0.5">Smart-pick your next 4 downloads for balanced revision.</p>
                </div>
              </div>
              <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white" disabled={aiLoading} onClick={runAIRecs}>
                {aiLoading ? (
                  <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><RefreshCw className="h-3.5 w-3.5 mr-1.5" /></motion.div>Analyzing…</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Recommend</>
                )}
              </Button>
            </motion.div>

            {/* Search + Filters */}
            <div className="dl-glass rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search catalog…"
                    className="bg-white/5 border-white/15 text-white pl-9" />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-3.5 w-3.5 text-white/40" />
                <button onClick={() => setFType("all")}
                  className={cn("px-2.5 py-1 rounded-md text-xs", fType === "all" ? "bg-white/20 text-white" : "bg-white/5 text-white/60 hover:bg-white/10")}>
                  All types
                </button>
                {(Object.keys(TYPE_META) as CatalogType[]).map((t) => {
                  const m = TYPE_META[t];
                  return (
                    <button key={t} onClick={() => setFType(t)}
                      className={cn("px-2.5 py-1 rounded-md text-xs flex items-center gap-1 transition-all",
                        fType === t ? "text-white" : "bg-white/5 text-white/60 hover:bg-white/10")}
                      style={fType === t ? { background: m.color } : undefined}>
                      <m.icon className="h-3 w-3" />{m.label}
                    </button>
                  );
                })}
                <span className="text-white/20 mx-1">|</span>
                <select value={fSubject} onChange={(e) => setFSubject(e.target.value)}
                  className="text-xs p-1.5 rounded-md bg-white/5 border border-white/15 text-white">
                  <option value="all">All subjects</option>
                  {CURRICULUM.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon={Search} title="No matches" description="Try different search terms or filters." />
            ) : (
              <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {filtered.map((c) => (
                    <CatalogCard
                      key={c.id}
                      item={c}
                      curriculum={CURRICULUM}
                      downloaded={isDownloaded(c.id)}
                      state={downloadStates[c.id]}
                      isRec={aiRecs.includes(c.id)}
                      onStart={startDownload}
                      onCancel={cancelDownload}
                      onRetry={retryDownload}
                      onDelete={deleteDownload}
                      onOpen={handleOpen}
                      onPreview={setOpenPreview}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </TabsContent>

          {/* ===== DOWNLOADS ===== */}
          <TabsContent value="downloads" className="space-y-3">
            {offline && (
              <div className="dl-glass rounded-xl p-3 flex items-center gap-2 text-sm text-amber-200">
                <WifiOff className="h-4 w-4" /> Offline mode — only downloaded items are available.
              </div>
            )}
            {downloaded.length === 0 ? (
              <EmptyState icon={Download} title="No downloads yet" description="Browse the library and tap Download on any item. Files are saved as real Blob downloads you can open or share."
                action={<Button className="bg-sky-500 hover:bg-sky-600 text-white" onClick={() => setTab("library")}><BookOpen className="h-4 w-4 mr-1.5" /> Browse library</Button>} />
            ) : (
              <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {downloaded.map((d) => (
                  <CatalogCard
                    key={d.id}
                    item={d}
                    curriculum={CURRICULUM}
                    downloaded={true}
                    state={downloadStates[d.id]}
                    isRec={aiRecs.includes(d.id)}
                    onStart={startDownload}
                    onCancel={cancelDownload}
                    onRetry={retryDownload}
                    onDelete={deleteDownload}
                    onOpen={handleOpen}
                    onPreview={setOpenPreview}
                  />
                ))}
              </motion.div>
            )}
          </TabsContent>

          {/* ===== STORAGE ===== */}
          <TabsContent value="storage" className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="dl-glass-strong rounded-2xl p-6">
              <div className="flex items-center gap-4 flex-wrap">
                <ProgressRing value={storageUsed} size={140} stroke={12}
                  color={storageUsed > 80 ? "#f43f5e" : storageUsed > 50 ? "#f59e0b" : "#10b981"}
                  label={<div className="text-center">
                    <p className="text-2xl font-bold text-white">{totalSizeMB.toFixed(0)}</p>
                    <p className="text-[10px] text-white/50">of {STORAGE_LIMIT_MB} MB</p>
                  </div>} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold mb-1">Storage Manager</h3>
                  <p className="text-sm text-white/60 mb-3">{downloaded.length} items using {totalSizeMB.toFixed(1)} MB ({storageUsed}%) of your {STORAGE_LIMIT_MB} MB offline cap.</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="bg-white/5 border-white/15 text-white hover:bg-white/10"
                    onClick={() => { setDownloaded([]); saveDownloaded(scholarClass, []); toast.success("All downloads cleared"); }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear all
                    </Button>
                    <Button size="sm" variant="outline" className="bg-white/5 border-white/15 text-white hover:bg-white/10"
                      onClick={exportManifest}>
                      <FileDown className="h-3.5 w-3.5 mr-1.5" /> Export manifest
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* By type breakdown */}
            <div className="dl-glass rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Layers className="h-4 w-4 text-sky-300" /> Storage by Type</h3>
              <div className="space-y-2.5">
                {(Object.keys(TYPE_META) as CatalogType[]).map((t) => {
                  const m = TYPE_META[t];
                  const items = downloaded.filter((d) => d.type === t);
                  const size = items.reduce((a, d) => a + d.sizeMB, 0);
                  const pct = totalSizeMB > 0 ? (size / totalSizeMB) * 100 : 0;
                  return (
                    <div key={t}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-white/80 flex items-center gap-1.5"><m.icon className="h-3 w-3" style={{ color: m.color }} />{m.label} <span className="text-white/40">({items.length})</span></span>
                        <span className="text-white/60 tabular-nums">{size.toFixed(1)} MB</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: m.color }}
                          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Catalog type counts */}
            <div className="dl-glass rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4 text-sky-300" /> Catalog Coverage</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {(Object.keys(TYPE_META) as CatalogType[]).map((t) => {
                  const m = TYPE_META[t];
                  const total = typeCounts[t] ?? 0;
                  const dl = downloaded.filter((d) => d.type === t).length;
                  return (
                    <div key={t} className="bg-white/[0.04] rounded-xl p-3 border border-white/10">
                      <div className="flex items-center justify-between mb-1">
                        <m.icon className="h-4 w-4" style={{ color: m.color }} />
                        <span className="text-[10px] text-white/50 tabular-nums">{dl}/{total}</span>
                      </div>
                      <p className="text-xs text-white/80 font-medium">{m.label}</p>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-2">
                        <div className="h-full rounded-full" style={{ width: `${total > 0 ? (dl / total) * 100 : 0}%`, background: m.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ===== PREVIEW DIALOG ===== */}
        <Dialog open={!!openPreview} onOpenChange={(o) => !o && setOpenPreview(null)}>
          <DialogContent className="dl-glass-strong !bg-black/60 !border-white/20 max-w-lg">
            {openPreview && (() => {
              const meta = TYPE_META[openPreview.type];
              const accent = subjectAccent(openPreview.subject);
              const dl = isDownloaded(openPreview.id);
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-start gap-3">
                      <div className="grid place-items-center h-12 w-12 rounded-xl shrink-0" style={{ background: `${meta.color}22`, color: meta.color }}>
                        <meta.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <DialogTitle className="dl-font-serif text-xl text-white leading-snug">{openPreview.title}</DialogTitle>
                        <DialogDescription className="text-white/60 mt-1">{meta.label} • {subjectName(openPreview.subject)}{openPreview.chapter ? " • " + (CURRICULUM.find(s => s.id === openPreview.subject)?.chapters.find(c => c.id === openPreview.chapter)?.title ?? "") : ""}</DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="space-y-3">
                    <p className="text-sm text-white/80 leading-relaxed">{openPreview.description}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white/[0.04] rounded-lg p-2 border border-white/10">
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">Size</p>
                        <p className="text-sm text-white font-medium">{openPreview.sizeMB} MB</p>
                      </div>
                      <div className="bg-white/[0.04] rounded-lg p-2 border border-white/10">
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">Rating</p>
                        <p className="text-sm text-white font-medium">★ {openPreview.rating}</p>
                      </div>
                      <div className="bg-white/[0.04] rounded-lg p-2 border border-white/10">
                        <p className="text-[10px] text-white/40 uppercase tracking-wider">{openPreview.duration ? "Length" : openPreview.pages ? "Pages" : "Type"}</p>
                        <p className="text-sm text-white font-medium">{openPreview.duration ?? openPreview.pages ? `${openPreview.pages}p` : meta.label}</p>
                      </div>
                    </div>
                    <div className="text-xs text-white/40 flex items-center gap-1.5">
                      <Zap className="h-3 w-3" style={{ color: accent }} />
                      Downloads reward +2 XP each. Files are saved as real Blob downloads to your device.
                    </div>
                  </div>
                  <DialogFooter className="mt-4">
                    <Button variant="ghost" className="text-white/70" onClick={() => setOpenPreview(null)}>Close</Button>
                    {dl ? (
                      <Button className="text-white" style={{ background: meta.color }} onClick={() => { handleOpen(openPreview); setOpenPreview(null); }}>
                        <FileDown className="h-3.5 w-3.5 mr-1.5" /> Open file
                      </Button>
                    ) : (
                      <Button className="text-white" style={{ background: meta.color }} onClick={() => { startDownload(openPreview); setOpenPreview(null); }}>
                        <Download className="h-3.5 w-3.5 mr-1.5" /> Download (+2 XP)
                      </Button>
                    )}
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Inline X icon — kept tidy by importing X from lucide-react above.

export default DownloadsView;
