"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askAIJSON } from "@/lib/ai";
import { useStore } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import type { Subject } from "@/lib/curriculum";
import { exportPDF, mdToHtml } from "@/lib/pdf";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { StatCard, EmptyState, Markdown } from "@/lib/shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MessageCircleQuestion, Star, CheckCircle2, Search, Sparkles, Plus, Download,
  Brain, MessageSquare, Clock, Filter, Layers, BookOpen, ChevronRight, X,
  HelpCircle, Flame, TrendingUp, Trash2,
} from "lucide-react";

// ============================================================================
// Doubt History
// ============================================================================

type DoubtSource = "ai-tutor" | "community" | "manual" | "teacher";
type DoubtStatus = "open" | "resolved";

interface Doubt {
  id: string;
  question: string;
  answer: string;
  subject: string;     // subject id
  chapter?: string;
  source: DoubtSource;
  status: DoubtStatus;
  starred: boolean;
  createdAt: number;
  persona?: string;
  tags?: string[];
}

const SOURCE_META: Record<DoubtSource, { label: string; icon: any; color: string }> = {
  "ai-tutor":  { label: "AI Tutor",  icon: Brain,         color: "#d946ef" },
  "community": { label: "Community", icon: MessageSquare, color: "#14b8a6" },
  "manual":    { label: "Manual",    icon: HelpCircle,    color: "#f59e0b" },
  "teacher":   { label: "Teacher",   icon: BookOpen,      color: "#6366f1" },
};

// ============================================================================
// Helpers
// ============================================================================
function loadDoubts(scholarClass: 9 | 11): Doubt[] {
  const seed = scholarClass === 11 ? SEED_DOUBTS_CLASS11 : SEED_DOUBTS_CLASS9;
  if (typeof window === "undefined") return seed;
  return profileGetJSON<Doubt[]>(scholarClass, "doubt-history", seed);
}
function saveDoubts(list: Doubt[], scholarClass: 9 | 11) {
  profileSetJSON(scholarClass, "doubt-history", list);
}

