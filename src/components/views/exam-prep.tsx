"use client";

import { useStore, type QuizAttempt, type QuizQuestion } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { CURRICULUM } from "@/lib/curriculum";
import { askAIJSON } from "@/lib/ai";
import { exportPDF } from "@/lib/pdf";
import { StatCard, SectionHeader, ProgressRing } from "@/lib/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import {
  Trophy, TrendingUp, FileText, Clock, Sparkles, Award,
  GraduationCap, Medal, Download, Play,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

interface MockTest { id: string; subject: string; year: string; subjectId: string; }

export function ExamPrepView() {
  const mastery = useStore((s) => s.mastery);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const CURRICULUM = useCurriculum();

  // Class-aware mock tests + previous-year papers sourced from the active curriculum
  const MOCK_TESTS: MockTest[] = CURRICULUM.map((sub) => ({
    id: `m-${sub.id}-2023`, subject: sub.name, year: "2023", subjectId: sub.id,
  }));
  const PY_PAPERS = CURRICULUM.map((sub, i) => ({
    subject: sub.name, year: ["2022", "2022", "2021", "2021", "2020"][i] ?? "2022", subjectId: sub.id,
  }));
  const quizAttempts = useStore((s) => s.quizAttempts);
  const sessions = useStore((s) => s.sessions);
  const pushActivity = useStore((s) => s.pushActivity);
  const addXP = useStore((s) => s.addXP);
  const addQuizAttempt = useStore((s) => s.addQuizAttempt);

  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ subjectId: string; subject: string; questions: QuizQuestion[] } | null>(null);

  // Readiness
  const masteryValues = Object.values(mastery);
  const avgMastery = masteryValues.length > 0 ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length : 0;
  const readiness = Math.round(avgMastery);
  const readinessColor = readiness < 40 ? "#f43f5e" : readiness < 70 ? "#f59e0b" : "#10b981";
  const readinessLabel = readiness < 40 ? "Needs work" : readiness < 70 ? "Almost there" : "Exam-ready";

  // Quiz avg
  const quizAvg = useMemo(() => {
    if (quizAttempts.length === 0) return 0;
    const pct = quizAttempts.reduce((sum, a) => sum + (a.score / a.total) * 100, 0) / quizAttempts.length;
    return Math.round(pct);
  }, [quizAttempts]);

  // Rank prediction (simulated)
  const classRank = Math.max(1, Math.round(60 - (readiness * 0.4 + quizAvg * 0.2)));
  const schoolRank = Math.max(1, Math.round(240 - (readiness * 1.5 + quizAvg * 0.8)));
  const totalStudents = 60;
  const totalSchool = 240;

  // Time per subject from sessions
  const timePerSubject = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sessions) {
      if (s.subject) {
        map[s.subject] = (map[s.subject] ?? 0) + s.duration / 60; // minutes
      }
    }
    return CURRICULUM.map((sub) => ({
      subject: sub.name.split(" ")[0],
      minutes: Math.round(map[sub.id] ?? 0),
      color: sub.accent,
    }));
  }, [sessions]);

  const generateMockTest = async (mt: MockTest) => {
    setGenerating(mt.id);
    setGenerated(null);
    toast("Generating mock test...", { description: `CBSE Class ${scholarClass} ${mt.subject} • 10 MCQs` });
    try {
      const prompt = `Generate 10 CBSE Class ${scholarClass} MCQ questions for ${mt.subject}. Return JSON: {"questions":[{"question":string,"options":[string,string,string,string],"answer":string,"explanation":string}]}. Make them exam-level, mixed difficulty, covering the full syllabus.`;
      const result = await askAIJSON<{ questions: { question: string; options: string[]; answer: string; explanation: string }[] }>(prompt, "default");
      if (!result?.questions?.length) throw new Error("No questions returned");
      const questions: QuizQuestion[] = result.questions.slice(0, 10).map((q, i) => ({
        id: `${mt.id}-q${i}`,
        type: "mcq",
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        subject: mt.subjectId,
        difficulty: "medium",
      }));
      // Save as an attempt-like object (score 0, awaiting actual quiz play)
      const attempt: QuizAttempt = {
        id: mt.id + "-" + Date.now(),
        subject: mt.subjectId,
        title: `Mock Test — ${mt.subject} ${mt.year}`,
        questions,
        responses: {},
        score: 0,
        total: questions.length,
        startedAt: Date.now(),
        finishedAt: 0,
        timeSpent: 0,
      };
      addQuizAttempt(attempt);
      addXP(10);
      pushActivity({ type: "quiz", text: `Generated mock test: ${mt.subject} ${mt.year} (10 questions)`, icon: "📝" });
      setGenerated({ subjectId: mt.subjectId, subject: mt.subject, questions });
      toast.success("Mock test ready! 10 questions loaded.", { description: "Open the Quiz view to attempt it." });
    } catch (e) {
      toast.error("Could not generate mock test", { description: "Please try again in a moment." });
    } finally {
      setGenerating(null);
    }
  };

  const exportPaper = (subject: string, year: string, subjectId: string) => {
    const sub = CURRICULUM.find((x) => x.id === subjectId);
    const chapters = sub?.chapters ?? [];
    const sampleQs = chapters.slice(0, 10).map((c, i) =>
      `<li><strong>Q${i + 1}.</strong> ${c.questions[0] ?? "Describe the key concepts of " + c.title} <em>(Chapter: ${c.title})</em></li>`
    ).join("");
    const bodyHtml = `
      <h2>${subject} — CBSE Class ${scholarClass} (Previous Year ${year})</h2>
      <p><strong>Time:</strong> 3 hours &nbsp; <strong>Marks:</strong> 80</p>
      <h3>General Instructions</h3>
      <ul>
        <li>All questions are compulsory.</li>
        <li>The question paper consists of 40 questions divided into 4 sections A, B, C, D.</li>
        <li>Section A contains 20 objective-type questions of 1 mark each.</li>
        <li>Section B contains 6 questions of 2 marks each.</li>
        <li>Section C contains 8 questions of 3 marks each.</li>
        <li>Section D contains 6 questions of 4 marks each.</li>
      </ul>
      <h3>Section A — Sample Questions (1 mark each)</h3>
      <ol>${sampleQs}</ol>
      <h3>Section B — Short Answer (2 marks)</h3>
      <p>Refer to the chapter summaries in your textbook for 2-mark question practice.</p>
      <blockquote>This is a simulated paper template for revision. Practice with your teacher's marking scheme.</blockquote>
    `;
    exportPDF({ title: `${subject} — Previous Year ${year}`, subtitle: `CBSE Class ${scholarClass} Practice Paper`, bodyHtml, accent: sub?.accent, scholarClass });
    toast.success("Opening PDF…", { description: `${subject} ${year} paper ready to print.` });
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
        .cinema-glass input::placeholder, .cinema-glass textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
        .cinema-glass button { color: white; }
        .cinema-glass .bg-muted { background: rgba(255,255,255,0.05) !important; }
        .cinema-glass .border-border { border-color: rgba(255,255,255,0.1) !important; }
      `}</style>
      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-40">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/50" />
      <div className="relative z-10 p-4 md:p-8 lg:p-12">
      <h1 className="cinema-font-serif text-4xl text-white mb-6">Exam <em>Readiness</em> Dashboard</h1>
      <div className="space-y-6 view-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="grid place-items-center h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-500/30 to-rose-500/30 text-amber-300">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exam Prep</h1>
          <p className="text-sm text-muted-foreground">Mock tests, readiness & rank prediction for CBSE Class {scholarClass}.</p>
        </div>
      </div>

      {/* Readiness + key stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="cinema-glass rounded-2xl p-6 flex flex-col items-center justify-center gap-4">
          <p className="text-sm font-medium text-muted-foreground">Exam Readiness</p>
          <ProgressRing value={readiness} size={140} stroke={12} color={readinessColor} label={
            <div className="text-center">
              <p className="text-3xl font-bold tabular-nums" style={{ color: readinessColor }}>{readiness}%</p>
            </div>
          } />
          <div className="text-center space-y-1">
            <Badge style={{ background: `${readinessColor}22`, color: readinessColor, border: `${readinessColor}55` }}>
              {readinessLabel}
            </Badge>
            <p className="text-xs text-muted-foreground">Avg mastery across 5 subjects</p>
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <StatCard icon={Award} label="Quiz Avg" value={`${quizAvg}%`} sub={`${quizAttempts.length} attempts`} accent="#6366f1" />
          <StatCard icon={Clock} label="Total Sessions" value={sessions.length} sub="focus sessions" accent="#14b8a6" />
          <StatCard icon={Medal} label="Class Rank" value={`#${classRank}`} sub={`of ${totalStudents} students`} accent="#f59e0b" />
          <StatCard icon={Trophy} label="School Rank" value={`#${schoolRank}`} sub={`of ${totalSchool} students`} accent="#f43f5e" />
        </div>
      </div>

      {/* Rank prediction detail */}
      <div className="cinema-glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-indigo-400" />
          <p className="font-semibold">Rank Prediction</p>
          <Badge variant="secondary" className="ml-auto text-[10px]">Simulated</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Predicted Class Rank</span>
              <span className="font-semibold tabular-nums">#{classRank} / {totalStudents}</span>
            </div>
            <Progress value={(classRank / totalStudents) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground">Top {Math.round((classRank / totalStudents) * 100)}% of your class.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Predicted School Rank</span>
              <span className="font-semibold tabular-nums">#{schoolRank} / {totalSchool}</span>
            </div>
            <Progress value={(schoolRank / totalSchool) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground">Top {Math.round((schoolRank / totalSchool) * 100)}% of your school.</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Based on avg mastery ({readiness}%) and quiz avg ({quizAvg}%). Real CBSE rank depends on the actual exam paper.
        </p>
      </div>

      {/* Mock tests */}
      <div>
        <SectionHeader title="Mock Tests" subtitle="AI-generated CBSE-style 10-question tests" action={
          <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" /> AI</Badge>
        } />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MOCK_TESTS.map((mt, i) => (
            <motion.div
              key={mt.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div className="cinema-glass rounded-2xl p-4 h-full flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="grid place-items-center h-10 w-10 rounded-lg bg-indigo-500/15 text-indigo-300">
                    <FileText className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary" className="gap-1">{mt.year}</Badge>
                </div>
                <div>
                  <p className="font-semibold">{mt.subject}</p>
                  <p className="text-xs text-muted-foreground">10 MCQs · ~15 min · exam-level</p>
                </div>
                <Button
                  size="sm"
                  className="w-full gap-1.5 mt-auto"
                  onClick={() => generateMockTest(mt)}
                  disabled={generating === mt.id}
                >
                  {generating === mt.id ? (
                    <><Sparkles className="h-3.5 w-3.5 animate-pulse" /> Generating…</>
                  ) : (
                    <><Play className="h-3.5 w-3.5" /> Start</>
                  )}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
        {generated && (
          <div className="cinema-glass rounded-2xl p-4 mt-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                Generated: {generated.subject} — 10 questions
              </p>
              <Button size="sm" variant="ghost" onClick={() => setGenerated(null)}>Clear</Button>
            </div>
            <ol className="space-y-2 text-sm max-h-72 overflow-y-auto scrollbar-thin pr-2">
              {generated.questions.map((q, i) => (
                <li key={q.id} className="rounded-lg border border-border/60 p-2.5 bg-muted/30">
                  <p className="font-medium">{i + 1}. {q.question}</p>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {q.options?.map((o, j) => (
                      <li key={j} className={o === q.answer ? "text-emerald-400 font-medium" : ""}>
                        {String.fromCharCode(65 + j)}. {o}{o === q.answer && " ✓"}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && <p className="text-xs italic text-muted-foreground mt-1">→ {q.explanation}</p>}
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground mt-2">Saved to your quiz history. Open the Quiz view to attempt it properly.</p>
          </div>
        )}
      </div>

      {/* Previous year papers */}
      <div>
        <SectionHeader title="Previous Year Papers" subtitle="Generate printable PDFs" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PY_PAPERS.map((p, i) => {
            const sub = CURRICULUM.find((x) => x.id === p.subjectId);
            return (
              <motion.div
                key={`${p.subject}-${p.year}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="cinema-glass rounded-2xl p-4 h-full flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="grid place-items-center h-10 w-10 rounded-lg shrink-0"
                      style={{ background: `${sub?.accent}1a`, color: sub?.accent }}
                    >
                      <FileText className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="gap-1">{p.year}</Badge>
                  </div>
                  <div>
                    <p className="font-semibold">{p.subject}</p>
                    <p className="text-xs text-muted-foreground">Full paper · 80 marks · 3 hrs</p>
                  </div>
                  <Button size="sm" variant="outline" className="w-full gap-1.5 mt-auto" onClick={() => exportPaper(p.subject, p.year, p.subjectId)}>
                    <Download className="h-3.5 w-3.5" /> Generate PDF
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Question banks + time management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <SectionHeader title="Question Banks" subtitle="Per-subject question counts" />
          <div className="cinema-glass rounded-2xl p-4 space-y-3">
            {CURRICULUM.map((s) => {
              const count = s.chapters.reduce((a, c) => a + (c.questions?.length ?? 0), 0);
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="text-lg">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{count} questions · {s.chapters.length} chapters</p>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionHeader title="Time Management" subtitle="Minutes per subject (sessions)" />
          <div className="cinema-glass rounded-2xl p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timePerSubject} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" stroke="currentColor" />
                  <YAxis tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" stroke="currentColor" />
                  <RTooltip
                    cursor={{ fill: "currentColor", fillOpacity: 0.08 }}
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v} min`, "Studied"]}
                  />
                  <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
                    {timePerSubject.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Total: {timePerSubject.reduce((a, b) => a + b.minutes, 0)} minutes across {sessions.length} focus sessions.
            </p>
          </div>
        </div>
      </div>
      </div>
      </div>
      </div>
  );
}
