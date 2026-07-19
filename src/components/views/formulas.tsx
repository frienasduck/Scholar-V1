"use client";

import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { CURRICULUM } from "@/lib/curriculum";
import { exportPDF } from "@/lib/pdf";
import { StatCard, SectionHeader, Pill, EmptyState } from "@/lib/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Sigma, Search, Copy, Star, Download, FileText, BookOpen, Sigma as SigmaIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";

interface FormulaItem {
  subjectId: string;
  subjectName: string;
  subjectAccent: string;
  subjectIcon: string;
  chapterId: string;
  chapterTitle: string;
  formula: string;
  key: string;
}

export function FormulaExplorerView() {
  const bookmarks = useStore((s) => s.bookmarks);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const CURRICULUM = useCurriculum();
  const toggleBookmark = useStore((s) => s.toggleBookmark);

  const [query, setQuery] = useState("");
  const [activeSubject, setActiveSubject] = useState<string | "all">("all");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  // Extract all formulas
  const allFormulas: FormulaItem[] = useMemo(() => {
    const out: FormulaItem[] = [];
    for (const sub of CURRICULUM) {
      for (const ch of sub.chapters) {
        if (ch.formulas && ch.formulas.length > 0) {
          ch.formulas.forEach((f, i) => {
            out.push({
              subjectId: sub.id,
              subjectName: sub.name,
              subjectAccent: sub.accent,
              subjectIcon: sub.icon,
              chapterId: ch.id,
              chapterTitle: ch.title,
              formula: f,
              key: `${ch.id}-${i}`,
            });
          });
        }
      }
    }
    return out;
  }, []);

  const filtered = useMemo(() => {
    let list = allFormulas;
    if (activeSubject !== "all") {
      list = list.filter((f) => f.subjectId === activeSubject);
    }
    if (bookmarkedOnly) {
      list = list.filter((f) => bookmarks.includes(f.chapterId));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (f) =>
          f.formula.toLowerCase().includes(q) ||
          f.chapterTitle.toLowerCase().includes(q) ||
          f.subjectName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allFormulas, activeSubject, bookmarkedOnly, bookmarks, query]);

  const chaptersWithFormulas = useMemo(() => {
    const set = new Set<string>();
    allFormulas.forEach((f) => set.add(f.chapterId));
    return set.size;
  }, [allFormulas]);

  const subjectsCovered = useMemo(() => {
    const set = new Set<string>();
    allFormulas.forEach((f) => set.add(f.subjectId));
    return set.size;
  }, [allFormulas]);

  const copyFormula = async (formula: string) => {
    try {
      await navigator.clipboard.writeText(formula);
      toast.success("Copied to clipboard", { description: formula });
    } catch {
      toast.error("Could not copy");
    }
  };

  const exportAll = () => {
    const grouped: Record<string, FormulaItem[]> = {};
    for (const f of allFormulas) {
      (grouped[f.subjectId] ??= []).push(f);
    }
    let html = "";
    for (const sub of CURRICULUM) {
      const items = grouped[sub.id];
      if (!items?.length) continue;
      html += `<h2>${sub.icon} ${sub.name}</h2>`;
      // Group by chapter
      const byChapter: Record<string, FormulaItem[]> = {};
      for (const it of items) (byChapter[it.chapterId] ??= []).push(it);
      for (const ch of sub.chapters) {
        const cs = byChapter[ch.id];
        if (!cs?.length) continue;
        html += `<h3>${ch.title}</h3><ul>`;
        for (const f of cs) {
          html += `<li><code>${f.formula}</code></li>`;
        }
        html += "</ul>";
      }
    }
    exportPDF({
      title: `CBSE Class ${scholarClass} Formula Sheet`,
      subtitle: "All subjects",
      bodyHtml: html,
      accent: "#6366f1",
      scholarClass,
    });
    toast.success("Opening PDF…", { description: `${allFormulas.length} formulas across ${subjectsCovered} subjects.` });
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
  .cinema-glass {
    background: rgba(255,255,255,0.03);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 25px 80px -12px rgba(0,0,0,0.3);
    color: white;
  }
  .cinema-glass:hover { background: rgba(255,255,255,0.05); }
  .cinema-font-serif { font-family: 'Instrument Serif', serif; }
  .cinema-font-body { font-family: 'Inter', sans-serif; }
  .cinema-glass .text-muted-foreground { color: rgba(255,255,255,0.6) !important; }
  .cinema-glass input, .cinema-glass textarea, .cinema-glass select {
    background: rgba(255,255,255,0.05) !important;
    border-color: rgba(255,255,255,0.15) !important;
    color: white !important;
  }
  .cinema-glass .bg-muted { background: rgba(255,255,255,0.05) !important; }
  .cinema-glass .border-border { border-color: rgba(255,255,255,0.1) !important; }
`}</style>
      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-40">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/50" />
      <div className="relative z-10 p-4 md:p-8 lg:p-12">
        <h1 className="cinema-font-serif text-4xl text-white mb-6">Master Every <em>Formula</em></h1>
        <div className="space-y-6 view-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="grid place-items-center h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 text-indigo-300">
          <Sigma className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Formula Explorer</h1>
          <p className="text-sm text-muted-foreground">Searchable library of every formula in your CBSE Class {scholarClass} syllabus.</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={SigmaIcon} label="Total Formulas" value={allFormulas.length} sub="across all subjects" accent="#6366f1" />
        <StatCard icon={BookOpen} label="Chapters with Formulas" value={chaptersWithFormulas} sub="of 75 total chapters" accent="#14b8a6" />
        <StatCard icon={FileText} label="Subjects Covered" value={subjectsCovered} sub="of 5 subjects" accent="#f59e0b" />
      </div>

      {/* Search + filters */}
      <div className="cinema-glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by formula, chapter, or subject…"
              className="pl-9"
            />
          </div>
          <Button
            variant={bookmarkedOnly ? "default" : "outline"}
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setBookmarkedOnly((v) => !v)}
          >
            <Star className={`h-3.5 w-3.5 ${bookmarkedOnly ? "fill-current" : ""}`} /> Bookmarked
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={exportAll}
          >
            <Download className="h-3.5 w-3.5" /> Export all
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Pill active={activeSubject === "all"} onClick={() => setActiveSubject("all")} color="#6366f1">
            All subjects
          </Pill>
          {CURRICULUM.map((s) => (
            <Pill
              key={s.id}
              active={activeSubject === s.id}
              onClick={() => setActiveSubject(s.id)}
              color={s.accent}
            >
              {s.icon} {s.name}
            </Pill>
          ))}
        </div>
      </div>

      {/* Formula grid */}
      <div>
        <SectionHeader
          title={`${filtered.length} formula${filtered.length === 1 ? "" : "s"}`}
          subtitle={bookmarkedOnly ? "Showing bookmarked chapters only" : "Click ⭐ to bookmark a chapter · Copy to clipboard"}
        />
        {filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No formulas match"
            description="Try a different search or clear your filters."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((f, i) => {
              const isBm = bookmarks.includes(f.chapterId);
              return (
                <motion.div
                  key={f.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                >
                  <div className="cinema-glass rounded-2xl premium-card-hover p-4 h-full flex flex-col gap-3 relative overflow-hidden">
                    {/* Subject color stripe */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ background: f.subjectAccent }}
                    />
                    <div className="flex items-start justify-between gap-2 pl-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                        <span>{f.subjectIcon}</span>
                        <span className="truncate">{f.chapterTitle}</span>
                      </div>
                      <button
                        onClick={() => {
                          toggleBookmark(f.chapterId);
                          toast.success(isBm ? "Bookmark removed" : "Chapter bookmarked");
                        }}
                        className="shrink-0 hover:scale-110 transition-transform"
                        title={isBm ? "Remove bookmark" : "Bookmark chapter"}
                      >
                        <Star className={`h-4 w-4 ${isBm ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                      </button>
                    </div>

                    {/* Formula — large, monospace, centered */}
                    <div className="flex-1 grid place-items-center py-3 px-2 rounded-lg bg-muted/40 min-h-[60px]">
                      <code className="text-sm sm:text-base font-mono font-semibold text-center break-all">
                        {f.formula}
                      </code>
                    </div>

                    <div className="flex items-center justify-between gap-2 pl-2">
                      <Badge variant="secondary" className="text-[10px]" style={{ color: f.subjectAccent }}>
                        {f.subjectName}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 text-xs"
                        onClick={() => copyFormula(f.formula)}
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  </div>
  );
}