const dayMs = 86_400_000;
function timeAgo(t: number): string {
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < hourMs) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < dayMs) return `${Math.floor(diff / hourMs)}h ago`;
  if (diff < 7 * dayMs) return `${Math.floor(diff / dayMs)}d ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
const hourMs = 3_600_000;

function subjectName(curriculum: Subject[], id: string): string {
  return curriculum.find((s) => s.id === id)?.name ?? id;
}
function subjectAccent(curriculum: Subject[], id: string): string {
  return curriculum.find((s) => s.id === id)?.accent ?? "#64748b";
}
function subjectIcon(curriculum: Subject[], id: string): string {
  return curriculum.find((s) => s.id === id)?.icon ?? "📘";
}
function chapterTitle(curriculum: Subject[], subjectId: string, chapterId?: string): string | undefined {
  if (!chapterId) return undefined;
  return curriculum.find((s) => s.id === subjectId)?.chapters.find((c) => c.id === chapterId)?.title;
}

// ============================================================================
// Seed data — sample doubts. Two flavours, switched by scholarClass so the
// seed timeline is always relevant to the active profile.
// ============================================================================
const now = Date.now();
const SEED_DOUBTS_CLASS9: Doubt[] = [
  {
    id: "seed-1", question: "Why does a body in motion stay in motion if no force acts on it?",
    answer: "Newton's First Law (Law of Inertia) states that an object will remain at rest or in uniform motion in a straight line unless acted upon by an external force. This is a property of matter called inertia. On Earth, friction and air resistance always act as external forces, so we don't see perpetual motion in everyday life.",
    subject: "science", chapter: "s4", source: "ai-tutor", status: "resolved", starred: true,
    createdAt: now - 2 * 3600_000, persona: "dr-meera", tags: ["Newton's Laws", "Inertia"],
  },
  {
    id: "seed-2", question: "How do I find the zeroes of a quadratic polynomial p(x) = x² - 5x + 6?",
    answer: "Factorise: x² - 5x + 6 = (x - 2)(x - 3). So the zeroes are x = 2 and x = 3. Verify by substitution: p(2) = 4 - 10 + 6 = 0 ✓ and p(3) = 9 - 15 + 6 = 0 ✓.",
    subject: "maths", chapter: "m2", source: "ai-tutor", status: "resolved", starred: false,
    createdAt: now - 5 * 3600_000, persona: "mr-raj", tags: ["Polynomials", "Factorisation"],
  },
  {
    id: "seed-3", question: "What was the main cause of the French Revolution?",
    answer: "Multiple interlinked causes: (1) Social inequality — the Third Estate bore all taxes while the clergy and nobility were exempt; (2) Economic crisis — France was bankrupt from wars and lavish spending; (3) Subsistence crises — bread prices skyrocketed; (4) Enlightenment ideas — Rousseau, Montesquieu inspired equality; (5) Immediate trigger — calling of the Estates General in May 1789.",
    subject: "sst", chapter: "h1", source: "ai-tutor", status: "resolved", starred: true,
    createdAt: now - dayMs, persona: "arjun", tags: ["French Revolution", "Causes"],
  },
  {
    id: "seed-4", question: "Difference between xylem and phloem?",
    answer: "**Xylem** transports water and minerals from roots to leaves (unidirectional, upward). Made of tracheids and vessels. **Phloem** transports food (sucrose) from leaves to all parts of the plant (bidirectional). Made of sieve tubes and companion cells.",
    subject: "science", chapter: "b2", source: "community", status: "resolved", starred: false,
    createdAt: now - 2 * dayMs, tags: ["Tissues", "Plants"],
  },
  {
    id: "seed-5", question: "How do I solve a word problem on linear equations in two variables?",
    answer: "Step 1: Identify the two unknowns and assign them variables x and y. Step 2: Translate each sentence into an equation. Step 3: Solve the system (substitution or elimination). Step 4: Verify your answer makes sense in the problem context.",
    subject: "maths", chapter: "m4", source: "ai-tutor", status: "open", starred: false,
    createdAt: now - 3 * dayMs, persona: "mr-raj", tags: ["Linear Equations", "Word Problems"],
  },
  {
    id: "seed-6", question: "What is the theme of 'The Fun They Had' by Isaac Asimov?",
    answer: "Main theme: technology vs human connection in education. Margie's mechanical teacher is efficient but lacks warmth. The story contrasts an impersonal future classroom with the warmth of community schools. Asimov critiques over-automation and highlights nostalgia for shared human learning.",
    subject: "english", source: "ai-tutor", status: "resolved", starred: true,
    createdAt: now - 4 * dayMs, persona: "sara", tags: ["Beehive", "Themes"],
  },
  {
    id: "seed-7", question: "Why is the monsoon called the 'unifying bond' of India?",
    answer: "The monsoon unifies India because its rhythm affects every part of the country — agriculture, economy, culture, and festivals all revolve around it. From Kerala's onset in June to its withdrawal from Rajasthan in September, the entire subcontinent's life cycle is tied to these winds.",
    subject: "sst", chapter: "g2", source: "ai-tutor", status: "resolved", starred: false,
    createdAt: now - 6 * dayMs, persona: "arjun", tags: ["Monsoon", "Climate"],
  },
  {
    id: "seed-8", question: "What's the difference between distance and displacement?",
    answer: "**Distance** is the total path length travelled (scalar, always positive). **Displacement** is the shortest straight-line distance from start to end (vector, can be negative). If a body returns to start, displacement = 0 but distance = full path. Unit: metres (m) for both.",
    subject: "science", chapter: "s1", source: "community", status: "resolved", starred: false,
    createdAt: now - 8 * dayMs, tags: ["Motion", "Scalars vs Vectors"],
  },
];

const SEED_DOUBTS_CLASS11: Doubt[] = [
  {
    id: "c11-seed-1", question: "Why is the work-energy theorem valid even for a variable force, but not for friction?",
    answer: "The work-energy theorem (W = ΔKE) is derived purely from Newton's second law and the chain rule, so it holds for ANY net force, variable or constant. The subtlety with friction is that friction is non-conservative: the work done against friction depends on the path, not just the endpoints, and the energy is dissipated as heat. The theorem still holds — but the energy lost to friction must be accounted for separately; you cannot define a potential energy function for friction.",
    subject: "physics", chapter: "p6", source: "ai-tutor", status: "resolved", starred: true,
    createdAt: now - 2 * 3600_000, persona: "dr-meera", tags: ["Work-Energy Theorem", "Conservative Forces"],
  },
  {
    id: "c11-seed-2", question: "How do I find the modulus and argument of the complex number z = 1 + i√3?",
    answer: "Modulus: |z| = √(1² + (√3)²) = √(1 + 3) = 2. Argument: arg(z) = tan⁻¹(√3 / 1) = tan⁻¹(√3) = π/3 (60°). So z = 2·(cos(π/3) + i·sin(π/3)) = 2·e^(iπ/3) in polar / Euler form.",
    subject: "maths", chapter: "m5", source: "ai-tutor", status: "resolved", starred: false,
    createdAt: now - 5 * 3600_000, persona: "mr-raj", tags: ["Complex Numbers", "Polar Form"],
  },
  {
    id: "c11-seed-3", question: "Why do we use hybridization theory to explain the shape of methane (CH₄)?",
    answer: "Carbon's ground-state configuration is 1s² 2s² 2p² — only 2 unpaired electrons, suggesting 2 bonds. But methane has 4 equivalent C-H bonds at 109.5°. Hybridization mixes one 2s and three 2p orbitals to form four equivalent sp³ hybrid orbitals pointing to the corners of a tetrahedron. This explains both the four equivalent bonds and the tetrahedral geometry observed experimentally.",
    subject: "chemistry", chapter: "c4", source: "ai-tutor", status: "resolved", starred: true,
    createdAt: now - dayMs, persona: "dr-meera", tags: ["Chemical Bonding", "Hybridization", "sp3"],
  },
  {
    id: "c11-seed-4", question: "Why does a list comprehension in Python evaluate faster than a for-loop with append?",
    answer: "List comprehensions are executed in C under the hood — the Python interpreter doesn't have to do the attribute lookup for `list.append` on every iteration, and the loop overhead is avoided. The comprehension builds the list in a single bytecode operation (LIST_APPEND), while a for-loop with `lst.append(x)` does a LOAD_METHOD + CALL_METHOD on every iteration. For large loops, comprehensions can be 30–50% faster.",
    subject: "cs", chapter: "cs7", source: "community", status: "resolved", starred: false,
    createdAt: now - 2 * dayMs, tags: ["Python", "Lists", "Performance"],
  },
  {
    id: "c11-seed-5", question: "How do I decide whether to use integration by substitution or by parts?",
    answer: "Use substitution when the integrand contains a function and its derivative (or a clear inner function), e.g. ∫2x·(x²+1)⁵ dx → substitute u = x²+1. Use integration by parts when the integrand is a product of two UNRELATED functions, using ILATE (Inverse, Log, Algebraic, Trig, Exponential) to pick u. Example: ∫x·eˣ dx → u = x, dv = eˣ dx. Substitution simplifies; parts splits the product.",
    subject: "maths", chapter: "m13", source: "ai-tutor", status: "open", starred: false,
    createdAt: now - 3 * dayMs, persona: "mr-raj", tags: ["Limits and Derivatives", "Integration"],
  },
  {
    id: "c11-seed-6", question: "What is the central theme of 'The Portrait of a Lady' by Khushwant Singh?",
    answer: "The central theme is the quiet erosion of an old, deeply affectionate relationship between the narrator and his grandmother as modernity (English-medium city schooling, going abroad) distances them. The grandmother symbolises tradition, faith, and unconditional love. The final scene — the sparrows mourning her death — suggests that genuine love transcends speech.",
    subject: "english", chapter: "e1", source: "ai-tutor", status: "resolved", starred: true,
    createdAt: now - 4 * dayMs, persona: "sara", tags: ["Hornbill", "Themes"],
  },
  {
    id: "c11-seed-7", question: "Why does a simple pendulum only show SHM for small angles?",
    answer: "The pendulum's equation of motion is α = -(g/L)·sin θ. SHM requires α ∝ -θ, but we have sin θ instead of θ. For small angles (θ < 10°), sin θ ≈ θ (in radians), so the equation becomes α ≈ -(g/L)θ — exactly the SHM equation. For larger angles, sin θ diverges from θ, the period increases with amplitude, and the motion becomes anharmonic (non-SHM).",
    subject: "physics", chapter: "p14", source: "ai-tutor", status: "resolved", starred: false,
    createdAt: now - 6 * dayMs, persona: "dr-meera", tags: ["Oscillations", "SHM", "Small Angle"],
  },
  {
    id: "c11-seed-8", question: "What is the difference between a dictionary and a list in Python? When do I use which?",
    answer: "A list is an ordered sequence accessed by integer index (0, 1, 2, …) — use it when order matters and you iterate sequentially. A dictionary is an unordered collection of key-value pairs accessed by key — use it when you need fast O(1) lookups by a meaningful identifier (e.g. student roll → name). Lists support duplicates and slicing; dictionaries (since 3.7) preserve insertion order but keys must be unique and hashable.",
    subject: "cs", chapter: "cs11", source: "community", status: "resolved", starred: false,
    createdAt: now - 8 * dayMs, tags: ["Python", "Dictionaries", "Data Structures"],
  },
];

// ============================================================================
// AI Cluster interface
// ============================================================================
interface DoubtCluster {
  title: string;
  subject: string;
  count: number;
  doubtIds: string[];
  insight: string;
  relatedTopic: string;
}

// ============================================================================
// Component
// ============================================================================
export function DoubtHistoryView() {
  const CURRICULUM = useCurriculum();
  const scholarClass = useStore((s) => s.user.scholarClass);
  const chatThreads = useStore((s) => s.chatThreads);
  const addXP = useStore((s) => s.addXP);
  const pushActivity = useStore((s) => s.pushActivity);

  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [search, setSearch] = useState("");
  const [fSubject, setFSubject] = useState("all");
  const [fSource, setFSource] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fDate, setFDate] = useState("all");
  const [openDoubt, setOpenDoubt] = useState<Doubt | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [clusters, setClusters] = useState<DoubtCluster[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [tab, setTab] = useState("all");

  // Form state
  const [fQ, setFQ] = useState("");
  const [fA, setFA] = useState("");
  const [fSubj, setFSubj] = useState(scholarClass === 11 ? "physics" : "science");
  const [fChap, setFChap] = useState("");

  useEffect(() => { setDoubts(loadDoubts(scholarClass)); }, [scholarClass]);

  // ===== Merge chat threads into the unified index =====
  const threadDoubts = useMemo<Doubt[]>(() => {
    return chatThreads.flatMap((t) => {
      const firstUser = t.messages.find((m) => m.role === "user");
      const firstAI = t.messages.find((m) => m.role === "assistant");
      if (!firstUser) return [];
      return [{
        id: `thread-${t.id}`,
        question: firstUser.content,
        answer: firstAI?.content ?? "(no answer yet)",
        subject: "science", // chat threads don't track subject; default
        source: "ai-tutor" as DoubtSource,
        status: "resolved" as DoubtStatus,
        starred: false,
        createdAt: t.updatedAt,
        persona: t.persona,
      }];
    });
  }, [chatThreads]);

  const allDoubts = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...doubts, ...threadDoubts];
    return merged.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [doubts, threadDoubts]);

  // ===== Filtering =====
  const filtered = useMemo(() => {
    return allDoubts.filter((d) => {
      if (search) {
        const q = search.toLowerCase();
        if (!d.question.toLowerCase().includes(q) && !d.answer.toLowerCase().includes(q)
          && !(d.tags ?? []).some((t) => t.toLowerCase().includes(q))) return false;
      }
      if (fSubject !== "all" && d.subject !== fSubject) return false;
      if (fSource !== "all" && d.source !== fSource) return false;
      if (fStatus !== "all" && d.status !== fStatus) return false;
      if (fDate !== "all") {
        const age = Date.now() - d.createdAt;
        if (fDate === "today" && age > dayMs) return false;
        if (fDate === "week" && age > 7 * dayMs) return false;
        if (fDate === "month" && age > 30 * dayMs) return false;
      }
      return true;
    });
  }, [allDoubts, search, fSubject, fSource, fStatus, fDate]);

  // ===== Tab views =====
  const starredDoubts = filtered.filter((d) => d.starred);
  const bySubject = useMemo(() => {
    const map = new Map<string, Doubt[]>();
    filtered.forEach((d) => {
      const arr = map.get(d.subject) ?? [];
      arr.push(d); map.set(d.subject, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // ===== Actions =====
  const toggleStar = (id: string) => {
    setDoubts((prev) => {
      const next = prev.map((d) => d.id === id ? { ...d, starred: !d.starred } : d);
      saveDoubts(next, scholarClass);
      return next;
    });
  };
  const toggleResolved = (id: string) => {
    setDoubts((prev) => {
      const next = prev.map((d) => d.id === id ? { ...d, status: (d.status === "resolved" ? "open" : "resolved") as DoubtStatus } : d);
      saveDoubts(next, scholarClass);
      return next;
    });
    const d = doubts.find((x) => x.id === id);
    if (d && d.status === "open") {
      addXP(2);
      toast.success("Marked as resolved +2 XP");
    }
  };
  const deleteDoubt = (id: string) => {
    setDoubts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      saveDoubts(next, scholarClass);
      return next;
    });
    toast.success("Doubt removed");
    if (openDoubt?.id === id) setOpenDoubt(null);
  };

  const createDoubt = () => {
    if (!fQ.trim()) { toast.error("Question cannot be empty."); return; }
    const d: Doubt = {
      id: "man-" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      question: fQ.trim(),
      answer: fA.trim() || "(no answer recorded — add one later)",
      subject: fSubj,
      chapter: fChap || undefined,
      source: "manual",
      status: "open",
      starred: false,
      createdAt: Date.now(),
      tags: [],
    };
    const next = [d, ...doubts];
    setDoubts(next); saveDoubts(next, scholarClass);
    addXP(5);
    pushActivity({ type: "note", text: `Logged doubt: ${d.question.slice(0, 50)}…`, icon: "❓" });
    toast.success("Doubt logged +5 XP");
    setFQ(""); setFA(""); setFChap("");
    setCreateOpen(false);
  };

  // ===== Smart Clusters via AI =====
  const runClusters = async () => {
    setAiLoading(true);
    try {
      const prompt = `You are an academic analytics engine. Group these CBSE Class ${scholarClass} doubts by underlying concept/topic. Find 3-6 clusters.

