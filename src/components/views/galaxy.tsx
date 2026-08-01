"use client";

import { useStore } from "@/lib/store";
import { CURRICULUM, type Chapter, type Subject } from "@/lib/curriculum";
import { useCurriculum } from "@/lib/use-curriculum";
import { navigateTo } from "@/lib/nav-event";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProgressRing } from "@/lib/shared";
import {
  Orbit, ZoomIn, ZoomOut, RotateCcw, GraduationCap, Brain, FileText, Target,
  Play, Pause,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Pre-generated random star field (stable across renders).
const STARS = Array.from({ length: 50 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 1.8 + 0.4,
  delay: Math.random() * 4,
  duration: Math.random() * 2.5 + 2,
}));

interface PlanetInfo {
  subject: Subject;
  radius: number; // orbit radius
  speed: number; // animation duration in seconds
  size: number; // planet diameter
  startAngle: number;
}

const ORBIT_RADII = [120, 165, 215, 265, 320];
const ORBIT_SPEEDS = [38, 50, 64, 80, 96]; // outer = slower
const PLANET_SIZES = [42, 36, 38, 32, 30];

export function GalaxyView() {
  const CURRICULUM = useCurriculum();
  const mastery = useStore((s) => s.mastery);
  const studyProgress = useStore((s) => s.studyProgress);

  const [zoom, setZoom] = useState(1);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<{ subject: Subject; chapter: Chapter } | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [touring, setTouring] = useState(false);

  // Responsive: compact mode for small screens (avoids setState-in-effect:
  // lazy initializer runs once on client; resize listener calls setState in handler, not effect body).
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640
  );
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [CURRICULUM]);

  // Tour: cycles through each subject for 3s. setState lives inside the interval
  // callback (NOT in the effect body), so it satisfies react-hooks/set-state-in-effect.
  const tourIdxRef = useRef(0);
  useEffect(() => {
    if (!touring) return;
    const id = setInterval(() => {
      tourIdxRef.current = (tourIdxRef.current + 1) % CURRICULUM.length;
      setActiveSubject(CURRICULUM[tourIdxRef.current].id);
    }, 3000);
    return () => clearInterval(id);
  }, [touring]);

  const startTour = useCallback(() => {
    tourIdxRef.current = 0;
    setFocusMode(true);
    setActiveSubject(CURRICULUM[0].id);
    setTouring(true);
    toast.info("Galaxy tour started", { description: "Cycling through your subjects — 3s each." });
  }, [CURRICULUM]);

  const stopTour = useCallback(() => {
    setTouring(false);
    toast.success("Tour ended");
  }, [CURRICULUM]);

  // Planets (responsive scaling for mobile).
  const planets: PlanetInfo[] = useMemo(() => {
    const scale = compact ? 0.62 : 1;
    const sizeScale = compact ? 0.82 : 1;
    return CURRICULUM.map((s, i) => ({
      subject: s,
      radius: ORBIT_RADII[i] * scale,
      speed: ORBIT_SPEEDS[i],
      size: PLANET_SIZES[i] * sizeScale,
      startAngle: (i * 72) % 360,
    }));
  }, [compact, CURRICULUM]);

  // Which planets to render: in focus mode, only the active subject's planet.
  // When focus mode is ON but no subject picked yet, default to the first subject
  // (handled in toggleFocus), so visiblePlanets is always sensible.
  const visiblePlanets = useMemo(
    () =>
      focusMode && activeSubject
        ? planets.filter((p) => p.subject.id === activeSubject)
        : planets,
    [planets, focusMode, activeSubject, CURRICULUM]
  );

  const totalChaptersExplored = CURRICULUM.reduce(
    (a, s) => a + s.chapters.filter((c) => (studyProgress[c.id] ?? 0) > 0).length,
    0
  );
  const masteryValues = Object.values(mastery);
  const avgMastery = masteryValues.length > 0 ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length : 0;
  const subjectsWithMastery = CURRICULUM.filter((s) => (mastery[s.id] ?? 0) > 0).length;

  const toggleFocus = useCallback(() => {
    setFocusMode((f) => {
      const next = !f;
      if (next && !activeSubject) {
        // Default to first subject so focus mode is immediately useful.
        setActiveSubject(CURRICULUM[0].id);
        tourIdxRef.current = 0;
      }
      if (!next) {
        // Exiting focus also stops any active tour.
        setTouring(false);
      }
      return next;
    });
  }, [activeSubject, CURRICULUM]);

  const pickSubject = useCallback((id: string) => {
    setActiveSubject((cur) => (cur === id ? null : id));
    setTouring(false);
  }, [CURRICULUM]);

  const reset = useCallback(() => {
    setZoom(1);
    setActiveSubject(null);
    setFocusMode(false);
    setTouring(false);
  }, [CURRICULUM]);

  // Chapter detail action handlers (navigate via global event system).
  const openStudy = useCallback(() => {
    setSelectedChapter(null);
    navigateTo("study");
    toast.success("Opening Study view…");
  }, [CURRICULUM]);
  const openQuiz = useCallback(() => {
    setSelectedChapter(null);
    navigateTo("quiz");
    toast.success("Opening Quiz view…");
  }, [CURRICULUM]);
  const openResources = useCallback(() => {
    setSelectedChapter(null);
    navigateTo("resources");
    toast.success("Opening Resources view…");
  }, [CURRICULUM]);

  const sunSize = compact ? 56 : 80;

  return (
    <div className="space-y-6 view-enter">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 text-fuchsia-300">
            <Orbit className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Concept Galaxy</h1>
            <p className="text-sm text-muted-foreground">Your knowledge, visualized as a living solar system.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant={touring ? "default" : "outline"}
            className="gap-1.5"
            onClick={touring ? stopTour : startTour}
          >
            {touring ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {touring ? "Stop" : "Tour"}
          </Button>
          <Button
            size="sm"
            variant={focusMode ? "default" : "outline"}
            className="gap-1.5"
            onClick={toggleFocus}
          >
            <Target className="h-3.5 w-3.5" /> {focusMode ? "Focused" : "Focus"}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {/* Subject picker pills (focus / tour mode) */}
      {(focusMode || touring) && (
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">
            {touring ? "Touring" : "Focus on"}:
          </span>
          {CURRICULUM.map((s, i) => {
            const active = activeSubject === s.id;
            return (
              <button
                key={s.id}
                onClick={() => pickSubject(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  active ? "text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
                style={active ? { background: s.accent } : undefined}
              >
                <span>{s.icon}</span>
                {s.name}
                {touring && active && (
                  <span className="ml-1 text-[10px] opacity-80">#{i + 1}/{CURRICULUM.length}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Galaxy canvas */}
        <div className="lg:col-span-3">
          <Card className="premium-card p-0 overflow-hidden">
            <div
              className="relative w-full overflow-hidden rounded-xl"
              style={{
                aspectRatio: "1 / 1",
                background: "radial-gradient(ellipse at center, #1e1b4b 0%, #0f0a2e 45%, #050314 100%)",
                transform: `scale(${zoom})`,
                transformOrigin: "center",
                transition: "transform 0.3s ease",
              }}
            >
              {/* Subtle twinkling stars */}
              {STARS.map((s, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-white pointer-events-none"
                  style={{
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    width: `${s.size}px`,
                    height: `${s.size}px`,
                    animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
                  }}
                />
              ))}
              <style>{`@keyframes twinkle { 0%,100% { opacity: 0.12; } 50% { opacity: 0.55; } } @keyframes orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes orbit-rev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }`}</style>

              {/* Orbit rings (only visible planets) */}
              {visiblePlanets.map((p, i) => (
                <div
                  key={`ring-${p.subject.id}-${i}`}
                  className="absolute rounded-full border"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: `${p.radius * 2}px`,
                    height: `${p.radius * 2}px`,
                    marginLeft: `-${p.radius}px`,
                    marginTop: `-${p.radius}px`,
                    borderColor: `${p.subject.accent}33`,
                    borderStyle: "dashed",
                  }}
                />
              ))}

              {/* Sun (center) */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <div
                  className="rounded-full grid place-items-center"
                  style={{
                    width: sunSize,
                    height: sunSize,
                    background: "radial-gradient(circle at 35% 35%, #fde68a, #f59e0b 45%, #b45309 100%)",
                    boxShadow: "0 0 60px 10px rgba(245,158,11,0.5), 0 0 120px 30px rgba(245,158,11,0.2)",
                    animation: "twinkle 3.5s ease-in-out infinite",
                  }}
                >
                  <span style={{ fontSize: sunSize * 0.4 }}>🦋</span>
                </div>
                <p className="text-center mt-1 text-[10px] text-amber-200/80 font-medium">Your Sun</p>
              </div>

              {/* Planets */}
              {visiblePlanets.map((p, i) => {
                const m = mastery[p.subject.id] ?? 0;
                const isActive = activeSubject === p.subject.id;
                const glow = m > 70;
                const sizeWithMastery =
                  focusMode && isActive
                    ? Math.max(54, p.size * 1.45)
                    : Math.max(22, p.size * (0.7 + m / 200));
                // Spread planets around their orbit at start (negative delay = pre-roll).
                const orbitDelay = -(p.startAngle / 360) * p.speed;
                return (
                  <div
                    key={`orbit-${p.subject.id}-${i}`}
                    className="absolute left-1/2 top-1/2"
                    style={{
                      width: `${p.radius * 2}px`,
                      height: `${p.radius * 2}px`,
                      marginLeft: `-${p.radius}px`,
                      marginTop: `-${p.radius}px`,
                      animation: `orbit ${p.speed}s linear infinite`,
                      animationDelay: `${orbitDelay}s`,
                    }}
                  >
                    {/* Planet positioned on the orbit ring (top), counter-rotated to stay upright */}
                    <div
                      className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 group"
                      style={{ animation: `orbit-rev ${p.speed}s linear infinite`, animationDelay: `${orbitDelay}s` }}
                    >
                      <button
                        onClick={() => pickSubject(p.subject.id)}
                        className="relative grid place-items-center rounded-full transition-transform hover:scale-110"
                        style={{
                          width: sizeWithMastery,
                          height: sizeWithMastery,
                          background: `radial-gradient(circle at 30% 30%, ${p.subject.accent}, ${p.subject.accent}88 60%, ${p.subject.accent}33 100%)`,
                          boxShadow: glow
                            ? `0 0 25px 4px ${p.subject.accent}aa, 0 0 50px 8px ${p.subject.accent}55`
                            : `0 0 12px 2px ${p.subject.accent}66`,
                          border: isActive ? "2px solid white" : `1.5px solid ${p.subject.accent}`,
                        }}
                      >
                        <span className="text-base leading-none">{p.subject.icon}</span>

                        {/* Tooltip on hover */}
                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                          <div className="bg-black/85 backdrop-blur rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap border border-white/20">
                            <p className="font-semibold">{p.subject.name} · {m}%</p>
                            <p className="text-white/70">{p.subject.chapters.length} chapters</p>
                          </div>
                        </div>

                        {/* Chapter moons (only for the active subject) */}
                        <AnimatePresence>
                          {isActive && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                              style={{
                                width: (sizeWithMastery + 36) * 2,
                                height: (sizeWithMastery + 36) * 2,
                                animation: `orbit 22s linear infinite`,
                              }}
                            >
                              {p.subject.chapters.slice(0, 8).map((c, ci) => {
                                const count = Math.min(8, p.subject.chapters.length);
                                const ang = (ci / count) * Math.PI * 2 - Math.PI / 2;
                                const moonOrbitR = sizeWithMastery + 36;
                                const mx = moonOrbitR + Math.cos(ang) * moonOrbitR;
                                const my = moonOrbitR + Math.sin(ang) * moonOrbitR;
                                const prog = studyProgress[c.id] ?? 0;
                                const moonSize = compact ? 22 : 26;
                                return (
                                  <div
                                    key={c.id}
                                    className="absolute pointer-events-auto"
                                    style={{
                                      left: `${mx}px`,
                                      top: `${my}px`,
                                      transform: "translate(-50%, -50%)",
                                      animation: `orbit-rev 22s linear infinite`,
                                    }}
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedChapter({ subject: p.subject, chapter: c });
                                      }}
                                      className="block rounded-full hover:scale-125 transition-transform"
                                      title={`${c.title} · ${prog}%`}
                                    >
                                      <ProgressRing
                                        value={prog}
                                        size={moonSize}
                                        stroke={2.5}
                                        color={p.subject.accent}
                                        label={
                                          <span className="text-[8px] font-semibold leading-none" style={{ color: p.subject.accent }}>
                                            {ci + 1}
                                          </span>
                                        }
                                      />
                                    </button>
                                  </div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>

                      {/* Mastery label */}
                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2">
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-black/60 backdrop-blur whitespace-nowrap"
                          style={{ color: p.subject.accent }}
                        >
                          {p.subject.name.split(" ")[0]} · {m}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Focus mode empty hint */}
              {focusMode && visiblePlanets.length === 0 && (
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <p className="text-sm text-muted-foreground">Pick a subject above to focus on.</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <Card className="premium-card p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Galaxy Stats</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active planets</span>
                <span className="font-semibold tabular-nums">{subjectsWithMastery}/5</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Moons explored</span>
                <span className="font-semibold tabular-nums">{totalChaptersExplored}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Galaxy mastery</span>
                <span className="font-semibold tabular-nums">{Math.round(avgMastery)}%</span>
              </div>
            </div>
          </Card>

          <Card className="premium-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Subject Planets</p>
            <div className="space-y-2.5">
              {CURRICULUM.map((s) => {
                const m = mastery[s.id] ?? 0;
                return (
                  <button
                    key={s.id}
                    onClick={() => pickSubject(s.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${activeSubject === s.id ? "bg-muted" : "hover:bg-muted/60"}`}
                  >
                    <ProgressRing value={m} size={36} stroke={3.5} color={s.accent} label={<span className="text-base">{s.icon}</span>} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-medium truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.chapters.length} chapters · {m}%</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {activeSubject && (
            <Card className="premium-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span>{CURRICULUM.find((s) => s.id === activeSubject)?.icon}</span>
                <p className="text-sm font-semibold">{CURRICULUM.find((s) => s.id === activeSubject)?.name}</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Click a moon in the galaxy or a chapter below to open details.</p>
              <ScrollArea className="max-h-48">
                <div className="space-y-1 pr-2">
                  {CURRICULUM.find((s) => s.id === activeSubject)?.chapters.slice(0, 8).map((c, idx) => {
                    const prog = studyProgress[c.id] ?? 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedChapter({ subject: CURRICULUM.find((s) => s.id === activeSubject)!, chapter: c })}
                        className="w-full text-left text-xs p-1.5 rounded hover:bg-muted/60 transition-colors truncate flex items-center gap-2"
                      >
                        <span
                          className="grid place-items-center h-5 w-5 rounded-full text-[9px] font-semibold shrink-0"
                          style={{ background: `${CURRICULUM.find((s) => s.id === activeSubject)!.accent}22`, color: CURRICULUM.find((s) => s.id === activeSubject)!.accent }}
                        >
                          {idx + 1}
                        </span>
                        <span className="flex-1 truncate">{c.title}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{prog}%</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
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
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{subject.icon}</span>
                    <Badge variant="secondary" className="text-[10px]">{subject.name}</Badge>
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
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={openStudy}>
                      <GraduationCap className="h-3.5 w-3.5" /> Study
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={openQuiz}>
                      <Brain className="h-3.5 w-3.5" /> Quiz
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={openResources}>
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
