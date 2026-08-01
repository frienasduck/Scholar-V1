"use client";

import { useStore } from "@/lib/store";
import { CURRICULUM, type Chapter, type Subject } from "@/lib/curriculum";
import { useCurriculum } from "@/lib/use-curriculum";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProgressRing, SectionHeader } from "@/lib/shared";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network, ZoomIn, ZoomOut, RotateCcw, Sparkles, Brain, Star,
  GraduationCap, FileText,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { useState, useMemo, useRef } from "react";

interface NodePos { id: string; x: number; y: number; }

export function MindMapView() {
  const CURRICULUM = useCurriculum();
  const mastery = useStore((s) => s.mastery);
  const studyProgress = useStore((s) => s.studyProgress);
  const bookmarks = useStore((s) => s.bookmarks);

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<{ subject: Subject; chapter: Chapter } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [scope, setScope] = useState<"all" | string>("all");
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 900;
  const H = 640;
  const cx = W / 2;
  const cy = H / 2;

  const subjects = useMemo(() => CURRICULUM, []);
  const visibleSubjects = scope === "all" ? subjects : subjects.filter((s) => s.id === scope);

  // Position subject nodes radially around center
  const subjectPositions: Record<string, NodePos> = useMemo(() => {
    const out: Record<string, NodePos> = {};
    const total = visibleSubjects.length;
    visibleSubjects.forEach((s, i) => {
      const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
      const r = 220;
      out[s.id] = { id: s.id, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });
    return out;
  }, [visibleSubjects, cx, cy]);

  // Chapter positions around selected subject
  const chapterPositions: Record<string, NodePos> = useMemo(() => {
    if (!selectedSubject) return {};
    const sub = subjects.find((s) => s.id === selectedSubject);
    if (!sub) return {};
    const pos = subjectPositions[selectedSubject];
    const out: Record<string, NodePos> = {};
    sub.chapters.forEach((c, i) => {
      const total = sub.chapters.length;
      const angle = (i / total) * Math.PI * 2;
      const r = 130;
      out[c.id] = { id: c.id, x: pos.x + Math.cos(angle) * r, y: pos.y + Math.sin(angle) * r };
    });
    return out;
  }, [selectedSubject, subjects, subjectPositions]);

  // Stats
  const totalNodes = 1 + subjects.length + subjects.reduce((a, s) => a + s.chapters.length, 0);
  const chaptersExplored = subjects.reduce(
    (a, s) => a + s.chapters.filter((c) => (studyProgress[c.id] ?? 0) > 0).length,
    0
  );
  const masteryValues = Object.values(mastery);
  const avgMastery = masteryValues.length > 0 ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length : 0;

  const reset = () => {
    setSelectedSubject(null);
    setZoom(1);
    setScope("all");
  };

  const handleSubjectClick = (subjectId: string) => {
    if (selectedSubject === subjectId) {
      setSelectedSubject(null);
    } else {
      setSelectedSubject(subjectId);
    }
  };

  const handleChapterClick = (subject: Subject, chapter: Chapter) => {
    setSelectedChapter({ subject, chapter });
  };

  // Curved bezier path between two points
  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const offset = Math.min(40, dist * 0.15);
    // perpendicular offset for curve control point
    const px = mx - dy / (dist || 1) * offset;
    const py = my + dx / (dist || 1) * offset;
    return `M ${x1} ${y1} Q ${px} ${py} ${x2} ${y2}`;
  };

  const selectedSub = selectedSubject ? subjects.find((s) => s.id === selectedSubject) : null;

  return (
    <div className="space-y-6 view-enter">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-teal-500/30 text-indigo-300">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mind Map</h1>
            <p className="text-sm text-muted-foreground">Interactive knowledge graph across all 5 subjects.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setZoom((z) => Math.min(2, z + 0.15))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Canvas */}
        <div className="lg:col-span-3">
          <Card className="premium-card p-2 overflow-hidden">
            <div className="relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-background via-background to-indigo-950/20" style={{ aspectRatio: "900 / 640" }}>
              {/* Scope filter pills */}
              <div className="absolute top-3 left-3 z-10 flex gap-1 flex-wrap">
                <button
                  onClick={() => { setScope("all"); setSelectedSubject(null); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${scope === "all" ? "bg-indigo-500 text-white" : "bg-card/80 text-muted-foreground hover:text-foreground border border-border/60"}`}
                >
                  All
                </button>
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setScope(s.id); setSelectedSubject(null); }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${scope === s.id ? "text-white" : "bg-card/80 text-muted-foreground hover:text-foreground border border-border/60"}`}
                    style={scope === s.id ? { background: s.accent } : undefined}
                  >
                    <span>{s.icon}</span>
                    {s.name.split(" ")[0]}
                  </button>
                ))}
              </div>

              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-full"
                style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.3s ease" }}
              >
                <defs>
                  <radialGradient id="centerGlow" cx="50%" cy="50%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                  </radialGradient>
                  {subjects.map((s) => (
                    <radialGradient key={`g-${s.id}`} id={`grad-${s.id}`} cx="50%" cy="50%">
                      <stop offset="0%" stopColor={s.accent} stopOpacity="0.9" />
                      <stop offset="100%" stopColor={s.accent} stopOpacity="0.6" />
                    </radialGradient>
                  ))}
                </defs>

                {/* Center glow */}
                <circle cx={cx} cy={cy} r={120} fill="url(#centerGlow)" />

                {/* Connectors: center → subjects */}
                {visibleSubjects.map((s) => {
                  const pos = subjectPositions[s.id];
                  if (!pos) return null;
                  return (
                    <path
                      key={`c-${s.id}`}
                      d={curve(cx, cy, pos.x, pos.y)}
                      fill="none"
                      stroke={s.accent}
                      strokeWidth={selectedSubject === s.id ? 3 : 1.5}
                      strokeOpacity={selectedSubject && selectedSubject !== s.id ? 0.2 : 0.55}
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Connectors: subject → chapters (when selected) */}
                {selectedSub && selectedSub.chapters.map((c) => {
                  const sp = subjectPositions[selectedSub.id];
                  const cp = chapterPositions[c.id];
                  if (!sp || !cp) return null;
                  return (
                    <path
                      key={`ch-${c.id}`}
                      d={curve(sp.x, sp.y, cp.x, cp.y)}
                      fill="none"
                      stroke={selectedSub.accent}
                      strokeWidth={1}
                      strokeOpacity={0.35}
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Center node */}
                <g>
                  <circle cx={cx} cy={cy} r={36} fill="#1e1b4b" stroke="#6366f1" strokeWidth={2} className="pulse-ring" />
                  <text x={cx} y={cy - 2} textAnchor="middle" fontSize={22}>🦋</text>
                  <text x={cx} y={cy + 16} textAnchor="middle" fontSize={10} fill="#a5b4fc" fontWeight={600}>Student</text>
                </g>

                {/* Subject nodes (foreignObject for styling) */}
                {visibleSubjects.map((s) => {
                  const pos = subjectPositions[s.id];
                  if (!pos) return null;
                  const m = mastery[s.id] ?? 0;
                  const active = selectedSubject === s.id;
                  return (
                    <foreignObject
                      key={`s-${s.id}`}
                      x={pos.x - 50}
                      y={pos.y - 36}
                      width={100}
                      height={72}
                      style={{ overflow: "visible" }}
                    >
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleSubjectClick(s.id)}
                        className="cursor-pointer flex flex-col items-center gap-1"
                        style={{ filter: active ? `drop-shadow(0 0 12px ${s.accent}aa)` : "none" }}
                      >
                        <div
                          className="grid place-items-center h-14 w-14 rounded-full border-2"
                          style={{
                            background: `radial-gradient(circle at 30% 30%, ${s.accent}cc, ${s.accent}77)`,
                            borderColor: s.accent,
                          }}
                        >
                          <span className="text-xl">{s.icon}</span>
                        </div>
                        <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-card/80 backdrop-blur" style={{ color: s.accent }}>
                          {m}%
                        </div>
                      </motion.div>
                    </foreignObject>
                  );
                })}

                {/* Chapter nodes */}
                {selectedSub && selectedSub.chapters.map((c) => {
                  const pos = chapterPositions[c.id];
                  if (!pos) return null;
                  const p = studyProgress[c.id] ?? 0;
                  return (
                    <foreignObject
                      key={`n-${c.id}`}
                      x={pos.x - 28}
                      y={pos.y - 28}
                      width={56}
                      height={56}
                      style={{ overflow: "visible" }}
                    >
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleChapterClick(selectedSub, c)}
                        className="cursor-pointer grid place-items-center"
                      >
                        <div
                          className="relative h-12 w-12 rounded-full grid place-items-center"
                          style={{
                            background: `${selectedSub.accent}22`,
                            border: `1.5px solid ${selectedSub.accent}aa`,
                          }}
                        >
                          <svg width={40} height={40} className="absolute inset-0 m-auto -rotate-90">
                            <circle cx={20} cy={20} r={16} fill="none" stroke="currentColor" strokeWidth={3} className="text-muted/60" />
                            <circle
                              cx={20} cy={20} r={16} fill="none" stroke={selectedSub.accent} strokeWidth={3}
                              strokeDasharray={2 * Math.PI * 16}
                              strokeDashoffset={2 * Math.PI * 16 * (1 - p / 100)}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="text-[9px] font-bold tabular-nums" style={{ color: selectedSub.accent }}>{p}%</span>
                        </div>
                        <span className="absolute top-full mt-1 max-w-[80px] text-[9px] text-center text-muted-foreground leading-tight line-clamp-2 px-1">
                          {c.title.split("(")[0].trim()}
                        </span>
                      </motion.div>
                    </foreignObject>
                  );
                })}
              </svg>
            </div>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <Card className="premium-card p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Map Stats</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total nodes</span>
                <span className="font-semibold tabular-nums">{totalNodes}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Chapters explored</span>
                <span className="font-semibold tabular-nums">{chaptersExplored}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg mastery</span>
                <span className="font-semibold tabular-nums">{Math.round(avgMastery)}%</span>
              </div>
            </div>
          </Card>

          {selectedSub ? (
            <Card className="premium-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{selectedSub.icon}</span>
                <p className="font-semibold">{selectedSub.name}</p>
                <Badge variant="secondary" className="ml-auto">{selectedSub.chapters.length} chapters</Badge>
              </div>
              <ScrollArea className="max-h-96">
                <div className="space-y-1.5 pr-2">
                  {selectedSub.chapters.map((c) => {
                    const p = studyProgress[c.id] ?? 0;
                    const isBm = bookmarks.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleChapterClick(selectedSub, c)}
                        className="w-full text-left rounded-lg p-2 hover:bg-muted/50 transition-colors flex items-center gap-2 group"
                      >
                        <ProgressRing value={p} size={28} stroke={3} color={selectedSub.accent} label={<span className="text-[8px]">{p}</span>} />
                        <span className="text-xs flex-1 line-clamp-1">{c.title}</span>
                        {isBm && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>
          ) : (
            <Card className="premium-card p-4 text-center">
              <Sparkles className="h-8 w-8 mx-auto text-indigo-400 mb-2" />
              <p className="text-sm font-medium">Pick a subject</p>
              <p className="text-xs text-muted-foreground mt-1">Click any subject node to expand its chapters.</p>
            </Card>
          )}
        </div>
      </div>

      {/* Chapter detail modal */}
      <Dialog open={!!selectedChapter} onOpenChange={(o) => !o && setSelectedChapter(null)}>
        <DialogContent className="max-w-lg">
          {selectedChapter && (() => {
            const { subject, chapter } = selectedChapter;
            const p = studyProgress[chapter.id] ?? 0;
            const m = mastery[subject.id] ?? 0;
            const isBm = bookmarks.includes(chapter.id);
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{subject.icon}</span>
                    <Badge variant="secondary" className="text-[10px]">{subject.name}</Badge>
                    {isBm && <Badge variant="secondary" className="gap-1 text-[10px]"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Bookmarked</Badge>}
                  </div>
                  <DialogTitle>{chapter.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">{chapter.summary}</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/60 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Progress</p>
                      <p className="text-xl font-semibold tabular-nums" style={{ color: subject.accent }}>{p}%</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Subject Mastery</p>
                      <p className="text-xl font-semibold tabular-nums">{m}%</p>
                    </div>
                  </div>

                  {chapter.concepts.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Key Concepts</p>
                      <div className="flex flex-wrap gap-1.5">
                        {chapter.concepts.map((c) => (
                          <span key={c} className="px-2 py-0.5 rounded-md text-xs bg-muted">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {chapter.formulas && chapter.formulas.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Formulas</p>
                      <div className="space-y-1">
                        {chapter.formulas.map((f) => (
                          <div key={f} className="px-3 py-1.5 rounded-md bg-muted/60 font-mono text-sm">{f}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => toast.success("Opening Study view…")}>
                      <GraduationCap className="h-3.5 w-3.5" /> Study
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => toast.success("Generating quiz…")}>
                      <Brain className="h-3.5 w-3.5" /> Quiz
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => toast.success("Opening Resources…")}>
                      <FileText className="h-3.5 w-3.5" /> Resources
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