Doubts:
${allDoubts.map((d, i) => `${i + 1}. [${d.subject}] ${d.question}`).join("\n")}

Return strict JSON:
{
  "clusters": [
    {
      "title": string (cluster name, e.g. "Newton's Laws of Motion"),
      "subject": string (one of: maths, science, sst, english, hindi),
      "doubtIndices": number[] (1-based indices from the list above),
      "insight": string (1-2 sentence pattern observation — why these doubts cluster, what conceptual gap they reveal),
      "relatedTopic": string (a related topic to revise)
    }
  ]
}`;
      const res = await askAIJSON<{ clusters: any[] }>(prompt, "academic-coach");
      if (!res?.clusters?.length) throw new Error("no result");
      const mapped: DoubtCluster[] = res.clusters.map((c) => ({
        title: String(c.title),
        subject: String(c.subject),
        count: Array.isArray(c.doubtIndices) ? c.doubtIndices.length : 0,
        doubtIds: (Array.isArray(c.doubtIndices) ? c.doubtIndices : [])
          .map((i: number) => allDoubts[i - 1]?.id)
          .filter(Boolean) as string[],
        insight: String(c.insight),
        relatedTopic: String(c.relatedTopic),
      }));
      setClusters(mapped);
      addXP(4);
      toast.success(`AI identified ${mapped.length} concept clusters +4 XP`);
    } catch {
      toast.error("Cluster analysis failed. Try again.");
    } finally { setAiLoading(false); }
  };

  // ===== Related doubts (in dialog) =====
  const relatedDoubts = useMemo(() => {
    if (!openDoubt) return [];
    return allDoubts
      .filter((d) => d.id !== openDoubt.id && (d.subject === openDoubt.subject || d.chapter === openDoubt.chapter))
      .slice(0, 4);
  }, [openDoubt, allDoubts]);

  // ===== Stats =====
  const totalDoubts = allDoubts.length;
  const resolvedCount = allDoubts.filter((d) => d.status === "resolved").length;
  const starredCount = allDoubts.filter((d) => d.starred).length;
  const resolutionRate = totalDoubts > 0 ? Math.round((resolvedCount / totalDoubts) * 100) : 0;

  // ===== Export =====
  const exportDoubts = () => {
    const md = `# Doubt History
