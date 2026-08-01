"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Target, AlertTriangle, BookOpen, Camera, Sunrise, Hammer, LifeBuoy,
  Sparkles, Send, Loader2, Zap, Users, ArrowRight, Volume2, ChevronRight,
  FileDown, Lightbulb, Download, Wand2,
  Image as ImageIcon, FileText, Copy, ExternalLink, History, LayoutTemplate,
  ChevronDown, RefreshCw, Save, Eye, Settings2, Palette, Plus,
  Wand, Presentation,
} from "lucide-react";
import { toast } from "@/lib/notifications/notification-api";

import { askAI, askAIJSON, type ChatMessage } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { CURRICULUM } from "@/lib/curriculum";
import { useCurriculum } from "@/lib/use-curriculum";
import { Markdown, StatCard, SectionHeader, EmptyState } from "@/lib/shared";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SlideshowMaker } from "@/components/views/slideshow-maker";
import { profileGetJSON, profileSetJSON, profileGetItem, profileSetItem } from "@/lib/profile-storage";
import { setLamDraft } from "@/lib/lam-context";
import { navigateTo } from "@/lib/nav-event";
import {
  beginBackgroundTask,
  completeBackgroundTask,
  failBackgroundTask,
} from "@/lib/background-tasks";

// ===== Tool metadata =====
interface ToolMeta {
  id: string;
  name: string;
  blurb: string;
  icon: typeof Brain;
  accent: string;
  gradient: string;
  highlight?: boolean;
  badge?: string;
}

const TOOLS: ToolMeta[] = [
  { id: "ai-pdf-studio", name: "AI PDF Studio", blurb: "Turn a single prompt into a stunning, publication-ready PDF — Canva + Notion + AI for students.", icon: FileText, accent: "#f43f5e", gradient: "from-rose-500 to-orange-500", highlight: true, badge: "FLAGSHIP" },
  { id: "mistake-analyzer", name: "Mistake Analyzer", blurb: "Paste wrong answers — find the root cause.", icon: AlertTriangle, accent: "#f59e0b", gradient: "from-amber-500 to-orange-500" },
  { id: "memory-predictor", name: "Memory Predictor", blurb: "See what you're about to forget.", icon: Brain, accent: "#8b5cf6", gradient: "from-violet-500 to-fuchsia-500" },
  { id: "academic-coach", name: "Academic Coach", blurb: "Personalised improvement plan.", icon: Target, accent: "#6366f1", gradient: "from-indigo-500 to-blue-500" },
  { id: "one-night-exam", name: "One-Night Exam Mode", blurb: "Cram plan for tomorrow's exam.", icon: Sunrise, accent: "#ec4899", gradient: "from-pink-500 to-rose-500" },
  { id: "homework-scanner", name: "Homework Scanner", blurb: "Snap a question, get a hint + solution.", icon: Camera, accent: "#14b8a6", gradient: "from-teal-500 to-emerald-500" },
  { id: "daily-briefing", name: "Daily Briefing", blurb: "Your 4-part morning study brief.", icon: Sunrise, accent: "#f97316", gradient: "from-orange-500 to-amber-500" },
  { id: "chapter-builder", name: "Chapter Builder", blurb: "Generate a full study unit, export to PDF.", icon: Hammer, accent: "#10b981", gradient: "from-emerald-500 to-teal-500" },
  { id: "life-saver", name: "Life Saver Button", blurb: "Panicking? Tap once, get calm + a plan.", icon: LifeBuoy, accent: "#ef4444", gradient: "from-red-500 to-rose-500" },
  { id: "study-companion", name: "Study Companion", blurb: "Casual mini-chat with a friendly AI.", icon: Users, accent: "#06b6d4", gradient: "from-cyan-500 to-sky-500" },
  { id: "aisig", name: "AISIG", blurb: "AI Study Image Generator — turn ideas into educational images.", icon: ImageIcon, accent: "#7c3aed", gradient: "from-violet-500 to-purple-500" },
  { id: "slideshow-maker", name: "AI Slideshow Maker", blurb: "Turn topics, notes, or chapters into beautiful editable slide decks.", icon: Presentation, accent: "#06b6d4", gradient: "from-cyan-500 to-violet-500", highlight: true, badge: "NEW" },
];

// ===== Shared bits =====
function Loading({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label ?? "Thinking..."}
    </div>
  );
}

function ResponseCard({ content, accent }: { content: string; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border p-4 bg-muted/30"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <Markdown content={content} />
    </motion.div>
  );
}

function useUserStats() {
  const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak);
  const mastery = useStore((s) => s.mastery);
  const tasks = useStore((s) => s.tasks);
  const studyProgress = useStore((s) => s.studyProgress);
  const user = useStore((s) => s.user);
  const scholarClass = user.scholarClass;

  const masteryAvg = useMemo(() => {
    const vals = Object.values(mastery);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [mastery]);

  const weakest = useMemo(() => {
    const entries = Object.entries(mastery);
    if (!entries.length) return null;
    return entries.sort((a, b) => a[1] - b[1])[0];
  }, [mastery]);

  const dueTasks = useMemo(
    () => tasks.filter((t) => !t.done && new Date(t.date) <= new Date(Date.now() + 86400000)).length,
    [tasks]
  );

  const studiedChapters = useMemo(
    () => Object.entries(studyProgress).filter(([, p]) => p > 0).length,
    [studyProgress]
  );

  return { xp, streak, masteryAvg, weakest, dueTasks, studiedChapters, mastery, studyProgress, user, scholarClass };
}

