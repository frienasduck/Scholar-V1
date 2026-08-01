"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/lib/notifications/notification-api";
import {
  X, ChevronLeft, ChevronRight, FileText, Check, Trash2, Edit3,
  Loader2, Scan, AlertCircle, CheckCircle2, Download, Upload,
} from "lucide-react";
import { PHYSICS_PDF_QUESTIONS, PHYSICS_PDF_QUESTION_COUNTS } from "@/lib/physics-pdf-questions";
import type { PracticeQuestion } from "@/lib/question-bank";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { profileGetJSON, profileSetJSON, profileGetItem, profileSetItem } from "@/lib/profile-storage";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";

// ============================================================================
// PDF Import Review Mode
// Shows the Physics PDF page image on the left and extracted questions on the right.
// Users can review, edit, validate, or reject questions.
// ============================================================================

interface PdfImportReviewProps {
  onExit: () => void;
}

export function PdfImportReview({ onExit }: PdfImportReviewProps) {
  const scholarClass = useStore((s) => s.user.scholarClass);
  const [currentPage, setCurrentPage] = useState(1);
  const [ocrText, setOcrText] = useState<string>("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [questions, setQuestions] = useState<PracticeQuestion[]>(
    () => PHYSICS_PDF_QUESTIONS.map((q) => ({ ...q }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewedPages, setReviewedPages] = useState<Set<number>>(new Set());
  const [validatedCount, setValidatedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);

  const totalPages = 96;

  // Load OCR text for current page
  useEffect(() => {
    let cancelled = false;
    const start = setTimeout(() => {
      if (cancelled) return;
      setOcrLoading(true);
      setOcrText("");
      fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: currentPage }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (data.ok) setOcrText(data.text || "");
          setOcrLoading(false);
        })
        .catch(() => {
          if (!cancelled) setOcrLoading(false);
        });
    }, 0);
    return () => { cancelled = true; clearTimeout(start); };
  }, [currentPage]);

  // Filter questions for current page
  const pageQuestions = useMemo(() => {
    return questions.filter((q) => {
      const pageMatch = q.id.match(/pdf_p(\d+)_/);
      return pageMatch && parseInt(pageMatch[1]) === currentPage;
    });
  }, [currentPage, questions]);

  // Count validated/rejected from localStorage
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const stored = JSON.parse(profileGetItem(scholarClass, "pdf-review-status") || "{}");
        let validated = 0, rejected = 0;
        const reviewed = new Set<number>();
        for (const [id, status] of Object.entries(stored)) {
          if (status === "validated") validated++;
          if (status === "rejected") rejected++;
          const pageMatch = id.match(/pdf_p(\d+)_/);
          if (pageMatch) reviewed.add(parseInt(pageMatch[1]));
        }
        setValidatedCount(validated);
        setRejectedCount(rejected);
        setReviewedPages(reviewed);
      } catch { /* ignore */ }
    });
    return () => { cancelled = true; };
  }, [scholarClass]);

  const updateQuestion = useCallback((id: string, patch: Partial<PracticeQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    // Also update localStorage for persistence
    try {
      const stored = JSON.parse(profileGetItem(scholarClass, "pdf-edited-questions") || "{}");
      stored[id] = { ...stored[id], ...patch };
      profileSetItem(scholarClass, "pdf-edited-questions", JSON.stringify(stored));
    } catch { /* ignore */ }
  }, [scholarClass]);

  const setQuestionStatus = useCallback((id: string, status: "validated" | "rejected" | "pending") => {
    try {
      const stored = JSON.parse(profileGetItem(scholarClass, "pdf-review-status") || "{}");
      if (status === "pending") {
        delete stored[id];
      } else {
        stored[id] = status;
      }
      profileSetItem(scholarClass, "pdf-review-status", JSON.stringify(stored));
      
      // Update counts
      let validated = 0, rejected = 0;
      const reviewed = new Set<number>();
      for (const [qid, s] of Object.entries(stored)) {
        if (s === "validated") validated++;
        if (s === "rejected") rejected++;
        const pageMatch = qid.match(/pdf_p(\d+)_/);
        if (pageMatch) reviewed.add(parseInt(pageMatch[1]));
      }
      setValidatedCount(validated);
      setRejectedCount(rejected);
      setReviewedPages(reviewed);
      
      if (status === "validated") toast.success("Question validated");
      if (status === "rejected") toast.info("Question rejected");
    } catch { /* ignore */ }
  }, [scholarClass]);

  const getQuestionStatus = useCallback((id: string): "validated" | "rejected" | "pending" => {
    try {
      const stored = JSON.parse(profileGetItem(scholarClass, "pdf-review-status") || "{}");
      return stored[id] || "pending";
    } catch { return "pending" }
  }, [scholarClass]);

  // Load edited questions from localStorage on mount
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const stored = JSON.parse(profileGetItem(scholarClass, "pdf-edited-questions") || "{}");
        if (Object.keys(stored).length > 0) {
          setQuestions((prev) => prev.map((q) => stored[q.id] ? { ...q, ...stored[q.id] } : q));
        }
      } catch { /* ignore */ }
    });
    return () => { cancelled = true; };
  }, [scholarClass]);

  const pageImageSrc = `/ebook-pages/page-${String(currentPage).padStart(3, "0")}.png`;

  // Summary stats
  const stats = useMemo(() => {
    const total = questions.length;
    const byChapter: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const q of questions) {
      byChapter[q.chapter] = (byChapter[q.chapter] || 0) + 1;
      byType[q.type] = (byType[q.type] || 0) + 1;
    }
    return { total, byChapter, byType };
  }, [questions]);

  const content = (
    <div className="fixed inset-0 z-[200] bg-[#0a0a0f] flex flex-col" style={{ contain: "layout" }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between p-3 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" /> Exit Review
          </button>
          <div className="flex items-center gap-2 text-sm font-medium text-white min-w-0">
            <Scan className="h-4 w-4 text-violet-300 shrink-0" />
            <span className="truncate">PDF Import Review — Physics Question Bank</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/50 shrink-0">
          <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {validatedCount} validated</span>
          <span className="flex items-center gap-1"><X className="h-3.5 w-3.5 text-rose-400" /> {rejectedCount} rejected</span>
          <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-blue-400" /> {stats.total} total</span>
        </div>
      </div>

      {/* Summary banner */}
      <div className="shrink-0 px-4 py-2 bg-violet-500/5 border-b border-violet-500/20 flex items-center gap-4 text-[11px] text-white/60 flex-wrap">
        <span className="font-medium text-violet-200">Source:</span>
        <span>phy pt1 (pt1)_merged — 96 pages</span>
        <span className="text-white/30">|</span>
        <span>Pages scanned: <strong className="text-white">96/96</strong></span>
        <span className="text-white/30">|</span>
        <span>Questions detected: <strong className="text-white">{stats.total}</strong></span>
        <span className="text-white/30">|</span>
        <span>By chapter:</span>
        {Object.entries(stats.byChapter).map(([ch, count]) => (
          <span key={ch} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/70">{ch}: {count}</span>
        ))}
      </div>

      {/* Main content: page image | questions */}
      <div className="flex-1 flex min-h-0">
        {/* Left: page image */}
        <div className="w-1/2 shrink-0 flex flex-col border-r border-white/10 bg-zinc-950/50">
          {/* Page nav */}
          <div className="shrink-0 flex items-center justify-between p-2 border-b border-white/10 bg-white/[0.02]">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-white/60 font-mono">
              Page {currentPage} / {totalPages}
              {reviewedPages.has(currentPage) && <span className="ml-2 text-emerald-400">✓ reviewed</span>}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {/* Page image */}
          <div className="flex-1 overflow-auto p-3 grid place-items-center">
            <img
              src={pageImageSrc}
              alt={`Page ${currentPage}`}
              className="max-w-full max-h-full rounded-lg shadow-2xl border border-white/10"
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = "0.3";
              }}
            />
          </div>
        </div>

        {/* Right: extracted questions */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* OCR text (collapsible) */}
          <details className="shrink-0 border-b border-white/10 bg-white/[0.02]">
            <summary className="cursor-pointer p-2 text-[11px] text-white/50 hover:text-white/70 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              {ocrLoading ? "OCR running..." : `OCR text (${ocrText.length} chars)`}
            </summary>
            <div className="max-h-32 overflow-y-auto p-2 text-[10px] text-white/40 font-mono whitespace-pre-wrap">
              {ocrLoading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : (ocrText || "No OCR text available.")}
            </div>
          </details>

          {/* Questions list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-white/70">
                Questions on this page ({pageQuestions.length})
              </p>
              {pageQuestions.length === 0 && (
                <p className="text-[10px] text-white/40">No questions detected on this page.</p>
              )}
            </div>
            {pageQuestions.map((q) => {
              const status = getQuestionStatus(q.id);
              const isEditing = editingId === q.id;
              return (
                <QuestionReviewCard
                  key={q.id}
                  question={q}
                  status={status}
                  isEditing={isEditing}
                  onEdit={() => setEditingId(isEditing ? null : q.id)}
                  onUpdate={(patch) => updateQuestion(q.id, patch)}
                  onValidate={() => setQuestionStatus(q.id, "validated")}
                  onReject={() => setQuestionStatus(q.id, "rejected")}
                  onReset={() => setQuestionStatus(q.id, "pending")}
                />
              );
            })}
          </div>

          {/* Bottom nav */}
          <div className="shrink-0 flex items-center justify-between p-2 border-t border-white/10 bg-white/[0.02]">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev page
            </button>
            <span className="text-[10px] text-white/40">
              {reviewedPages.size} pages reviewed
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
            >
              Next page <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}