Generated on ${new Date().toLocaleString()}

## Summary
- Total doubts: ${totalDoubts}
- Resolved: ${resolvedCount}
- Starred: ${starredCount}
- Resolution rate: ${resolutionRate}%

## All Doubts
${allDoubts.map((d, i) => `### ${i + 1}. ${d.question}
- **Subject:** ${subjectName(CURRICULUM, d.subject)}${d.chapter ? ` • ${chapterTitle(CURRICULUM, d.subject, d.chapter)}` : ""}
- **Source:** ${SOURCE_META[d.source].label}
- **Status:** ${d.status === "resolved" ? "✓ Resolved" : "○ Open"}${d.starred ? " • ⭐ Starred" : ""}
- **When:** ${new Date(d.createdAt).toLocaleString()}

${d.answer}`).join("\n\n---\n\n")}

${clusters && clusters.length ? `## AI Smart Clusters
${clusters.map((c, i) => `${i + 1}. **${c.title}** (${subjectName(CURRICULUM, c.subject)}) — ${c.count} doubts
   - Insight: ${c.insight}
   - Revise: ${c.relatedTopic}`).join("\n")}` : ""}

> Generated by Scholar Doubt History.`;
    exportPDF({ title: "Doubt History Report", subtitle: `${totalDoubts} doubts • ${resolutionRate}% resolved`, bodyHtml: mdToHtml(md), accent: "#8b5cf6", scholarClass });
    toast.success("Exporting doubt history…");
  };

  // ===== Doubt Card =====
  const DoubtCard = ({ d }: { d: Doubt }) => {
    const meta = SOURCE_META[d.source];
    const Icon = meta.icon;
    const accent = subjectAccent(CURRICULUM, d.subject);
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.25 }}
        whileHover={{ y: -2 }}
        onClick={() => setOpenDoubt(d)}
        className="dh-glass rounded-2xl p-4 cursor-pointer group border-l-2 transition-all"
        style={{ borderLeftColor: accent }}
      >
        <div className="flex items-start gap-3">
          <div className="grid place-items-center h-10 w-10 rounded-xl shrink-0 text-xl"
            style={{ background: `${accent}22` }}>
            {subjectIcon(CURRICULUM, d.subject)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="text-white font-medium text-sm leading-snug line-clamp-2 group-hover:text-violet-200 transition-colors">{d.question}</h4>
              <button onClick={(e) => { e.stopPropagation(); toggleStar(d.id); }}
                className={cn("shrink-0 p-1 rounded-md transition-all", d.starred ? "text-amber-300" : "text-white/30 hover:text-amber-300")}>
                <Star className="h-4 w-4" fill={d.starred ? "currentColor" : "none"} />
              </button>
            </div>
            <p className="text-white/60 text-xs leading-relaxed line-clamp-2 mb-2">{d.answer}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5" style={{ background: `${accent}15`, color: accent, borderColor: `${accent}40` }}>
                {subjectName(CURRICULUM, d.subject)}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 bg-white/5 border-white/15 text-white/70">
                <Icon className="h-2.5 w-2.5 mr-0.5" />{meta.label}
              </Badge>
              {d.status === "resolved" ? (
                <Badge variant="outline" className="text-[10px] px-1.5 bg-emerald-500/15 border-emerald-500/40 text-emerald-200">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Resolved
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 bg-amber-500/15 border-amber-500/40 text-amber-200">
                  <Clock className="h-2.5 w-2.5 mr-0.5" />Open
                </Badge>
              )}
              <span className="text-[10px] text-white/40 ml-auto">{timeAgo(d.createdAt)}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const resetFilters = () => {
    setSearch(""); setFSubject("all"); setFSource("all"); setFStatus("all"); setFDate("all");
  };
  const hasFilters = search || fSubject !== "all" || fSource !== "all" || fStatus !== "all" || fDate !== "all";

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden -m-4 lg:-m-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap');
        .dh-font-serif { font-family: 'Instrument Serif', serif; }
        .dh-font-body { font-family: 'Inter', sans-serif; }
        .dh-glass { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); box-shadow: inset 0 1px 1px rgba(255,255,255,0.08); color: white; }
        .dh-glass-strong { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.16); box-shadow: inset 0 1px 1px rgba(255,255,255,0.1); color: white; }
        .dh-glass input, .dh-glass textarea, .dh-glass select { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.15) !important; color: white !important; }
        .dh-glass input::placeholder, .dh-glass textarea::placeholder { color: rgba(255,255,255,0.4) !important; }
      `}</style>

      <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 z-0 bg-black/55" />

      <div className="relative z-10 dh-font-body p-4 md:p-8 lg:p-12 max-w-7xl mx-auto">
        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="grid place-items-center h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500/30 to-purple-500/30 text-violet-300 border border-white/10">
                <MessageCircleQuestion className="h-6 w-6" />
              </div>
              <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40">Doubts • AI Clusters • Spaced</Badge>
            </div>
            <h1 className="dh-font-serif text-5xl md:text-6xl text-white leading-tight">
              Doubt <em className="text-violet-300">History</em>
            </h1>
            <p className="text-white/70 mt-3 max-w-2xl">
              Every doubt you've ever asked — from AI tutors, community threads, or manually logged — unified in one searchable index.
              Star important ones, mark resolved, and let AI cluster related doubts to surface conceptual gaps.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="dh-glass bg-white/5 border-white/15 text-white hover:bg-white/10" onClick={exportDoubts}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export
            </Button>
            <Button className="bg-violet-500 hover:bg-violet-600 text-white" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Quick Add
            </Button>
          </div>
        </motion.div>

        {/* STAT PILLS */}
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: MessageCircleQuestion, label: "Total Doubts", value: totalDoubts, accent: "#8b5cf6" },
            { icon: CheckCircle2, label: "Resolved", value: resolvedCount, accent: "#10b981" },
            { icon: Star, label: "Starred", value: starredCount, accent: "#f59e0b" },
            { icon: TrendingUp, label: "Resolution Rate", value: `${resolutionRate}%`, accent: "#14b8a6" },
          ].map((s, i) => (
            <motion.div key={i} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
              <StatCard icon={s.icon} label={s.label} value={s.value} accent={s.accent} />
            </motion.div>
          ))}
        </motion.div>

        {/* SEARCH + FILTERS */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="dh-glass rounded-2xl p-4 mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search doubts, answers, tags…"
                className="bg-white/5 border-white/15 text-white pl-9" />
            </div>
            {hasFilters && (
              <Button variant="ghost" className="text-white/60 hover:text-white" onClick={resetFilters}>
                <X className="h-3.5 w-3.5 mr-1" />Reset
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-white/40" />
            <select value={fSubject} onChange={(e) => setFSubject(e.target.value)}
              className="text-xs p-1.5 rounded-md bg-white/5 border border-white/15 text-white">
              <option value="all">All subjects</option>
              {CURRICULUM.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={fSource} onChange={(e) => setFSource(e.target.value)}
              className="text-xs p-1.5 rounded-md bg-white/5 border border-white/15 text-white">
              <option value="all">All sources</option>
              {(Object.keys(SOURCE_META) as DoubtSource[]).map((s) => <option key={s} value={s}>{SOURCE_META[s].label}</option>)}
            </select>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
              className="text-xs p-1.5 rounded-md bg-white/5 border border-white/15 text-white">
              <option value="all">All status</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
            <select value={fDate} onChange={(e) => setFDate(e.target.value)}
              className="text-xs p-1.5 rounded-md bg-white/5 border border-white/15 text-white">
              <option value="all">Any time</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </div>
        </motion.div>

        {/* TABS */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="dh-glass bg-transparent h-auto p-1 flex flex-wrap gap-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              All {filtered.length > 0 && <span className="ml-1.5 text-xs bg-violet-500/30 text-violet-200 rounded-full px-1.5">{filtered.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="starred" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">
              Starred {starredDoubts.length > 0 && <span className="ml-1.5 text-xs bg-amber-500/30 text-amber-200 rounded-full px-1.5">{starredDoubts.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="clusters" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">Clusters</TabsTrigger>
            <TabsTrigger value="subject" className="data-[state=active]:bg-white/15 data-[state=active]:text-white text-white/70">By Subject</TabsTrigger>
          </TabsList>

          {/* ===== ALL ===== */}
          <TabsContent value="all" className="space-y-3">
            {filtered.length === 0 ? (
              <EmptyState icon={MessageCircleQuestion} title="No doubts found"
                description={hasFilters ? "Try adjusting your filters or search." : "Log your first doubt to start building your knowledge index."}
                action={!hasFilters && <Button className="bg-violet-500 hover:bg-violet-600 text-white" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Add doubt</Button>} />
            ) : (
              <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
                className="grid gap-3 md:grid-cols-2">
                <AnimatePresence mode="popLayout">
                  {filtered.map((d) => <DoubtCard key={d.id} d={d} />)}
                </AnimatePresence>
              </motion.div>
            )}
          </TabsContent>

          {/* ===== STARRED ===== */}
          <TabsContent value="starred" className="space-y-3">
            {starredDoubts.length === 0 ? (
              <EmptyState icon={Star} title="No starred doubts yet" description="Star important doubts to find them quickly later. Tap the star icon on any doubt card." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {starredDoubts.map((d) => <DoubtCard key={d.id} d={d} />)}
              </div>
            )}
          </TabsContent>

          {/* ===== CLUSTERS ===== */}
          <TabsContent value="clusters" className="space-y-4">
            <div className="dh-glass-strong rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 text-violet-200 border border-white/10 shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">AI Smart Clusters</h3>
                  <p className="text-xs text-white/60 mt-0.5">Group your doubts by underlying concept to surface weak areas. +4 XP per analysis.</p>
                </div>
              </div>
              <Button className="bg-violet-500 hover:bg-violet-600 text-white" disabled={aiLoading} onClick={runClusters}>
                {aiLoading ? (
                  <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Sparkles className="h-4 w-4 mr-1.5" /></motion.div>Analyzing…</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1.5" />{clusters ? "Re-run" : "Run"} cluster analysis</>
                )}
              </Button>
            </div>
            {!clusters && !aiLoading && (
              <EmptyState icon={Layers} title="No cluster analysis yet" description="Run the AI cluster analysis to discover which concepts your doubts revolve around — and what to revise next." />
            )}
            {clusters && (
              <div className="grid gap-3 md:grid-cols-2">
                {clusters.map((c, i) => {
                  const accent = subjectAccent(CURRICULUM, c.subject);
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                      className="dh-glass rounded-2xl p-4 border-l-2" style={{ borderLeftColor: accent }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-white font-semibold text-sm">{c.title}</h4>
                        <Badge variant="outline" className="text-[10px] px-1.5 shrink-0" style={{ background: `${accent}15`, color: accent, borderColor: `${accent}40` }}>
                          {c.count} doubts
                        </Badge>
                      </div>
                      <p className="text-white/70 text-xs leading-relaxed mb-3">{c.insight}</p>
                      <div className="flex items-center gap-1.5 text-xs">
                        <BookOpen className="h-3.5 w-3.5 text-violet-300" />
                        <span className="text-white/60">Revise:</span>
                        <span className="text-violet-200 font-medium">{c.relatedTopic}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ===== BY SUBJECT ===== */}
          <TabsContent value="subject" className="space-y-6">
            {bySubject.length === 0 ? (
              <EmptyState icon={BookOpen} title="Nothing to group" description="Add doubts across subjects to see them grouped here." />
            ) : bySubject.map(([subjId, list]) => {
              const accent = subjectAccent(CURRICULUM, subjId);
              return (
                <div key={subjId}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{subjectIcon(CURRICULUM, subjId)}</span>
                    <h3 className="text-white font-semibold">{subjectName(CURRICULUM, subjId)}</h3>
                    <Badge variant="outline" className="text-[10px] px-1.5" style={{ background: `${accent}15`, color: accent, borderColor: `${accent}40` }}>{list.length}</Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {list.map((d) => <DoubtCard key={d.id} d={d} />)}
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>

        {/* ===== DOUBT DETAIL DIALOG ===== */}
        <Dialog open={!!openDoubt} onOpenChange={(o) => !o && setOpenDoubt(null)}>
          <DialogContent className="dh-glass-strong !bg-black/60 !border-white/20 max-w-2xl max-h-[90vh] overflow-y-auto">
            {openDoubt && (() => {
              const meta = SOURCE_META[openDoubt.source];
              const accent = subjectAccent(CURRICULUM, openDoubt.subject);
              return (
                <>
                  <DialogHeader>
                    <div className="flex items-start gap-3 mb-2">
                      <div className="grid place-items-center h-10 w-10 rounded-xl text-xl shrink-0" style={{ background: `${accent}22` }}>
                        {subjectIcon(CURRICULUM, openDoubt.subject)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <DialogTitle className="dh-font-serif text-xl text-white leading-snug">{openDoubt.question}</DialogTitle>
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          <Badge variant="outline" className="text-[10px] px-1.5" style={{ background: `${accent}15`, color: accent, borderColor: `${accent}40` }}>
                            {subjectName(CURRICULUM, openDoubt.subject)}
                          </Badge>
                          {openDoubt.chapter && <span className="text-xs text-white/50">• {chapterTitle(CURRICULUM, openDoubt.subject, openDoubt.chapter)}</span>}
                          <Badge variant="outline" className="text-[10px] px-1.5 bg-white/5 border-white/15 text-white/70 ml-auto">
                            <meta.icon className="h-2.5 w-2.5 mr-0.5" />{meta.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="dh-glass rounded-xl p-4">
                      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Answer</p>
                      <div className="text-sm text-white/85 leading-relaxed prose-invert">
                        <Markdown content={openDoubt.answer} />
                      </div>
                    </div>
                    {(openDoubt.tags && openDoubt.tags.length > 0) && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wider text-white/40">Tags:</span>
                        {openDoubt.tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1.5 bg-white/5 border-white/15 text-white/70">#{t}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-white/40 flex items-center gap-2">
                      <Clock className="h-3 w-3" />{new Date(openDoubt.createdAt).toLocaleString()}
                    </div>

                    {/* Related doubts */}
                    {relatedDoubts.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-white/50 mb-2 flex items-center gap-1.5">
                          <ChevronRight className="h-3.5 w-3.5 text-violet-300" />Related doubts
                        </p>
                        <div className="space-y-2">
                          {relatedDoubts.map((r) => (
                            <button key={r.id} onClick={() => setOpenDoubt(r)}
                              className="dh-glass rounded-lg p-3 w-full text-left hover:bg-white/[0.07] transition-all">
                              <p className="text-xs text-white/80 font-medium leading-snug line-clamp-1">{r.question}</p>
                              <p className="text-[10px] text-white/40 mt-0.5 line-clamp-1">{r.answer}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter className="mt-4 flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="bg-white/5 border-white/15 text-white hover:bg-white/10"
                      onClick={() => toggleStar(openDoubt.id)}>
                      <Star className="h-3.5 w-3.5 mr-1.5" fill={openDoubt.starred ? "currentColor" : "none"} />
                      {openDoubt.starred ? "Starred" : "Star"}
                    </Button>
                    <Button variant="outline" size="sm" className="bg-white/5 border-white/15 text-white hover:bg-white/10"
                      onClick={() => toggleResolved(openDoubt.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      {openDoubt.status === "resolved" ? "Mark Open" : "Mark Resolved"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-rose-300 hover:bg-rose-500/10 ml-auto"
                      onClick={() => deleteDoubt(openDoubt.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* ===== CREATE DIALOG ===== */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="dh-glass-strong !bg-black/60 !border-white/20 max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="dh-font-serif text-2xl text-white flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-violet-300" /> Quick Add Doubt
              </DialogTitle>
              <DialogDescription className="text-white/70">Log a doubt you've already resolved or want to revisit. +5 XP per doubt.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Question *</Label>
                <Textarea value={fQ} onChange={(e) => setFQ(e.target.value)}
                  placeholder="What was the doubt?" rows={2}
                  className="bg-white/5 border-white/15 text-white" />
              </div>
              <div>
                <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Answer (optional)</Label>
                <Textarea value={fA} onChange={(e) => setFA(e.target.value)}
                  placeholder="The explanation or solution you found…" rows={3}
                  className="bg-white/5 border-white/15 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Subject</Label>
                  <select value={fSubj} onChange={(e) => { setFSubj(e.target.value); setFChap(""); }}
                    className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                    {CURRICULUM.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-white/70 text-xs uppercase tracking-wider mb-1.5 block">Chapter (optional)</Label>
                  <select value={fChap} onChange={(e) => setFChap(e.target.value)}
                    className="w-full p-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm">
                    <option value="">— None —</option>
                    {CURRICULUM.find((s) => s.id === fSubj)?.chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" className="text-white/70" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="bg-violet-500 hover:bg-violet-600 text-white" onClick={createDoubt}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Log doubt (+5 XP)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default DoubtHistoryView;