// ===== Tool 1: Mistake Analyzer =====
function MistakeAnalyzer() {
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("general");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { scholarClass } = useUserStats();

  const run = async () => {
    if (!text.trim()) { toast.error("Paste your mistakes first"); return; }
    setLoading(true); setResult(null);
    try {
      const prompt = `Student is studying ${subject === "general" ? `Class ${scholarClass} CBSE` : subject}. They made the following mistakes / got these wrong:\n\n${text}\n\nAnalyse each mistake. Identify the root misconception (not just the error), then give a corrected approach and a similar practice question. Use markdown with headings.`;
      const r = await askAI(prompt, "mistake-analyzer");
      setResult(r);
    } catch (e: any) {
      toast.error("Analysis failed", { description: e?.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <Select value={subject} onValueChange={setSubject}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Subject" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="general">General / Mixed</SelectItem>
          {CURRICULUM.map((s) => <SelectItem key={s.id} value={s.name}>{s.icon} {s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Paste your wrong answers or describe what you got wrong. e.g. 'I wrote (a+b)² = a² + b²'..."
      />
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Analyze mistakes
      </Button>
      {loading && <Loading label="Diagnosing misconceptions..." />}
      {result && <ResponseCard content={result} accent="#f59e0b" />}
    </div>
  );
}

// ===== Tool 2: Memory Predictor =====
interface MemoryTopic { name: string; retention: number; risk: "high" | "medium" | "low"; reviseBy: string }
function MemoryPredictor() {
  const { studyProgress, scholarClass } = useUserStats();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MemoryTopic[] | null>(null);

  // Build a snapshot of studied chapters with mock last-studied dates within 14 days.
  const studied = useMemo(() => {
    const now = Date.now();
    return Object.entries(studyProgress)
      .filter(([, p]) => p > 0)
      .map(([chapterId, progress]) => {
        const ch = CURRICULUM.flatMap((s) => s.chapters).find((c) => c.id === chapterId);
        const subj = CURRICULUM.find((s) => s.chapters.some((c) => c.id === chapterId));
        const daysAgo = Math.floor(Math.random() * 14);
        return {
          name: ch ? `${subj?.name ?? ""}: ${ch.title}` : chapterId,
          progress,
          lastStudied: now - daysAgo * 86400000,
        };
      })
      .slice(0, 15);
  }, [studyProgress]);

  const run = async () => {
    if (studied.length === 0) { toast.error("Study some chapters first!"); return; }
    setLoading(true); setData(null);
    try {
      const context = studied.map((c) => `- ${c.name}: ${c.progress}% mastery, last studied ${Math.round((Date.now() - c.lastStudied) / 86400000)}d ago`).join("\n");
      const prompt = `Here is a list of chapters a Class ${scholarClass} CBSE student has studied, with mastery % and days since last review:\n${context}\n\nBased on the Ebbinghaus forgetting curve, predict current memory retention for each. Return JSON: { "topics": [{ "name": string, "retention": number (0-100), "risk": "high" | "medium" | "low", "reviseBy": string (e.g. "Today", "In 2 days", "This week") }] }`;
      const r = await askAIJSON<{ topics: MemoryTopic[] }>(prompt, "memory-predictor");
      if (!r?.topics?.length) { toast.error("Couldn't build memory model"); return; }
      setData(r.topics);
      toast.success(`Predicted memory for ${r.topics.length} topics`);
    } catch (e: any) {
      toast.error("Prediction failed", { description: e?.message });
    } finally { setLoading(false); }
  };

  const riskColor = (r: MemoryTopic["risk"]) => r === "high" ? "text-red-500 bg-red-500/10" : r === "medium" ? "text-amber-500 bg-amber-500/10" : "text-emerald-500 bg-emerald-500/10";

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-muted/40 p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Studied chapters ({studied.length})</p>
        <ScrollArea className="max-h-32">
          <div className="space-y-1">
            {studied.slice(0, 8).map((c) => (
              <div key={c.name} className="flex justify-between text-xs">
                <span className="truncate">{c.name}</span>
                <span className="text-muted-foreground shrink-0 ml-2">{c.progress}%</span>
              </div>
            ))}
            {studied.length > 8 && <p className="text-[11px] text-muted-foreground italic">+{studied.length - 8} more</p>}
          </div>
        </ScrollArea>
      </div>
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
        Predict memory decay
      </Button>
      {loading && <Loading label="Modelling forgetting curves..." />}
      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Topic</th>
                  <th className="text-right px-3 py-2 font-medium">Retention</th>
                  <th className="text-center px-3 py-2 font-medium">Risk</th>
                  <th className="text-right px-3 py-2 font-medium">Revise by</th>
                </tr>
              </thead>
              <tbody>
                {data.sort((a, b) => a.retention - b.retention).map((t, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 max-w-[160px] truncate">{t.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Math.round(t.retention)}%</td>
                    <td className="px-3 py-2 text-center">
                      <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase", riskColor(t.risk))}>{t.risk}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{t.reviseBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Recommended: revise all <span className="text-red-500">high-risk</span> topics today, schedule <span className="text-amber-500">medium-risk</span> tomorrow.
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ===== Tool 3: Academic Coach =====
function AcademicCoach() {
  const { streak, masteryAvg, weakest, user, scholarClass } = useUserStats();
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    if (!goal.trim()) { toast.error("Tell the coach what to improve"); return; }
    setLoading(true); setResult(null);
    try {
      const prompt = `Student: ${user.name}, Class ${scholarClass} CBSE. Current stats: ${streak}-day streak, ${masteryAvg}% avg mastery, weakest subject: ${weakest ? weakest[0] : "n/a"} (${weakest ? weakest[1] : 0}%). Goal: ${goal}\n\nAct as a strict but warm academic coach. Give a 2-week improvement plan with daily micro-actions, specific chapters to focus on, and a measurable success metric. Use markdown headings.`;
      const r = await askAI(prompt, "academic-coach");
      setResult(r);
    } catch (e: any) {
      toast.error("Coaching failed", { description: e?.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={Zap} label="Streak" value={`${streak}`} accent="#6366f1" />
        <StatCard icon={Target} label="Avg Mastery" value={`${masteryAvg}%`} accent="#14b8a6" />
        <StatCard icon={AlertTriangle} label="Weakest" value={weakest ? weakest[0] : "—"} sub={weakest ? `${weakest[1]}%` : ""} accent="#f59e0b" />
      </div>
      <Textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        rows={3}
        placeholder="What do you want to improve? e.g. 'I want to score 90+ in Maths this term'"
      />
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
        Get coaching
      </Button>
      {loading && <Loading label="Building your plan..." />}
      {result && <ResponseCard content={result} accent="#6366f1" />}
    </div>
  );
}

// ===== Tool 4: One-Night-Before-Exam =====
function OneNightExam() {
  const { scholarClass } = useUserStats();
  const [subjectId, setSubjectId] = useState(CURRICULUM[0].id);
  const [chapterId, setChapterId] = useState(CURRICULUM[0].chapters[0].id);
  const subject = CURRICULUM.find((s) => s.id === subjectId)!;
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    setChapterId(subject.chapters[0].id);
  }, [subjectId, subject]);

  const run = async () => {
    setLoading(true); setPlan(null);
    try {
      const ch = subject.chapters.find((c) => c.id === chapterId);
      const prompt = `It's the night before the Class ${scholarClass} CBSE exam on "${subject.name} — ${ch?.title ?? chapterId}". Build a focused cram timeline from 6 PM to 11 PM tonight with 30-45 min blocks. Include: must-revise concepts, 1 quick problem per block, a 5-min breather, and a final 15-min self-test. Be realistic, not exhaustive. Use markdown with a timeline format.`;
      const r = await askAI(prompt, "one-night-exam");
      setPlan(r);
    } catch (e: any) {
      toast.error("Couldn't build cram plan", { description: e?.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <Select value={subjectId} onValueChange={setSubjectId}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{CURRICULUM.map((s) => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={chapterId} onValueChange={setChapterId}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{subject.chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
      </Select>
      <Button onClick={run} disabled={loading} className="w-full" style={{ background: "linear-gradient(135deg, #ec4899, #f43f5e)" }}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sunrise className="h-4 w-4 mr-2" />}
        Build cram plan (6 PM → 11 PM)
      </Button>
      {loading && <Loading label="Designing tonight's timeline..." />}
      {plan && <ResponseCard content={plan} accent="#ec4899" />}
    </div>
  );
}

// ===== Tool 5: Homework Scanner =====
function HomeworkScanner() {
  const { scholarClass } = useUserStats();
  const addNote = useStore((state) => state.addNote);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [ocrStatus, setOcrStatus] = useState<"idle" | "preparing" | "reading" | "done" | "error">("idle");
  const [ocrError, setOcrError] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const ocrAbort = useRef<AbortController | null>(null);
  const [question, setQuestion] = useState("");
  const [subject, setSubject] = useState("general");
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [solution, setSolution] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => () => ocrAbort.current?.abort(), []);

  const extractText = async () => {
    if (!file || ocrStatus === "preparing" || ocrStatus === "reading") return;
    setOcrError("");
    setConfidence(null);
    setOcrStatus("preparing");
    const controller = new AbortController();
    ocrAbort.current = controller;
    try {
      const form = new FormData();
      form.append("file", file);
      setOcrStatus("reading");
      const response = await fetch("/api/ocr", { method: "POST", body: form, signal: controller.signal });
      const data = await response.json() as { text?: string; confidence?: number; error?: string };
      if (!response.ok || !data.text) throw new Error(data.error || "No readable text was found.");
      setQuestion(data.text);
      setConfidence(data.confidence ?? null);
      setOcrStatus("done");
      toast.success("Text extracted", { description: `${data.text.length.toLocaleString()} characters detected.` });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setOcrStatus("idle");
        return;
      }
      setOcrStatus("error");
      setOcrError(error instanceof Error ? error.message : "OCR failed.");
    } finally {
      ocrAbort.current = null;
    }
  };

  const run = async () => {
    if (!question.trim()) { toast.error("Type or paste the question"); return; }
    setLoading(true); setHint(null); setSolution(null);
    try {
      const ctx = file ? `(Extracted from uploaded image: ${file.name}) ` : "";
      const prompt = `${ctx}Subject: ${subject}. Solve this Class ${scholarClass} CBSE question — but FIRST give only a HINT (no full answer) under a heading "## Hint". Then give the full solution under "## Solution" with step-by-step working.\n\nQuestion: ${question}`;
      const r = await askAI(prompt, "homework-scanner");
      // Split out the hint section.
      const hintMatch = r.match(/##\s*Hint([\s\S]*?)(?=##\s*Solution|$)/i);
      const solMatch = r.match(/##\s*Solution([\s\S]*?)$/i);
      setHint(hintMatch ? hintMatch[1].trim() : "Read the question carefully and identify what's being asked.");
      setSolution(solMatch ? solMatch[1].trim() : r);
    } catch (e: any) {
      toast.error("Couldn't solve", { description: e?.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <div className="rounded-xl border-2 border-dashed border-border p-4 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-colors">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setQuestion("");
                setOcrStatus("idle");
                setOcrError("");
                setConfidence(null);
              }
            }}
          />
          {previewUrl ? <img src={previewUrl} alt="Selected homework preview" className="mx-auto mb-2 max-h-44 rounded-lg object-contain" /> : <Camera className="h-6 w-6 mx-auto text-muted-foreground mb-1" />}
          {file ? (
            <><p className="text-xs font-medium truncate">{file.name}</p><p className="text-[10px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p></>
          ) : (
            <p className="text-xs text-muted-foreground">Upload a clear PNG, JPEG, or WebP image (max 10 MB)</p>
          )}
        </div>
      </label>
      {file && (
        <div className="space-y-2">
          <Button type="button" variant="outline" onClick={extractText} disabled={ocrStatus === "preparing" || ocrStatus === "reading"} className="w-full">
            {ocrStatus === "preparing" || ocrStatus === "reading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            {ocrStatus === "preparing" ? "Preparing image…" : ocrStatus === "reading" ? "Reading text…" : ocrStatus === "done" ? "Run OCR again" : "Extract text with OCR"}
          </Button>
          {(ocrStatus === "preparing" || ocrStatus === "reading") && <button type="button" onClick={() => ocrAbort.current?.abort()} className="w-full text-xs text-muted-foreground hover:text-foreground">Cancel OCR</button>}
          {ocrError && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">{ocrError}</p>}
          {confidence !== null && <p className="text-xs text-muted-foreground">OCR confidence: <span className="font-semibold text-foreground">{confidence}%</span>. Review the editable text before using it.</p>}
        </div>
      )}
      <Select value={subject} onValueChange={setSubject}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="general">General</SelectItem>
          {CURRICULUM.map((s) => <SelectItem key={s.id} value={s.name}>{s.icon} {s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        placeholder="OCR text appears here. Review it, or type/paste the homework question…"
      />
      {question.trim() && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button type="button" size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(question); toast.success("Copied extracted text"); }}><Copy className="mr-1 h-3.5 w-3.5" /> Copy</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { addNote({ title: file ? `OCR · ${file.name}` : "OCR notes", content: question, folder: "OCR", color: "teal", tags: ["ocr"] }); toast.success("Added to Notes"); }}><Save className="mr-1 h-3.5 w-3.5" /> Notes</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { setLamDraft({ prompt: "Clean this OCR text into concise study notes, correcting only obvious recognition errors.", ocrText: question }); navigateTo("study"); }}><Sparkles className="mr-1 h-3.5 w-3.5" /> Ask LAM</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => { addNote({ title: "Canvas OCR draft", content: question, folder: "Canvas", color: "indigo", tags: ["ocr", "canvas"] }); navigateTo("canvas"); toast.success("Saved as a Canvas source note"); }}><Wand2 className="mr-1 h-3.5 w-3.5" /> Canvas</Button>
        </div>
      )}
      <Button onClick={run} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Solve
      </Button>
      {loading && <Loading label="Working it out..." />}
      {hint && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <button
            className="flex items-center gap-2 text-xs font-semibold text-amber-600 w-full"
            onClick={() => setShowHint((v) => !v)}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            {showHint ? "Hide hint" : "Show hint first"}
            <ChevronRight className={cn("h-3.5 w-3.5 ml-auto transition-transform", showHint && "rotate-90")} />
          </button>
          {showHint && <div className="mt-2 text-xs text-muted-foreground"><Markdown content={hint} /></div>}
        </div>
      )}
      {solution && <ResponseCard content={`## Solution\n${solution}`} accent="#14b8a6" />}
    </div>
  );
}

// ===== Tool 6: Daily Briefing =====
function DailyBriefing() {
  const { xp, streak, dueTasks, weakest, masteryAvg, user, scholarClass } = useUserStats();
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setBrief(null);
    try {
      const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
      const goalLine = scholarClass === 11
        ? "references their goal of cracking JEE and becoming an engineer"
        : "references their goal of becoming a doctor";
      const prompt = `Good morning! Today is ${today}. Student: ${user.name}, Class ${scholarClass} CBSE. Stats: ${xp} XP, ${streak}-day streak, ${dueTasks} due tasks, avg mastery ${masteryAvg}%, weakest subject ${weakest ? weakest[0] : "n/a"}.\n\nGive a 4-part daily briefing in markdown:\n1. **Today's focus** (one sentence)\n2. **Quick wins** (3 bullet points, each <20 words)\n3. **Watch out** (1 risk + how to avoid it)\n4. **Affirmation** (1 line, warm, ${goalLine})`;
      const r = await askAI(prompt, "daily-briefing");
      setBrief(r);
    } catch (e: any) {
      toast.error("Couldn't build briefing", { description: e?.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={Zap} label="Streak" value={`${streak} 🔥`} accent="#f97316" />
        <StatCard icon={Sparkles} label="XP" value={xp} accent="#6366f1" />
        <StatCard icon={AlertTriangle} label="Due tasks" value={dueTasks} accent="#f59e0b" />
        <StatCard icon={Target} label="Avg Mastery" value={`${masteryAvg}%`} accent="#14b8a6" />
      </div>
      <Button onClick={run} disabled={loading} className="w-full" style={{ background: "linear-gradient(135deg, #f97316, #f59e0b)" }}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sunrise className="h-4 w-4 mr-2" />}
        Get today's briefing
      </Button>
      {loading && <Loading label="Composing your morning brief..." />}
      {brief && <ResponseCard content={brief} accent="#f97316" />}
    </div>
  );
}

// ===== Tool 7: Chapter Builder =====
function ChapterBuilder() {
  const { scholarClass } = useUserStats();
  const [subjectId, setSubjectId] = useState(CURRICULUM[0].id);
  const subject = CURRICULUM.find((s) => s.id === subjectId)!;
  const [chapterId, setChapterId] = useState(subject.chapters[0].id);
  const [loading, setLoading] = useState(false);
  const [unit, setUnit] = useState<string | null>(null);

  useEffect(() => { setChapterId(subject.chapters[0].id); }, [subjectId, subject]);

  const run = async () => {
    setLoading(true); setUnit(null);
    try {
      const ch = subject.chapters.find((c) => c.id === chapterId);
      const prompt = `Build a complete study unit for Class ${scholarClass} CBSE "${subject.name} — ${ch?.title}". Include: learning outcomes, simplified explanation (300 words), 5 key concepts with one-line explanations, 3 worked examples, 5 practice questions (with answers at the end), common mistakes to avoid, and a 1-line memory hook. Use clean markdown.`;
      const r = await askAI(prompt, "chapter-builder");
      setUnit(r);
    } catch (e: any) {
      toast.error("Couldn't build unit", { description: e?.message });
    } finally { setLoading(false); }
  };

  const exportIt = () => {
    if (!unit) return;
    exportPDF({
      title: `${subject.name}: ${subject.chapters.find((c) => c.id === chapterId)?.title ?? "Study Unit"}`,
      subtitle: "AI-generated study unit",
      bodyHtml: mdToHtml(unit),
      accent: subject.accent,
      scholarClass,
    });
    toast.success("Opening PDF preview...");
  };

  return (
    <div className="space-y-3">
      <Select value={subjectId} onValueChange={setSubjectId}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{CURRICULUM.map((s) => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={chapterId} onValueChange={setChapterId}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{subject.chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
      </Select>
      <Button onClick={run} disabled={loading} className="w-full" style={{ background: "linear-gradient(135deg, #10b981, #14b8a6)" }}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Hammer className="h-4 w-4 mr-2" />}
        Build study unit
      </Button>
      {loading && <Loading label="Building your study unit..." />}
      {unit && (
        <div className="space-y-2">
          <ResponseCard content={unit} accent={subject.accent} />
          <Button variant="outline" onClick={exportIt} className="w-full">
            <FileDown className="h-4 w-4 mr-2" /> Export to PDF
          </Button>
        </div>
      )}
    </div>
  );
}

// ===== Tool 8: Life Saver =====
function LifeSaver() {
  const { scholarClass } = useUserStats();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    const what = window.prompt("What's wrong? (one sentence — e.g. 'I have a maths exam tomorrow and I haven't started')");
    if (!what) return;
    setLoading(true); setResult(null);
    try {
      const prompt = `A Class ${scholarClass} CBSE student is panicking: "${what}". Respond in 3 short sections:\n1. **Breathe** — a 1-line calm acknowledgement (not preachy)\n2. **Do this now** — the single most important immediate next action\n3. **3-step plan** — three concrete, doable steps in order. Use markdown. Keep it under 150 words total.`;
      const r = await askAI(prompt, "life-saver");
      setResult(r);
    } catch (e: any) {
      toast.error("SOS failed", { description: e?.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3 text-center">
      <motion.div
        animate={{ scale: [1, 1.04, 1], boxShadow: ["0 0 0 0 #ef444488", "0 0 0 16px #ef444400", "0 0 0 0 #ef444400"] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        className="inline-block rounded-full"
      >
        <Button
          size="lg"
          onClick={run}
          disabled={loading}
          className="h-28 w-28 rounded-full text-base font-bold flex flex-col gap-1"
          style={{ background: "linear-gradient(135deg, #ef4444, #f43f5e)" }}
        >
          <LifeBuoy className="h-7 w-7" />
          SOS
        </Button>
      </motion.div>
      <p className="text-xs text-muted-foreground">Panicking? Tap once. The AI will calm you + give a 3-step plan.</p>
      {loading && <Loading label="Calming things down..." />}
      {result && <ResponseCard content={result} accent="#ef4444" />}
    </div>
  );
}

// ===== Tool 9: Study Companion (mini chat) =====
function StudyCompanion() {
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Hey! I'm your study companion. Talk to me about anything — stress, focus, what to study next. I'll keep it short." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs.length, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setLoading(true);
    try {
      const history: ChatMessage[] = next.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const r = await askAI(text, "study-companion", { history });
      setMsgs((m) => [...m, { role: "assistant", content: r }]);
    } catch (e: any) {
      toast.error("Companion is quiet", { description: e?.message });
    } finally { setLoading(false); }
  };

  const speak = (t: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) { toast.error("Speech not supported"); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t.replace(/[*#`_]/g, ""));
    u.lang = "en-IN"; u.rate = 0.98;
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="flex flex-col h-[480px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scroll">
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] group", isUser && "flex flex-col items-end")}>
                  <div className={cn("rounded-2xl px-3.5 py-2 text-sm", isUser ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted/70 rounded-bl-md")}>
                    {isUser ? <p className="whitespace-pre-wrap">{m.content}</p> : <Markdown content={m.content} />}
                  </div>
                  {!isUser && (
                    <button onClick={() => speak(m.content)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Volume2 className="h-3 w-3" /> read aloud
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
          {loading && (
            <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex">
              <div className="bg-muted/70 rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-cyan-500"
                    animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="Say anything..."
          className="resize-none min-h-[40px] max-h-24"
        />
        <Button size="icon" onClick={send} disabled={loading || !input.trim()} className="h-10 w-10 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ===== Tool: AISIG (AI Study Image Generator) =====
interface AISigEntry { prompt: string; enhanced: string; image: string; at: number }
function AISIG() {
  const [input, setInput] = useState("");
  const [imageSubject, setImageSubject] = useState("");
  const [imageChapter, setImageChapter] = useState("");
  const [imageStyle, setImageStyle] = useState("textbook diagram");
  const [imageAspectRatio, setImageAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "9:16" | "16:9">("1:1");
  const [enhanced, setEnhanced] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [history, setHistory] = useState<AISigEntry[]>([]);
  const imageAbortRef = useRef<AbortController | null>(null);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);
  const scholarClass = useStore((s) => s.user.scholarClass);
  const imageCurriculum = useCurriculum();
  const selectedImageSubject = imageCurriculum.find((subject) => subject.id === imageSubject);

  useEffect(() => {
    const saved = profileGetJSON<AISigEntry[]>(scholarClass, "aisig-history", []);
    if (Array.isArray(saved)) setHistory(saved);
  }, [scholarClass]);

  const run = async () => {
    if (!input.trim()) { toast.error("Type an idea first"); return; }
    setLoading(true); setEnhanced(null); setImage(null); setImageError(null);
    try {
      const context = [
        selectedImageSubject ? `Subject: ${selectedImageSubject.name}.` : "",
        imageChapter ? `Chapter: ${imageChapter}.` : "",
        imageStyle ? `Style: ${imageStyle}.` : "",
      ].filter(Boolean).join(" ");
      const prompt = `You are an educational image-prompt engineer for CBSE students. Rewrite this idea as a vivid, detailed image-generation prompt that produces a CLEAR, EDUCATIONAL, SCHOOL-APPROPRIATE illustration suitable for a textbook or study notes.\n\nIdea: "${input}"\n${context}\n\nReturn ONLY the enhanced image prompt (1-3 sentences). Mention style, composition, colors, and any labels or annotations that would help a student understand the concept. No preamble, no quotes.`;
      const r = await askAI(prompt, "default");
      const text = r.trim().replace(/^["']|["']$/g, "");
      setEnhanced(text);
      addXP(2);
      toast.success("Prompt enhanced! Now generate the image.");
    } catch (e: any) {
      toast.error("Enhancement failed", { description: e?.message });
    } finally { setLoading(false); }
  };

  const generateImage = async () => {
    if (!enhanced) { toast.error("Enhance a prompt first"); return; }
    setGenerating(true); setImage(null); setImageError(null);
    toast.info("Generating image…", { description: "This takes 20-30 seconds. Please wait." });
    const controller = new AbortController();
    imageAbortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch("/api/ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: enhanced,
          subject: selectedImageSubject?.name || undefined,
          chapter: imageChapter || undefined,
          style: imageStyle || undefined,
          aspectRatio: imageAspectRatio,
        }),
        signal: controller.signal,
      });
      const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("application/json") && !contentType.includes("+json")) {
        throw new Error("The image service returned an unsupported response format.");
      }
      const raw = await res.text();
      let data: {
        ok?: boolean;
        image?: { mimeType?: unknown; data?: unknown };
        error?: { message?: unknown } | string;
      };
      try { data = JSON.parse(raw); } catch { throw new Error("The image service returned malformed data."); }
      if (!res.ok || data.ok !== true) {
        const message = typeof data.error === "string"
          ? data.error
          : typeof data.error?.message === "string" ? data.error.message : `Image generation failed (HTTP ${res.status}).`;
        throw new Error(message);
      }
      if (typeof data.image?.data !== "string" || typeof data.image?.mimeType !== "string") {
        throw new Error("The image service returned no usable image.");
      }
      if (!["image/png", "image/jpeg", "image/webp"].includes(data.image.mimeType.toLowerCase())) {
        throw new Error("The image service returned an unsupported image format.");
      }
      const imageUrl = `data:${data.image.mimeType};base64,${data.image.data}`;
      setImage(imageUrl);
      const entry: AISigEntry = { prompt: input.trim(), enhanced, image: imageUrl, at: Date.now() };
      const next = [entry, ...history].slice(0, 3);
      setHistory(next);
      profileSetJSON(scholarClass, "aisig-history", next);
      addXP(5); addCoins(3);
      pushActivity({ type: "aisig", text: `Generated image: ${input.substring(0, 30)}`, icon: "🎨" });
      toast.success("Image generated! · +5 XP, +3 coins");
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        const message = "Image generation was cancelled or timed out. You can retry safely.";
        setImageError(message);
        toast.error("Image generation stopped", { description: message });
      } else {
        const message = error instanceof Error ? error.message : "The image service is unavailable. Please try again.";
        setImageError(message);
        toast.error("Image generation failed", { description: message });
      }
    } finally {
      clearTimeout(timeoutId);
      if (imageAbortRef.current === controller) imageAbortRef.current = null;
      setGenerating(false);
    }
  };

  const cancelImage = () => imageAbortRef.current?.abort();

  const copy = () => {
    if (!enhanced) return;
    navigator.clipboard?.writeText(enhanced);
    toast.success("Prompt copied to clipboard");
  };

  const download = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image;
    a.download = `aisig-${Date.now()}.png`;
    a.click();
    toast.success("Image downloaded");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-3 bg-violet-500/10 border border-violet-500/30">
        <p className="text-xs text-violet-200 flex items-center gap-2">
          <ImageIcon className="h-3.5 w-3.5" />
          Type any concept — AISIG generates educational images right inside Scholar. No external tools needed.
        </p>
      </div>
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={3}
        placeholder="e.g. 'water cycle', 'human heart cross-section', 'Newton's third law example', 'structure of atom'..."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Select value={imageSubject} onValueChange={(value) => { setImageSubject(value); setImageChapter(""); }}>
          <SelectTrigger><SelectValue placeholder="Subject (optional)" /></SelectTrigger>
          <SelectContent>
            {imageCurriculum.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={imageChapter} onValueChange={setImageChapter} disabled={!selectedImageSubject}>
          <SelectTrigger><SelectValue placeholder="Chapter (optional)" /></SelectTrigger>
          <SelectContent>
            {(selectedImageSubject?.chapters ?? []).map((chapter) => <SelectItem key={chapter.id} value={chapter.title}>{chapter.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={imageStyle} onValueChange={setImageStyle}>
          <SelectTrigger><SelectValue placeholder="Style (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="textbook diagram">Textbook diagram</SelectItem>
            <SelectItem value="educational infographic">Educational infographic</SelectItem>
            <SelectItem value="realistic scientific illustration">Scientific illustration</SelectItem>
          </SelectContent>
        </Select>
        <Select value={imageAspectRatio} onValueChange={(value) => setImageAspectRatio(value as typeof imageAspectRatio)}>
          <SelectTrigger><SelectValue placeholder="Aspect ratio" /></SelectTrigger>
          <SelectContent>
            {(["1:1", "4:3", "3:4", "16:9", "9:16"] as const).map((ratio) => <SelectItem key={ratio} value={ratio}>{ratio}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={run}
        disabled={loading}
        className="w-full"
        style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
        Enhance prompt
      </Button>
      {loading && <Loading label="Enhancing your prompt..." />}

      {enhanced && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <div
            className="rounded-xl border p-4 bg-muted/30"
            style={{ borderLeft: "3px solid #7c3aed" }}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Wand2 className="h-3 w-3" /> Enhanced prompt
            </p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{enhanced}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy} className="flex-1">
              <Copy className="h-4 w-4 mr-2" /> Copy
            </Button>
            <Button
              onClick={generateImage}
              disabled={generating}
              className="flex-1"
              style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />}
              {generating ? "Generating..." : "Generate Image"}
            </Button>
          </div>
          {generating && (
            <Button variant="ghost" onClick={cancelImage} className="w-full text-muted-foreground">
              Cancel generation
            </Button>
          )}
        </motion.div>
      )}

      {generating && <Loading label="Creating your educational image..." />}

      {imageError && !generating && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 space-y-2">
          <p className="text-sm text-rose-700 dark:text-rose-200">{imageError}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={generateImage}>Retry</Button>
            <Button size="sm" variant="ghost" onClick={() => setImageError(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      {image && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
          <div className="rounded-xl overflow-hidden border-2 border-violet-500/30">
            <img src={image} alt={input} className="w-full" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={download} className="flex-1">
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
            <Button variant="outline" onClick={generateImage} className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
            </Button>
          </div>
        </motion.div>
      )}

      {history.length > 0 && (
        <details className="rounded-xl border border-border p-3 group">
          <summary className="text-xs font-medium cursor-pointer flex items-center gap-2">
            <History className="h-3.5 w-3.5" /> History ({history.length})
            <ChevronRight className="h-3 w-3 ml-auto group-open:rotate-90 transition-transform" />
          </summary>
          <div className="mt-2 space-y-2 max-h-60 overflow-y-auto custom-scroll pr-1">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => { setInput(h.prompt); setEnhanced(h.enhanced); setImage(h.image || null); setImageError(null); }}
                className="block w-full text-left text-xs p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium truncate">{h.prompt}</p>
                <p className="text-muted-foreground line-clamp-2 mt-0.5">{h.enhanced}</p>
              </button>
            ))}
          </div>
        </details>
      )}
      <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.07] p-3 text-[11px] leading-5 text-amber-100/70">
        <p className="font-semibold text-amber-100/90">AISIG quality notice</p>
        <p className="mt-1">AISIG is not yet operating at its full potential. Scholar currently uses low- or no-cost image models, so results may be inconsistent or disappointing. Our team is aware and will introduce newer, stronger models as sustainable provider access and funding become available.</p>
      </div>
    </div>
  );
}

// ===== Tool: AI PDF Studio (FLAGSHIP) =====
interface PDFStudioEntry { id: string; prompt: string; doc: string; at: number }

const PDF_EXAMPLES_CLASS9 = [
  "Photosynthesis explained simply with diagrams",
  "The French Revolution — causes and impact",
  "Polynomials: types and factor theorem",
  "Structure of the atom",
  "Drainage system of India",
  "Probability basics with examples",
  "Tissues in plants and animals",
  "Linear equations in two variables",
  "Climate of India — factors and regions",
  "Sound — propagation and characteristics",
];

const PDF_EXAMPLES_CLASS11 = [
  "Newton's Laws of Motion with numericals",
  "Bohr's atomic model — postulates and derivation",
  "Trigonometric identities and proofs",
  "Hybridization and VSEPR theory",
  "Python lists vs tuples with examples",
  "Complex numbers — polar form and modulus",
  "Chemical bonding — ionic vs covalent",
  "Limits and derivatives — first principle",
  "The Portrait of a Lady — themes and analysis",
  "Thermodynamics — first and second laws",
];

const PDF_TEMPLATES = [
  { name: "Chapter Notes", desc: "Comprehensive study notes for a chapter", icon: "📝" },
  { name: "Revision Sheet", desc: "Quick revision one-pager", icon: "⚡" },
  { name: "Formula Booklet", desc: "All formulas with examples", icon: "🧮" },
  { name: "Quiz Set", desc: "MCQ practice with answers", icon: "❓" },
  { name: "Mind Map", desc: "Visual concept connections", icon: "🧠" },
  { name: "Flashcards", desc: "Q&A card format", icon: "🎴" },
  { name: "Lab Report", desc: "Experiment writeup template", icon: "🔬" },
  { name: "Essay Outline", desc: "Structured essay framework", icon: "✍️" },
  { name: "Project Report", desc: "Academic project documentation", icon: "📊" },
  { name: "Glossary", desc: "Term definitions", icon: "📚" },
  { name: "Timeline", desc: "Historical sequence of events", icon: "⏳" },
  { name: "Case Study", desc: "Detailed analysis", icon: "📖" },
  { name: "Comparison Table", desc: "Side-by-side comparison", icon: "⚖️" },
  { name: "Step-by-Step Guide", desc: "Procedure walkthrough", icon: "📋" },
  { name: "Summary Brief", desc: "Executive 1-page summary", icon: "📄" },
  { name: "Practice Problems", desc: "Worked problems with solutions", icon: "🔢" },
  { name: "Concept Map", desc: "Hierarchical concept breakdown", icon: "🗺️" },
  { name: "Question Bank", desc: "Topic-wise question collection", icon: "🏦" },
  { name: "Solved Examples", desc: "Worked examples with steps", icon: "✅" },
  { name: "Quick Reference", desc: "Cheat-sheet style", icon: "📌" },
];

const PDF_ENHANCEMENTS = [
  { label: "+ Examples", icon: Plus, add: "Add 2 more solved examples to this document." },
  { label: "+ Diagrams", icon: Plus, add: "Suggest 3 diagrams/illustrations with detailed descriptions for this document." },
  { label: "+ Quiz", icon: Plus, add: "Add a 5-question MCQ quiz at the end with answers." },
  { label: "+ Summary", icon: Plus, add: "Add an executive summary section at the top." },
  { label: "+ Glossary", icon: Plus, add: "Add a glossary of key terms at the end." },
  { label: "+ Formulas", icon: Plus, add: "Add a formula sheet section near the end." },
  { label: "+ Memory Hooks", icon: Plus, add: "Add memory hooks or mnemonics for each major concept." },
  { label: "Shorten", icon: RefreshCw, add: "Shorten this document by 40% while keeping key information." },
  { label: "Expand", icon: Plus, add: "Expand this document with more depth, examples, and detail." },
  { label: "Simplify", icon: RefreshCw, add: "Simplify the language for easier understanding." },
  { label: "Formalize", icon: RefreshCw, add: "Make the tone more formal and academic." },
];

const PDF_STAGES = ["Designing layout", "Generating content", "Formatting sections", "Polishing & exporting"];

function AIPDFStudio() {
  const { scholarClass } = useUserStats();
  const [prompt, setPrompt] = useState("");
  const [doc, setDoc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [stage, setStage] = useState(0);
  const [history, setHistory] = useState<PDFStudioEntry[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // 7 config selects
  const [style, setStyle] = useState("textbook");
  const [length, setLength] = useState("medium");
  const [audience, setAudience] = useState(scholarClass === 11 ? "class11" : "class9");
  const [tone, setTone] = useState("academic");
  const [sections, setSections] = useState("standard");
  const [language, setLanguage] = useState("english");
  const [format, setFormat] = useState("markdown");
  const [aiVisuals, setAiVisuals] = useState(true);

  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const addFile = useStore((s) => s.addFile);
  const pushActivity = useStore((s) => s.pushActivity);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pdf-studio-history") || "[]");
      if (Array.isArray(saved)) {
        setHistory(saved);
        const latest = saved[0] as PDFStudioEntry | undefined;
        if (latest?.doc) {
          setDoc(latest.doc);
          setPrompt(latest.prompt || "");
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Stage cycling animation while loading
  useEffect(() => {
    if (!loading) { setStage(0); return; }
    setStage(0);
    const t = setInterval(() => setStage((s) => (s + 1) % PDF_STAGES.length), 1400);
    return () => clearInterval(t);
  }, [loading]);

  const buildPrompt = (rawPrompt: string) => {
    const lengthMap: Record<string, string> = {
      short: "concise (250-400 words)",
      medium: "medium length (500-800 words)",
      long: "detailed (1000-1500 words)",
    };
    const toneMap: Record<string, string> = {
      academic: "academic and clear",
      friendly: "friendly and conversational",
      formal: "formal and precise",
      exam: "exam-focused and direct",
    };
    const sectionsMap: Record<string, string> = {
      standard: "introduction, key concepts, examples, summary",
      minimal: "just the core content, no extras",
      extended: "intro, objectives, concepts, examples, practice, summary, references",
      revision: "bullet-point revision format, no fluff",
    };
    return `Build a study PDF for Class ${scholarClass} CBSE on: "${rawPrompt}".
Style: ${style}. Length: ${lengthMap[length]}. Tone: ${toneMap[tone]}. Audience: ${audience === "class9" ? "Class 9 CBSE student" : audience === "class11" ? "Class 11 CBSE student" : audience}.
Sections to include: ${sectionsMap[sections]}. Language: ${language}.
${aiVisuals ? "Include [DIAGRAM: ...] placeholders describing suggested diagrams where useful." : "Do not include diagram placeholders."}
Format as clean markdown. Use ## for section headings, **bold** for key terms, bullet lists where helpful, and > for callouts.
Write every mathematical expression as valid LaTeX: use $...$ for inline maths and $$...$$ for display equations. Use \\frac{a}{b}, superscripts, subscripts, Greek symbols, vectors, units, and aligned steps correctly. Never leave raw TeX commands outside math delimiters.
Keep tables and equations within a printable A4 content width. Be accurate to NCERT. No preamble.`;
  };

  const run = async (overridePrompt?: string) => {
    const p = (overridePrompt ?? prompt).trim();
    if (!p) { toast.error("Write a prompt first"); return; }
    const backgroundTaskId = beginBackgroundTask({
      kind: "ai-pdf",
      title: "Creating your study PDF",
      message: "Generating and formatting the document…",
      viewId: "ai-tools",
      toolId: "ai-pdf-studio",
    });
    setLoading(true); setDoc(null);
    try {
      const r = await askAI(buildPrompt(p), "chapter-builder");
      setDoc(r);
      const entry: PDFStudioEntry = {
        id: `${Date.now()}`,
        prompt: p,
        doc: r,
        at: Date.now(),
      };
      const next = [entry, ...history].slice(0, 10);
      setHistory(next);
      try { localStorage.setItem("pdf-studio-history", JSON.stringify(next)); } catch { /* ignore */ }
      addXP(5); addCoins(3);
      pushActivity({ type: "ai", text: `Generated PDF: ${p.slice(0, 40)}`, icon: "📄" });
      toast.success("PDF generated · +5 XP, +3 coins");
      completeBackgroundTask(
        backgroundTaskId,
        "Your formatted PDF is ready in AI Tools.",
      );
    } catch (e: any) {
      failBackgroundTask(backgroundTaskId, "PDF generation failed.");
      toast.error("Generation failed", { description: e?.message });
    } finally { setLoading(false); }
  };

  const applyEnhancement = async (add: string) => {
    if (!doc) return;
    setEnhancing(true);
    try {
      const r = await askAI(`${add}\n\nReturn the full updated document in markdown.\n\n---\n\n${doc}`, "chapter-builder");
      setDoc(r);
      const entry: PDFStudioEntry = { id: `${Date.now()}`, prompt: `${add}`, doc: r, at: Date.now() };
      const next = [entry, ...history].slice(0, 10);
      setHistory(next);
      try { localStorage.setItem("pdf-studio-history", JSON.stringify(next)); } catch { /* ignore */ }
      addXP(2); addCoins(1);
      toast.success("Document updated · +2 XP, +1 coin");
    } catch (e: any) {
      toast.error("Enhancement failed", { description: e?.message });
    } finally { setEnhancing(false); }
  };

  const exportPDFDoc = () => {
    if (!doc) return;
    exportPDF({
      title: prompt || "AI-Generated Document",
      subtitle: "AI PDF Studio",
      bodyHtml: mdToHtml(doc),
      accent: "#f43f5e",
      scholarClass,
    });
    toast.success("Opening PDF preview — use Save as PDF");
  };

  const copyMD = () => {
    if (!doc) return;
    navigator.clipboard?.writeText(doc);
    toast.success("Markdown copied");
  };

  const toFiles = () => {
    if (!doc) return;
    const blob = new Blob([doc], { type: "text/markdown" });
    const reader = new FileReader();
    reader.onload = () => {
      addFile({
        name: `${(prompt || "ai-document").slice(0, 40)}.md`,
        type: "markdown",
        size: blob.size,
        dataUrl: reader.result as string,
        tags: ["ai-pdf-studio", "markdown"],
      });
      toast.success("Saved to Files");
    };
    reader.readAsDataURL(blob);
  };

  const loadHistory = (e: PDFStudioEntry) => {
    setPrompt(e.prompt);
    setDoc(e.doc);
    toast.success("Loaded from history");
  };

  return (
    <div className="space-y-4">
      {/* Prompt + Examples */}
      <div className="space-y-2">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          placeholder={`Describe the PDF you want to create. e.g. 'A complete revision guide for Class ${scholarClass} Motion chapter with formulas, examples, and a 5-question quiz.'`}
        />
        <div className="flex flex-wrap gap-1.5">
          {(scholarClass === 11 ? PDF_EXAMPLES_CLASS11 : PDF_EXAMPLES_CLASS9).map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="px-2.5 py-1 rounded-full text-[11px] bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 transition-colors border border-rose-500/20"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Collapsible Config */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setShowConfig((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
        >
          <Settings2 className="h-4 w-4" /> Configuration (7 options + AI Visuals)
          <ChevronDown className={cn("h-4 w-4 ml-auto transition-transform", showConfig && "rotate-180")} />
        </button>
        {showConfig && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <ConfigSelect label="Style" value={style} onChange={setStyle} options={[["textbook", "Textbook"], ["notes", "Personal Notes"], ["report", "Report"], ["cheatsheet", "Cheat Sheet"]]} />
            <ConfigSelect label="Length" value={length} onChange={setLength} options={[["short", "Short"], ["medium", "Medium"], ["long", "Long"]]} />
            <ConfigSelect label="Audience" value={audience} onChange={setAudience} options={[["class9", "Class 9 CBSE"], ["class11", "Class 11 CBSE"], ["class10", "Class 10 CBSE"], ["teacher", "Teacher"], ["parent", "Parent"]]} />
            <ConfigSelect label="Tone" value={tone} onChange={setTone} options={[["academic", "Academic"], ["friendly", "Friendly"], ["formal", "Formal"], ["exam", "Exam-focused"]]} />
            <ConfigSelect label="Sections" value={sections} onChange={setSections} options={[["standard", "Standard"], ["minimal", "Minimal"], ["extended", "Extended"], ["revision", "Revision"]]} />
            <ConfigSelect label="Language" value={language} onChange={setLanguage} options={[["english", "English"], ["hindi", "Hindi"], ["hinglish", "Hinglish"]]} />
            <ConfigSelect label="Format" value={format} onChange={setFormat} options={[["markdown", "Markdown"], ["plain", "Plain text"]]} />
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">AI Visuals</span>
              </div>
              <Switch checked={aiVisuals} onCheckedChange={setAiVisuals} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Generate */}
      <Button
        onClick={() => run()}
        disabled={loading || enhancing || !prompt.trim()}
        className="w-full"
        style={{ background: "linear-gradient(135deg, #f43f5e, #fb923c)" }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
        Generate PDF
      </Button>

      {/* Stage progress */}
      {(loading || enhancing) && (
        <div className="rounded-xl border border-border p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {enhancing ? "Enhancing document..." : PDF_STAGES[stage]}
            </span>
            <span className="text-[10px] text-muted-foreground">{stage + 1}/4</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {PDF_STAGES.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  (loading || enhancing) && i <= stage ? "bg-rose-500" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Live Preview */}
      {doc && !loading && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Eye className="h-4 w-4" /> Live Preview
          </div>
          <div className="rounded-xl bg-white shadow-inner overflow-hidden max-h-[480px] overflow-y-auto custom-scroll border border-border">
            <div className="p-6 md:p-8 text-neutral-900" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              <Markdown content={doc} />
            </div>
          </div>

          {/* Enhancement buttons */}
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
              <Wand className="h-3.5 w-3.5" /> Enhancements ({PDF_ENHANCEMENTS.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PDF_ENHANCEMENTS.map((en) => (
                <button
                  key={en.label}
                  onClick={() => applyEnhancement(en.add)}
                  disabled={enhancing}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-muted/40 hover:bg-muted/70 transition-colors border border-border disabled:opacity-50 flex items-center gap-1"
                >
                  <en.icon className="h-3 w-3" /> {en.label}
                </button>
              ))}
            </div>
          </div>

          {/* Export controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button onClick={exportPDFDoc} className="bg-rose-500 hover:bg-rose-600">
              <FileDown className="h-4 w-4 mr-1.5" /> Export PDF
            </Button>
            <Button variant="outline" onClick={copyMD}>
              <Copy className="h-4 w-4 mr-1.5" /> Copy MD
            </Button>
            <Button variant="outline" onClick={toFiles}>
              <Save className="h-4 w-4 mr-1.5" /> To Files
            </Button>
            <Button variant="outline" onClick={() => { setDoc(null); setPrompt(""); }}>
              <RefreshCw className="h-4 w-4 mr-1.5" /> Clear
            </Button>
          </div>
        </motion.div>
      )}

      {/* Templates Gallery */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setShowTemplates((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
        >
          <LayoutTemplate className="h-4 w-4" /> Templates Gallery ({PDF_TEMPLATES.length})
          <ChevronDown className={cn("h-4 w-4 ml-auto transition-transform", showTemplates && "rotate-180")} />
        </button>
        {showTemplates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto custom-scroll"
          >
            {PDF_TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => { setPrompt(`Create a ${t.name.toLowerCase()} for: ${t.desc.toLowerCase()}.`); setShowTemplates(false); }}
                className="text-left p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors border border-border"
              >
                <div className="text-xl mb-1">{t.icon}</div>
                <p className="text-xs font-medium">{t.name}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{t.desc}</p>
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <details className="rounded-xl border border-border p-3 group" open>
          <summary className="text-xs font-medium cursor-pointer flex items-center gap-2">
            <History className="h-3.5 w-3.5" /> Version History ({history.length})
            <ChevronRight className="h-3 w-3 ml-auto group-open:rotate-90 transition-transform" />
          </summary>
          <div className="mt-2 space-y-2 max-h-60 overflow-y-auto custom-scroll pr-1">
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => loadHistory(h)}
                className="block w-full text-left text-xs p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium truncate">{h.prompt}</p>
                <p className="text-muted-foreground text-[10px] mt-0.5">{new Date(h.at).toLocaleString()} · {h.doc.length} chars</p>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ConfigSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// ===== Tool content router =====
function ToolContent({ id }: { id: string }) {
  switch (id) {
    case "ai-pdf-studio": return <AIPDFStudio />;
    case "mistake-analyzer": return <MistakeAnalyzer />;
    case "memory-predictor": return <MemoryPredictor />;
    case "academic-coach": return <AcademicCoach />;
    case "one-night-exam": return <OneNightExam />;
    case "homework-scanner": return <HomeworkScanner />;
    case "daily-briefing": return <DailyBriefing />;
    case "chapter-builder": return <ChapterBuilder />;
    case "life-saver": return <LifeSaver />;
    case "study-companion": return <StudyCompanion />;
    case "aisig": return <AISIG />;
    case "slideshow-maker": return <SlideshowMaker />;
    default: return null;
  }
}

// ===== Main view — Bloom liquid glass aesthetic =====
export function AIToolsView() {
  const CURRICULUM = useCurriculum();
  const scholarClass = useStore((state) => state.user.scholarClass);
  const [openId, setOpenId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const pending = sessionStorage.getItem("scholar-ai-tools-open");
      sessionStorage.removeItem("scholar-ai-tools-open");
      return pending;
    } catch {
      return null;
    }
  });
  const activeTool = openId ? TOOLS.find((t) => t.id === openId) : null;

  const BLOOM_CSS = `
    .bloom-glass {
      background: rgba(255,255,255,0.01);
      background-blend-mode: luminosity;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      border: none;
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
      position: relative;
      overflow: hidden;
    }
    .bloom-glass::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1.4px;
      background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    .bloom-glass-strong {
      background: rgba(255,255,255,0.01);
      backdrop-filter: blur(50px);
      -webkit-backdrop-filter: blur(50px);
      border: none;
      box-shadow: 4px 4px 4px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.15);
      position: relative;
      overflow: hidden;
    }
    .bloom-glass-strong::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1.4px;
      background: linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.2) 80%, rgba(255,255,255,0.5) 100%);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    @keyframes bloom-fade-rise {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .bloom-fade-1 { animation: bloom-fade-rise 0.8s ease-out both; }
    .bloom-fade-2 { animation: bloom-fade-rise 0.8s ease-out 0.15s both; }
    .bloom-fade-3 { animation: bloom-fade-rise 0.8s ease-out 0.3s both; }
    .bloom-fade-4 { animation: bloom-fade-rise 0.8s ease-out 0.45s both; }
    .bloom-serif { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; }
    .bloom-display { font-family: 'Inter', system-ui, sans-serif; font-weight: 500; }
    .tool-content { color: white; }
    .tool-content .text-muted-foreground { color: rgba(255,255,255,0.6) !important; }
    .tool-content .bg-muted\\/30, .tool-content .bg-muted\\/40, .tool-content .bg-muted\\/50 { background: rgba(255,255,255,0.05) !important; }
    .tool-content .bg-muted { background: rgba(255,255,255,0.08) !important; }
    .tool-content .border-border { border-color: rgba(255,255,255,0.15) !important; }
    .tool-content input, .tool-content textarea, .tool-content select {
      background: rgba(255,255,255,0.05) !important;
      border-color: rgba(255,255,255,0.15) !important;
      color: white !important;
    }
    .tool-content input::placeholder, .tool-content textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
    .tool-content button { color: white; }
  `;

  // ===== Tool Page (when a tool is selected) =====
  if (activeTool) {
    return (
      <div className="relative -m-3 min-h-[calc(100vh-4rem)] overflow-hidden bg-black sm:-m-4 lg:-m-6">
        <style>{BLOOM_CSS}</style>

        {/* Video background — optimized: preload metadata only, lazy load */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster="/backgrounds/scholar-poster.svg"
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        >
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 z-0 bg-black/60" />

        {/* Content */}
        <div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)]">
          {/* Navbar */}
          <nav className="flex items-center justify-between px-4 md:px-8 py-4">
            <button
              onClick={() => setOpenId(null)}
              className="bloom-glass rounded-full px-4 py-2 flex items-center gap-2 text-sm text-white/80 hover:text-white"
            >
              <ChevronRight className="h-4 w-4 rotate-180" /> Back to Tools
            </button>
            <div className="flex items-center gap-2">
              <div className="grid place-items-center h-8 w-8 rounded-lg bg-white/10">
                <activeTool.icon className="h-4 w-4 text-white" />
              </div>
              <span className="bloom-display text-sm text-white font-medium">{activeTool.name}</span>
            </div>
          </nav>

          {/* Hero heading */}
          <div className="px-4 md:px-8 mb-4 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="bloom-serif text-4xl md:text-5xl text-white leading-tight"
            >
              {activeTool.name}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-sm text-white/50 mt-2 max-w-md mx-auto bloom-display"
            >
              {activeTool.blurb}
            </motion.p>
          </div>

          {/* Tool content — in a glass container */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
            <div className={cn("mx-auto", (activeTool.id === "ai-pdf-studio" || activeTool.id === "slideshow-maker") ? "max-w-7xl" : "max-w-2xl")}>
              <div className={cn("bloom-glass-strong rounded-3xl", activeTool.id === "slideshow-maker" ? "p-4 md:p-6" : "p-6 md:p-8")}>
                <div className="tool-content">
                  <ToolContent id={activeTool.id} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== Tools Grid (landing page) =====
  return (
    <div className="relative -m-3 min-h-[calc(100vh-4rem)] overflow-hidden sm:-m-4 lg:-m-6">
      {/* Video background — optimized: preload metadata only */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/backgrounds/scholar-poster.svg"
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
      >
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/50" />

      <style>{BLOOM_CSS}</style>

      {/* Content layer */}
      <div className="relative z-10 flex min-h-[calc(100vh-4rem)]">
        {/* Left panel — 52% */}
        <div className="w-full lg:w-[52%] relative p-4 lg:p-6">
          <div className="bloom-glass-strong absolute inset-4 lg:inset-6 rounded-3xl" />
          <div className="relative z-10 flex flex-col h-full min-h-[calc(100vh-8rem)] p-6 lg:p-10">
            {/* Nav */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid place-items-center h-8 w-8 rounded-full bloom-glass">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="bloom-display text-2xl tracking-tighter text-white font-semibold">bloom</span>
              </div>
              <button type="button" onClick={() => document.getElementById("bloom-tools-menu")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="bloom-glass rounded-full px-4 py-2 flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform" aria-label="Jump to AI tools menu">
                <span className="text-sm text-white/80">Menu</span>
              </button>
            </div>

            {/* Hero center */}
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="mb-6"
              >
                <div className="grid place-items-center h-20 w-20 rounded-full bloom-glass-strong">
                  <Sparkles className="h-10 w-10 text-white" />
                </div>
              </motion.div>

              <h1 className="bloom-display text-5xl lg:text-6xl tracking-[-0.04em] text-white leading-[1.05] max-w-xl bloom-fade-1">
                Innovating the <span className="bloom-serif text-white/80">spirit of bloom</span> AI
              </h1>

              <p className="text-white/60 text-sm max-w-md mt-6 bloom-fade-2">
                Ten specialised AI tools that act on your real study data — mastery, streak, progress. Pick one to begin.
              </p>

              <div className="flex flex-wrap gap-2 justify-center mt-6 bloom-fade-3">
                {["Analyze", "Predict", "Generate"].map((pill) => (
                  <span key={pill} className="bloom-glass rounded-full px-4 py-1.5 text-xs text-white/80">
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom quote */}
            <div className="bloom-fade-4 text-center">
              <p className="text-[10px] tracking-widest uppercase text-white/50 mb-2">AI TOOLBOX</p>
              <p className="bloom-display text-sm text-white/80 max-w-md mx-auto">
                <span className="bloom-serif">"Smart tools for sharper study."</span>
              </p>
              <div className="flex items-center gap-2 justify-center mt-3">
                <span className="h-px w-8 bg-white/20" />
                <span className="text-[10px] tracking-widest text-white/50">{scholarClass === 11 ? "ISHAN'S SCHOLAR" : "NEHA'S SCHOLAR"}</span>
                <span className="h-px w-8 bg-white/20" />
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — 48% (desktop only) */}
        <div className="hidden lg:flex w-[48%] flex-col p-6 gap-4">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="bloom-glass rounded-full px-3 py-2 flex items-center gap-3">
              <span className="text-white/60 hover:text-white transition-colors cursor-pointer text-sm">11 Tools</span>
              <ArrowRight className="h-3 w-3 text-white/40" />
            </div>
            <div className="bloom-glass rounded-full p-2">
              <Sparkles className="h-4 w-4 text-white/80" />
            </div>
          </div>

          {/* Tools grid — scrollable, click opens in-page tool page */}
          <div id="bloom-tools-menu" className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
            {TOOLS.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
              >
                <div
                  onClick={() => setOpenId(t.id)}
                  className={cn(
                    "bloom-glass rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-transform group relative",
                    t.highlight && "ring-2 ring-rose-500/50 bg-rose-500/5"
                  )}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpenId(t.id); } }}
                >
                  {t.badge && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg">
                      {t.badge}
                    </span>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="grid place-items-center h-12 w-12 rounded-xl bloom-glass-strong shrink-0">
                      <t.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="bloom-display text-base text-white font-medium">{t.name}</h3>
                      <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{t.blurb}</p>
                    </div>
                    <div className="grid place-items-center h-8 w-8 rounded-full bg-white/10 shrink-0 group-hover:bg-white/20 transition-colors">
                      <ArrowRight className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom feature section */}
          <div className="bloom-glass-strong rounded-[2.5rem] p-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="bloom-glass rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Wand2 className="h-3.5 w-3.5 text-white/70" />
                  <span className="text-xs text-white/80 font-medium">AI Powered</span>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed">Groq-powered study assistance with Gemini image generation</p>
              </div>
              <div className="bloom-glass rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-3.5 w-3.5 text-white/70" />
                  <span className="text-xs text-white/80 font-medium">CBSE Aligned</span>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed">CBSE Class 9 / 11 syllabus, all subjects</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile tools list */}
      <div className="lg:hidden relative z-10 px-4 pb-8 space-y-3">
        {TOOLS.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05, duration: 0.3 }}
          >
            <div
              onClick={() => setOpenId(t.id)}
              className={cn(
                "bloom-glass rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-transform group relative",
                t.highlight && "ring-2 ring-rose-500/50 bg-rose-500/5"
              )}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpenId(t.id); } }}
            >
              {t.badge && (
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg">
                  {t.badge}
                </span>
              )}
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-10 w-10 rounded-xl bloom-glass-strong shrink-0">
                  <t.icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="bloom-display text-sm text-white font-medium">{t.name}</h3>
                  <p className="text-[11px] text-white/50 mt-0.5 truncate">{t.blurb}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-white/60 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