// ============================================================================
// Question review card
// ============================================================================

function QuestionReviewCard({
  question, status, isEditing, onEdit, onUpdate, onValidate, onReject, onReset,
}: {
  question: PracticeQuestion;
  status: "validated" | "rejected" | "pending";
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (patch: Partial<PracticeQuestion>) => void;
  onValidate: () => void;
  onReject: () => void;
  onReset: () => void;
}) {
  const statusColors = {
    validated: "border-emerald-500/40 bg-emerald-500/5",
    rejected: "border-rose-500/40 bg-rose-500/5 opacity-60",
    pending: "border-white/10 bg-white/[0.02]",
  };
  const statusBadges = {
    validated: { label: "Validated", color: "text-emerald-300 bg-emerald-500/15" },
    rejected: { label: "Rejected", color: "text-rose-300 bg-rose-500/15" },
    pending: { label: "Needs Review", color: "text-amber-300 bg-amber-500/15" },
  };

  return (
    <div className={cn("rounded-xl border p-3 transition-all", statusColors[status])}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] font-bold text-white/40 shrink-0">#{question.number}</span>
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", statusBadges[status].color)}>
            {statusBadges[status].label}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50">
            {question.type.toUpperCase()}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 truncate">
            {question.chapter}
          </span>
        </div>
        <button
          onClick={onEdit}
          className="p-1 rounded-md bg-white/5 border border-white/10 text-white/50 hover:text-white shrink-0"
        >
          <Edit3 className="h-3 w-3" />
        </button>
      </div>

      {/* Question text */}
      {!isEditing ? (
        <p className="text-xs text-white/80 leading-relaxed mb-2">{question.question}</p>
      ) : (
        <textarea
          value={question.question}
          onChange={(e) => onUpdate({ question: e.target.value })}
          rows={4}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y mb-2"
        />
      )}

      {/* Options (for MCQs) */}
      {question.options && question.options.length > 0 && (
        <div className="space-y-1 mb-2">
          {!isEditing ? (
            question.options.map((opt, i) => (
              <div key={i} className="text-[11px] text-white/60 flex items-start gap-1.5">
                <span className="font-bold text-white/40 shrink-0">{String.fromCharCode(65 + i)}.</span>
                <span>{opt}</span>
              </div>
            ))
          ) : (
            question.options.map((opt, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="font-bold text-white/40 text-[11px] shrink-0 mt-1">{String.fromCharCode(65 + i)}.</span>
                <input
                  value={opt}
                  onChange={(e) => {
                    const newOpts = [...(question.options || [])];
                    newOpts[i] = e.target.value;
                    onUpdate({ options: newOpts });
                  }}
                  className="flex-1 rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* Editable fields when editing */}
      {isEditing && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">Chapter</label>
            <select
              value={question.chapter}
              onChange={(e) => onUpdate({ chapter: e.target.value })}
              className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            >
              <option value="Units and Measurement">Units and Measurement</option>
              <option value="Motion in a Straight Line">Motion in a Straight Line</option>
              <option value="Motion in a Plane">Motion in a Plane</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] text-white/40 uppercase tracking-wider">Type</label>
            <select
              value={question.type}
              onChange={(e) => onUpdate({ type: e.target.value as "mcq" | "subjective" })}
              className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            >
              <option value="mcq">MCQ</option>
              <option value="subjective">Subjective</option>
            </select>
          </div>
        </div>
      )}

      {/* Explanation */}
      {!isEditing && question.explanation && (
                          <ScholarAIContent content={question.explanation} mode="compact" className="mb-2 text-[10px] italic text-white/40" />
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {status !== "validated" && (
          <button
            onClick={onValidate}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/25 transition-colors"
          >
            <Check className="h-3 w-3" /> Validate
          </button>
        )}
        {status !== "rejected" && (
          <button
            onClick={onReject}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-200 hover:bg-rose-500/25 transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Reject
          </button>
        )}
        {status !== "pending" && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/50 hover:text-white transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
