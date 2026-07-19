"use client";

import { useStore, getLevelInfo } from "@/lib/store";
import { useCurriculum } from "@/lib/use-curriculum";
import { useUserName } from "@/lib/use-user-name";
import type { Subject } from "@/lib/curriculum";
import { askAI, askAIJSON, askAIStream } from "@/lib/ai";
import { navigateTo } from "@/lib/nav-event";
import { profileGetJSON, profileSetJSON } from "@/lib/profile-storage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Lock, Check, Star, Play, Zap, Trophy, Coins, Flame,
  ChevronRight, X, Loader2, BookOpen, Target, Gift, Wrench, HelpCircle,
  Video, Bot, Search, NotebookPen, Timer, Crown, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo, useRef, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { Markdown } from "@/lib/shared";

// ===== Types =====
type NodeType =
  | "lesson" | "quiz" | "boss" | "checkpoint" | "treasure"
  | "flashcards" | "video" | "ai-tutor" | "project" | "mystery";

type NodeState = "locked" | "unlocked" | "current" | "completed" | "perfect";

interface LevelNode {
  id: string;
  index: number;
  worldId: number;
  type: NodeType;
  title: string;
  subject: string;
  difficulty: string;
  xp: number;
  coins: number;
  description: string;
}

interface World {
  id: number;
  name: string;
  emoji: string;
  color: string;
  color2: string;
  glow: string;
  subtitle: string;
  startIdx: number;
}

// ===== Node type metadata =====
const NODE_TYPES: Record<NodeType, {
  icon: string;
  LucideIcon: LucideIcon;
  color: string;
  glow: string;
  label: string;
}> = {
  lesson: { icon: "📖", LucideIcon: BookOpen, color: "#3b82f6", glow: "59,130,246", label: "Lesson" },
  quiz: { icon: "🎯", LucideIcon: Target, color: "#f43f5e", glow: "244,63,94", label: "Quiz" },
  boss: { icon: "⚔️", LucideIcon: Trophy, color: "#ef4444", glow: "239,68,68", label: "Boss Battle" },
  checkpoint: { icon: "🏁", LucideIcon: Check, color: "#22c55e", glow: "34,197,94", label: "Checkpoint" },
  treasure: { icon: "🎁", LucideIcon: Gift, color: "#f59e0b", glow: "245,158,11", label: "Treasure" },
  flashcards: { icon: "⚡", LucideIcon: Zap, color: "#eab308", glow: "234,179,8", label: "Flashcards" },
  video: { icon: "▶️", LucideIcon: Video, color: "#d946ef", glow: "217,70,239", label: "Video Lesson" },
  "ai-tutor": { icon: "🤖", LucideIcon: Bot, color: "#8b5cf6", glow: "139,92,246", label: "AI Tutor" },
  project: { icon: "🔧", LucideIcon: Wrench, color: "#14b8a6", glow: "20,184,166", label: "Mini Project" },
  mystery: { icon: "❓", LucideIcon: HelpCircle, color: "#a855f7", glow: "168,85,247", label: "Mystery" },
};

// ===== Worlds =====
const WORLDS: World[] = [
  {
    id: 0, name: "Foundation Forest", emoji: "🌲",
    color: "#10b981", color2: "#14b8a6", glow: "16,185,129",
    subtitle: "Build your base — foundational chapters across all subjects",
    startIdx: 0,
  },
  {
    id: 1, name: "Algebra Alps", emoji: "🏔️",
    color: "#6366f1", color2: "#8b5cf6", glow: "99,102,241",
    subtitle: "Climb higher — algebra, geometry, and intermediate concepts",
    startIdx: 10,
  },
  {
    id: 2, name: "Science Galaxy", emoji: "🪐",
    color: "#a855f7", color2: "#d946ef", glow: "168,85,247",
    subtitle: "Explore the cosmos — advanced science and exam-boss showdowns",
    startIdx: 20,
  },
];

const XP_PER_NODE = 50;
const TOTAL_NODES = 30;

// ===== Generate 30 nodes deterministically =====
function generateNodes(curriculum: Subject[]): LevelNode[] {
  const typePattern: NodeType[] = [
    // World 1 — Foundation Forest
    "lesson", "video", "flashcards", "quiz", "treasure",
    "lesson", "ai-tutor", "checkpoint", "project", "boss",
    // World 2 — Algebra Alps
    "lesson", "video", "flashcards", "quiz", "mystery",
    "lesson", "ai-tutor", "checkpoint", "treasure", "boss",
    // World 3 — Science Galaxy
    "lesson", "video", "flashcards", "quiz", "treasure",
    "lesson", "ai-tutor", "checkpoint", "project", "boss",
  ];

  // Pick 30 chapters distributed across all 5 subjects
  const subjectsOrder = curriculum;
  const subjIdx: Record<string, number> = {};
  curriculum.forEach((s) => { subjIdx[s.id] = 0; });
  const picked: { subject: string; title: string }[] = [];
  for (let i = 0; i < TOTAL_NODES; i++) {
    const subj = subjectsOrder[i % subjectsOrder.length];
    const cIdx = subjIdx[subj.id] ?? 0;
    const chapter = subj.chapters[cIdx % subj.chapters.length];
    picked.push({ subject: subj.name, title: chapter.title });
    subjIdx[subj.id] = cIdx + 1;
  }

  const descMap: Record<NodeType, (t: string) => string> = {
    lesson: (t) => `Master the fundamentals of ${t}.`,
    quiz: (t) => `Test your knowledge of ${t} with quick MCQs.`,
    boss: (t) => `Final showdown: ${t} mega exam battle.`,
    checkpoint: (t) => `Checkpoint — review everything from ${t} so far.`,
    treasure: (t) => `Bonus rewards hidden inside ${t}.`,
    flashcards: (t) => `Quick-fire flashcard review for ${t}.`,
    video: (t) => `Watch a cinematic lesson on ${t}.`,
    "ai-tutor": (t) => `AI-powered deep dive into ${t}.`,
    project: (t) => `Hands-on mini project: build something with ${t}.`,
    mystery: (t) => `Surprise challenge lurking in ${t}.`,
  };

  return Array.from({ length: TOTAL_NODES }, (_, i) => {
    const worldId = i < 10 ? 0 : i < 20 ? 1 : 2;
    const type = typePattern[i];
    const ch = picked[i];
    const difficulty =
      type === "boss" ? "Boss"
        : type === "quiz" ? (i % 3 === 0 ? "Hard" : "Medium")
        : i < 10 ? "Easy"
        : i < 20 ? "Medium"
        : "Hard";
    const xp = type === "boss" ? 100 : type === "treasure" ? 30 : type === "checkpoint" ? 40 : XP_PER_NODE;
    const coins = type === "boss" ? 50 : type === "treasure" ? 40 : type === "checkpoint" ? 20 : 10;
    return {
      id: `lv-node-${i}`,
      index: i,
      worldId,
      type,
      title: ch.title,
      subject: ch.subject,
      difficulty,
      xp,
      coins,
      description: descMap[type](ch.title),
    };
  });
}

// ===== Helpers =====
function getNodeState(node: LevelNode, currentIdx: number): NodeState {
  if (node.index < currentIdx) {
    if (node.type === "treasure" || node.type === "boss" || node.index % 5 === 4) {
      return "perfect";
    }
    return "completed";
  }
  if (node.index === currentIdx) return "current";
  return "locked";
}

// Build SVG path d-attribute for a list of node coordinates
function buildPathD(coords: { x: number; y: number }[], fromIdx?: number, toIdx?: number): string {
  if (coords.length === 0) return "";
  const start = fromIdx ?? 0;
  const end = toIdx ?? coords.length - 1;
  if (start >= coords.length || end >= coords.length || start > end) return "";
  let d = `M ${coords[start].x},${coords[start].y}`;
  for (let i = start + 1; i <= end; i++) {
    const prev = coords[i - 1];
    const cur = coords[i];
    const midY = (prev.y + cur.y) / 2;
    d += ` C ${prev.x},${midY} ${cur.x},${midY} ${cur.x},${cur.y}`;
  }
  return d;
}

// ===== Sub-components =====

function AuroraBackground() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-32 -left-32 w-[40rem] h-[40rem] rounded-full bg-purple-600/15 blur-[140px] animate-pulse" style={{ animationDuration: "8s" }} />
      <div className="absolute top-1/3 -right-32 w-[35rem] h-[35rem] rounded-full bg-indigo-600/15 blur-[140px] animate-pulse" style={{ animationDuration: "10s", animationDelay: "1s" }} />
      <div className="absolute bottom-0 left-1/3 w-[30rem] h-[30rem] rounded-full bg-teal-500/10 blur-[140px] animate-pulse" style={{ animationDuration: "12s", animationDelay: "2s" }} />
      <div className="absolute top-2/3 left-0 w-[25rem] h-[25rem] rounded-full bg-fuchsia-600/10 blur-[120px] animate-pulse" style={{ animationDuration: "9s", animationDelay: "3s" }} />
      {/* Subtle grain */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='1'/></svg>\")",
        }}
      />
    </div>
  );
}

function StatPill({
  icon: Icon, label, value, accent,
}: { icon: LucideIcon; label: string; value: string; accent: string }) {
  return (
    <div className="lv-glass rounded-2xl px-4 py-3 flex items-center gap-3 min-w-0 flex-1">
      <div
        className="grid place-items-center h-9 w-9 rounded-xl shrink-0"
        style={{ background: `${accent}1f`, color: accent }}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-white/50 leading-none mb-1">{label}</p>
        <p className="text-sm font-semibold text-white truncate">{value}</p>
      </div>
    </div>
  );
}

function NodeCard({
  node, state, onClick, registerRef,
}: {
  node: LevelNode;
  state: NodeState;
  onClick: (e: React.MouseEvent) => void;
  registerRef?: (el: HTMLDivElement | null) => void;
}) {
  const meta = NODE_TYPES[node.type];
  const Icon = meta.LucideIcon;
  const isLocked = state === "locked";
  const isCurrent = state === "current";
  const isCompleted = state === "completed";
  const isPerfect = state === "perfect";

  return (
    <div className="relative scroll-mt-24" ref={registerRef} tabIndex={-1}>
      {/* Pulsing ring for current node */}
      {isCurrent && (
        <motion.div
          className="absolute -inset-2 rounded-3xl pointer-events-none"
          style={{ boxShadow: `0 0 0 2px rgba(${meta.glow},0.6), 0 0 30px rgba(${meta.glow},0.4)` }}
          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <motion.button
        onClick={onClick}
        disabled={isLocked}
        whileHover={!isLocked ? { y: -3, scale: 1.02 } : {}}
        whileTap={!isLocked ? { scale: 0.98 } : {}}
        className={`
          lv-glass relative rounded-3xl p-4 w-[16rem] sm:w-[18rem] text-left
          transition-colors duration-300
          ${isLocked ? "opacity-40 grayscale cursor-not-allowed" : "cursor-pointer"}
          ${isPerfect ? "ring-2 ring-amber-400/70" : ""}
        `}
        style={
          !isLocked
            ? { boxShadow: `0 4px 30px rgba(${meta.glow},0.18), inset 0 1px 1px rgba(255,255,255,0.1)` }
            : undefined
        }
      >
        {/* Type chip + state badge row */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: `${meta.color}1f`, color: meta.color }}
          >
            <span className="text-xs leading-none">{meta.icon}</span>
            {meta.label}
          </span>
          {isLocked && <Lock className="h-4 w-4 text-white/40" />}
          {isCompleted && (
            <div className="grid place-items-center h-6 w-6 rounded-full bg-emerald-500/90 shadow-lg">
              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
            </div>
          )}
          {isPerfect && (
            <div className="grid place-items-center h-6 w-6 rounded-full bg-amber-400 shadow-lg">
              <Star className="h-3.5 w-3.5 text-amber-900 fill-amber-900" strokeWidth={2} />
            </div>
          )}
          {isCurrent && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse"
              style={{ background: meta.color, color: "#fff" }}
            >
              Start
            </span>
          )}
        </div>

        {/* Icon + title */}
        <div className="flex items-start gap-3">
          <div
            className="grid place-items-center h-11 w-11 rounded-2xl shrink-0"
            style={{
              background: `linear-gradient(135deg, rgba(${meta.glow},0.3), rgba(${meta.glow},0.1))`,
              color: meta.color,
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-white leading-snug line-clamp-2">{node.title}</h4>
            <p className="text-[11px] text-white/50 mt-0.5 truncate">{node.subject} · {node.difficulty}</p>
          </div>
        </div>

        {/* Rewards footer */}
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] text-white/70">
            <Zap className="h-3 w-3 text-amber-400" />
            +{node.xp} XP
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-white/70">
            <Coins className="h-3 w-3 text-amber-400" />
            +{node.coins}
          </span>
        </div>
      </motion.button>
    </div>
  );
}

function WorldBanner({ world, completed }: { world: World; completed: number }) {
  const pct = Math.round((completed / 10) * 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className="lv-glass rounded-3xl p-5 sm:p-6 mb-10 mt-8 first:mt-0"
      style={{ boxShadow: `0 4px 40px rgba(${world.glow},0.15)` }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="grid place-items-center h-14 w-14 rounded-2xl shrink-0 text-3xl"
            style={{
              background: `linear-gradient(135deg, rgba(${world.glow},0.3), rgba(${world.glow},0.05))`,
              boxShadow: `inset 0 0 0 1px rgba(${world.glow},0.4)`,
            }}
          >
            {world.emoji}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: world.color }}>
                World {world.id + 1}
              </p>
              <span className="text-white/30 text-xs">·</span>
              <p className="text-[10px] text-white/50">{completed}/10 complete</p>
            </div>
            <h3 className="lv-serif text-2xl sm:text-3xl text-white leading-tight italic">{world.name}</h3>
            <p className="text-xs text-white/50 mt-0.5 hidden sm:block">{world.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 min-w-[8rem]">
          <div className="flex-1 min-w-[6rem]">
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${world.color}, ${world.color2})` }}
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>
          <span className="text-sm font-semibold tabular-nums" style={{ color: world.color }}>{pct}%</span>
        </div>
      </div>
    </motion.div>
  );
}

function WorldSection({
  world, nodes, currentGlobalIdx, getNodeState, onNodeClick, registerNodeRef,
}: {
  world: World;
  nodes: LevelNode[];
  currentGlobalIdx: number;
  getNodeState: (n: LevelNode) => NodeState;
  onNodeClick: (n: LevelNode) => void;
  registerNodeRef: (idx: number, el: HTMLDivElement | null) => void;
}) {
  const N = nodes.length;

  // Compute coordinates in viewBox 0..100 space
  const coords = useMemo(
    () => nodes.map((_, i) => ({
      x: i % 2 === 0 ? 22 : 78,
      y: ((i + 0.5) / N) * 100,
    })),
    [nodes, N]
  );

  // Determine unlocked range within this world (global indices)
  const worldStart = world.startIdx;
  const worldEnd = worldStart + N - 1;
  // Last unlocked index in this world (global)
  const lastUnlockedGlobal = Math.min(currentGlobalIdx, worldEnd);
  const hasUnlockedInWorld = currentGlobalIdx >= worldStart;
  // Convert to local index
  const unlockedEndLocal = hasUnlockedInWorld ? lastUnlockedGlobal - worldStart : -1;

  const fullD = buildPathD(coords, 0, N - 1);
  const unlockedD = unlockedEndLocal >= 1 ? buildPathD(coords, 0, unlockedEndLocal) : "";
  const completedCount = nodes.filter((n) => {
    const s = getNodeState(n);
    return s === "completed" || s === "perfect";
  }).length;

  const gradId = `lv-grad-${world.id}`;
  const glowId = `lv-glow-${world.id}`;

  return (
    <section className="relative">
      <WorldBanner world={world} completed={completedCount} />

      <div className="relative max-w-2xl mx-auto px-2 sm:px-4">
        {/* SVG path overlay */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={world.color} stopOpacity="0.9" />
              <stop offset="100%" stopColor={world.color2} stopOpacity="0.9" />
            </linearGradient>
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Dim full path */}
          {fullD && (
            <path
              d={fullD}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="2"
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {/* Bright unlocked path */}
          {unlockedD && (
            <path
              d={unlockedD}
              stroke={`url(#${gradId})`}
              strokeWidth="2.5"
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#${glowId})`}
            />
          )}
        </svg>

        {/* Nodes */}
        <div className="relative space-y-10 sm:space-y-14 pb-4 pt-2">
          {nodes.map((node, i) => {
            const state = getNodeState(node);
            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: (i % 5) * 0.05 }}
                className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
              >
                <NodeCard
                  node={node}
                  state={state}
                  onClick={() => onNodeClick(node)}
                  registerRef={(el) => registerNodeRef(node.index, el)}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BottomBar({ onContinue }: { onContinue: () => void }) {
  const buttons: { icon: LucideIcon; label: string; onClick: () => void; color: string }[] = [
    { icon: Play, label: "Continue", onClick: onContinue, color: "#10b981" },
    { icon: Bot, label: "AI Tutor", onClick: () => navigateTo("ai-tutor"), color: "#8b5cf6" },
    { icon: Search, label: "Search", onClick: () => navigateTo("resources"), color: "#3b82f6" },
    { icon: NotebookPen, label: "Notes", onClick: () => navigateTo("notes"), color: "#f59e0b" },
    { icon: Timer, label: "Timer", onClick: () => navigateTo("focus"), color: "#6366f1" },
    { icon: Zap, label: "Flashcards", onClick: () => navigateTo("flashcards"), color: "#eab308" },
  ];
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-2 w-full max-w-md">
      <div className="lv-glass-strong rounded-full px-2 py-2 flex items-center justify-around gap-1 shadow-2xl">
        {buttons.map((b) => {
          const Icon = b.icon;
          return (
            <motion.button
              key={b.label}
              onClick={b.onClick}
              whileHover={{ y: -3, scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="group relative grid place-items-center h-11 w-11 rounded-full transition-colors"
              style={{ background: `${b.color}1a` }}
              aria-label={b.label}
            >
              <Icon className="h-4.5 w-4.5" style={{ color: b.color }} />
              <span
                className="absolute -top-9 px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: "rgba(20,20,20,0.95)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {b.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function FloatingReward({ data }: { data: { x: number; y: number; xp: number; coins: number } }) {
  return (
    <motion.div
      className="fixed z-50 pointer-events-none flex flex-col items-center"
      style={{ left: data.x, top: data.y, transform: "translate(-50%, -100%)" }}
      initial={{ opacity: 0, y: 0, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], y: -80, scale: [0.6, 1.1, 1, 0.9] }}
      transition={{ duration: 1.8, ease: "easeOut", times: [0, 0.2, 0.7, 1] }}
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/90 text-white text-sm font-bold shadow-lg shadow-amber-500/40">
        <Zap className="h-3.5 w-3.5" />
        +{data.xp} XP
      </div>
      <div className="flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full bg-yellow-500/90 text-white text-xs font-semibold shadow-lg">
        <Coins className="h-3 w-3" />
        +{data.coins}
      </div>
    </motion.div>
  );
}

function Confetti({ particles }: { particles: { id: number; x: number; y: number; color: string }[] }) {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <AnimatePresence>
        {particles.map((p) => {
          const angle = (p.id * 137.5) % 360;
          const dist = 200 + (p.id % 5) * 40;
          const dx = Math.cos((angle * Math.PI) / 180) * dist;
          const dy = Math.sin((angle * Math.PI) / 180) * dist;
          return (
            <motion.div
              key={p.id}
              className="absolute w-2 h-2 rounded-sm"
              style={{ left: p.x, top: p.y, background: p.color }}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
              animate={{ opacity: 0, x: dx, y: dy + 200, scale: 0.4, rotate: 720 }}
              transition={{ duration: 2, ease: "easeOut" }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ===== Lesson Modal — real lesson flow with checkpoints before XP is awarded =====
interface LessonCompletionRecord {
  lessonId: string;
  startedAt: number;
  completedAt: number;
  xpAwarded: number;
  score: number;
}

function loadLessonCompletions(scholarClass: 9 | 11): Record<string, LessonCompletionRecord> {
  try {
    return profileGetJSON<Record<string, LessonCompletionRecord>>(scholarClass, "levels-lesson-completions", {});
  } catch {
    return {};
  }
}

function saveLessonCompletion(scholarClass: 9 | 11, rec: LessonCompletionRecord) {
  try {
    const all = loadLessonCompletions(scholarClass);
    all[rec.lessonId] = rec;
    profileSetJSON(scholarClass, "levels-lesson-completions", all);
  } catch { /* ignore */ }
}

function LessonModal({
  node, scholarClass, onClose, onComplete,
}: {
  node: LevelNode;
  scholarClass: 9 | 11;
  onClose: () => void;
  onComplete: (score: number) => void;
}) {
  const meta = NODE_TYPES[node.type];
  const [stage, setStage] = useState<"loading" | "lesson" | "checkpoint" | "done" | "fallback_prompt">("loading");
  const [lessonContent, setLessonContent] = useState<string>("");
  const [checkpointQ, setCheckpointQ] = useState<{ question: string; options: string[]; answerIndex: number; explanation: string } | null>(null);
  const [pickedAnswer, setPickedAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [generationAttempt, setGenerationAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const lessonPrompt = `You are a CBSE Class ${scholarClass} teacher giving a focused micro-lesson on "${node.title}" (subject: ${node.subject}). Structure the lesson in markdown with:
- A "## Learning Objectives" section (3 bullet points)
- A "## Core Concept" section (2-3 paragraphs, ~200 words total)
- A "## Key Formula / Definition" section with the most important formula or definition
- A "## Worked Example" section with one fully solved example
- A "## Common Mistake" section (1-2 sentences)
- A "## Exam Tip" section (1 sentence)
Keep it tight and high-yield. Use markdown headings. Do NOT include any preamble.`;

        let acc = "";
        await askAIStream(lessonPrompt, "default", {
          timeoutMs: 180_000,
          mode: "lesson",
          signal: controller.signal,
          onDelta: (_chunk, full) => {
            if (cancelled) return;
            acc = full;
            setLessonContent(full);
            setStage("lesson");
          },
        });
        if (cancelled) return;
        if (!acc.trim()) {
          setError("Lesson content couldn't be generated. Please try again.");
          setStage("lesson");
          return;
        }

        const cpPrompt = `Generate ONE multiple-choice checkpoint question for a CBSE Class ${scholarClass} student who just finished a micro-lesson on "${node.title}" (${node.subject}). The question should test the core concept, not trivia. Use four options and a zero-based numeric correctAnswer.`;
        const cp = await askAIJSON<{ question: string; options: string[]; correctAnswer: number | string; explanation: string }>(
          cpPrompt, "default", { timeoutMs: 90_000, mode: "checkpoint", signal: controller.signal }
        );
        if (cancelled) return;
        if (cp?.question && Array.isArray(cp.options) && cp.options.length === 4) {
          const answerIndex = typeof cp.correctAnswer === "number"
            ? cp.correctAnswer
            : cp.options.findIndex((option) => option === cp.correctAnswer);
          setCheckpointQ({
            question: String(cp.question), options: cp.options.map(String),
            answerIndex: Math.max(0, Math.min(3, answerIndex < 0 ? 0 : answerIndex)),
            explanation: String(cp.explanation ?? ""),
          });
        } else {
          setError("Checkpoint question couldn't be generated. You can still complete the lesson.");
        }
        setStage("lesson");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load lesson.";
        setError(msg);
        setStage("fallback_prompt");
      }
    })();

    return () => { cancelled = true; controller.abort(); };
  }, [node.id, node.title, node.subject, scholarClass, generationAttempt]);

  const handleSubmit = () => {
    if (!checkpointQ) { setStage("done"); onComplete(70); return; }
    if (pickedAnswer === null) return;
    setSubmitting(true);
    const score = pickedAnswer === checkpointQ.answerIndex ? 100 : 0;
    setTimeout(() => { setStage("done"); setSubmitting(false); onComplete(score); }, 600);
  };

  const isCorrect = checkpointQ && pickedAnswer === checkpointQ.answerIndex;

  // Local fallback lesson — used when AI is unavailable
  const loadLocalFallback = () => {
    const content = `## Learning Objectives
- Understand the key concepts of ${node.title}
- Apply the fundamental formulas
- Solve basic problems independently

## Core Concept
${node.title} is an important topic in ${node.subject}. This lesson covers the essential principles you need to understand for your CBSE Class ${scholarClass} examination. The concepts build on prior knowledge and form the foundation for more advanced topics.

Study the definitions carefully and work through the examples. Pay attention to units and sign conventions, as these are common sources of errors in exams.

## Key Formula / Definition
Review your textbook for the key formulas related to ${node.title}. Make sure you can state each formula, identify the variables, and specify the SI units.

## Worked Example
A typical problem: Given the basic parameters, apply the formula step by step. First identify what is given, then choose the correct formula, substitute values with units, and compute the answer.

## Common Mistake
Students often forget to check units or confuse similar-looking formulas. Always verify your final answer has the correct units and a reasonable magnitude.

## Exam Tip
Practice 5-10 problems from your NCERT textbook to reinforce the concepts covered in this lesson.`;

    setLessonContent(content);
    setCheckpointQ({
      question: `Which of the following best describes the key concept of "${node.title}"?`,
      options: [
        "A fundamental principle that requires understanding of definitions and formulas",
        "An advanced topic only relevant to competitive exams",
        "A purely theoretical concept with no practical application",
        "A topic that can be memorized without understanding",
      ],
      answerIndex: 0,
      explanation: `The key concept of ${node.title} requires understanding definitions, formulas, and their applications. This is foundational knowledge for CBSE Class ${scholarClass}.`,
    });
    setError(null);
    setUseFallback(true);
    setStage("lesson");
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="lv-glass-strong lv-font text-white border-white/10 max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="relative p-5 pb-4 shrink-0 border-b border-white/10"
          style={{ background: `linear-gradient(135deg, rgba(${meta.glow},0.22), rgba(${meta.glow},0.04))` }}>
          <button onClick={onClose} aria-label="Close"
            className="absolute top-4 right-4 grid place-items-center h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <X className="h-4 w-4 text-white" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: `${meta.color}33`, color: meta.color }}>
              <span>{meta.icon}</span> {meta.label}
            </span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/70 uppercase tracking-wider font-semibold">
              {node.difficulty}
            </span>
          </div>
          <DialogTitle className="lv-serif text-xl text-white italic leading-tight">{node.title}</DialogTitle>
          <p className="text-xs text-white/60 mt-1">{node.subject} · Lesson</p>
        </div>

        <div className="px-5 pt-3 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/50">
            <span className={stage === "loading" || stage === "lesson" ? "text-white" : "text-white/40"}>1. Lesson</span>
            <ChevronRight className="h-3 w-3" />
            <span className={stage === "checkpoint" ? "text-white" : "text-white/40"}>2. Checkpoint</span>
            <ChevronRight className="h-3 w-3" />
            <span className={stage === "done" ? "text-emerald-400" : "text-white/40"}>3. Complete</span>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {stage === "loading" && (
            <div className="flex items-center gap-3 text-white/70 py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Preparing your lesson…</span>
            </div>
          )}

          {stage === "fallback_prompt" && (
            <div className="py-8 text-center">
              <div className="grid place-items-center h-16 w-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 mb-4 mx-auto">
                <AlertTriangle className="h-8 w-8 text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-white mb-2">AI lesson generation is unavailable.</p>
              <p className="text-xs text-white/60 mb-4 max-w-sm mx-auto">{error || "The AI service could not be reached."}</p>
              <p className="text-sm text-white/80 mb-5">Continue with Scholar's local lesson?</p>
              <div className="flex gap-2 justify-center">
                <button onClick={loadLocalFallback} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600">
                  Use Local Lesson
                </button>
                <button onClick={() => { setUseFallback(false); setLessonContent(""); setCheckpointQ(null); setError(null); setStage("loading"); setGenerationAttempt((attempt) => attempt + 1); }} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white/70 border border-white/20 hover:bg-white/5">
                  Retry AI
                </button>
                <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white/80">
                  Exit
                </button>
              </div>
            </div>
          )}

          {(stage === "lesson" || stage === "checkpoint") && (
            <>
              {error && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">{error}</div>
              )}
              {lessonContent && (
                <div className="lv-glass rounded-2xl p-4 mb-4 max-h-[40vh] overflow-y-auto">
                  {useFallback && <p className="mb-3 text-[10px] uppercase tracking-wider text-amber-300">Local fallback lesson</p>}
                  <Markdown content={lessonContent} />
                </div>
              )}
              {checkpointQ && stage === "checkpoint" && (
                <div className="lv-glass rounded-2xl p-4">
                  <p className="text-sm font-semibold text-white mb-3">Checkpoint Question</p>
                  <p className="text-sm text-white/80 mb-3">{checkpointQ.question}</p>
                  <div className="space-y-2">
                    {checkpointQ.options.map((opt, i) => {
                      const isPicked = pickedAnswer === i;
                      const isAnswer = checkpointQ.answerIndex === i;
                      let cls = "border-white/15 bg-white/5 hover:bg-white/10";
                      if (checked) {
                        if (isAnswer) cls = "border-emerald-500/50 bg-emerald-500/15";
                        else if (isPicked) cls = "border-red-500/50 bg-red-500/15";
                        else cls = "border-white/10 bg-white/[0.02] opacity-60";
                      } else if (isPicked) cls = "border-white/40 bg-white/15";
                      return (
                        <button key={i} type="button" disabled={checked}
                          onClick={() => setPickedAnswer(i)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${cls}`}>
                          <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                          {checked && isAnswer && <Check className="inline-block ml-2 h-3.5 w-3.5 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                  {checked && (
                    <div className={`mt-3 rounded-xl p-3 text-xs ${isCorrect ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"}`}>
                      <p className="font-semibold mb-1">{isCorrect ? "✓ Correct!" : "✗ Not quite."}</p>
                      {checkpointQ.explanation && <p className="text-white/80">{checkpointQ.explanation}</p>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {stage === "done" && (
            <div className="text-center py-8">
              <div className="inline-grid place-items-center h-16 w-16 rounded-full bg-emerald-500/20 mb-4">
                <Check className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="text-lg font-bold text-white mb-1">Lesson Complete!</p>
              <p className="text-sm text-white/60">
                {isCorrect ? "You nailed the checkpoint." : "Lesson recorded. Review the explanation above."}
              </p>
              <p className="text-xs text-amber-300 mt-3 font-semibold">+{node.xp} XP · +{node.coins} coins</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 shrink-0 flex items-center gap-2 bg-black/30">
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors">
            Exit
          </button>
          <div className="flex-1" />
          {stage === "lesson" && checkpointQ && (
            <button onClick={() => setStage("checkpoint")}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}>
              Continue to Checkpoint <ChevronRight className="inline-block ml-1 h-4 w-4" />
            </button>
          )}
          {stage === "checkpoint" && !checked && (
            <button onClick={() => setChecked(true)} disabled={pickedAnswer === null}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}>
              Check Answer
            </button>
          )}
          {stage === "checkpoint" && checked && (
            <button onClick={handleSubmit} disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit & Claim XP"}
            </button>
          )}
          {stage === "done" && (
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}>
              Done
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NodeDialog({
  node, state, onClose, onStart, scholarClass,
}: {
  node: LevelNode | null;
  state: NodeState;
  onClose: () => void;
  onStart: (node: LevelNode, e: React.MouseEvent) => void;
  scholarClass: 9 | 11;
}) {
  const [aiInfo, setAiInfo] = useState<{ time: string; prob: string; recommended: string } | null>(null);
  const [aiInfoLoading, setAiInfoLoading] = useState(false);
  const [aiExplain, setAiExplain] = useState<string | null>(null);
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  // Fetch AI info when node changes (effect body only fires async, no setState sync)
  useEffect(() => {
    if (!node) {
      setAiInfo(null);
      setAiExplain(null);
      setShowExplain(false);
      return;
    }
    setAiInfo(null);
    setAiExplain(null);
    setShowExplain(false);
    let cancelled = false;
    (async () => {
      setAiInfoLoading(true);
      try {
        const result = await askAIJSON<{
          estimated_time?: string;
          success_probability?: string;
          recommended?: string;
        }>(
          `You are an academic advisor for a Class ${scholarClass} student. They are about to study "${node.title}" from ${node.subject}. This is a ${NODE_TYPES[node.type].label} activity with ${node.difficulty} difficulty. Estimate: 1) how long it would take (e.g., "20 min"), 2) the probability of completing it successfully given an average Class ${scholarClass} student (e.g., "82%"), 3) a one-sentence recommendation. Respond as JSON: {"estimated_time": "...", "success_probability": "...", "recommended": "..."}`,
          "default"
        );
        if (!cancelled && result) {
          setAiInfo({
            time: result.estimated_time || "20 min",
            prob: result.success_probability || "85%",
            recommended: result.recommended || "You've got this — go for it!",
          });
        }
      } catch {
        if (!cancelled) {
          setAiInfo({ time: "20 min", prob: "85%", recommended: "Trust your prep — go for it!" });
        }
      } finally {
        if (!cancelled) setAiInfoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [node]);

  if (!node) return null;
  const meta = NODE_TYPES[node.type];
  const Icon = meta.LucideIcon;
  const world = WORLDS[node.worldId];
  const isLocked = state === "locked";

  async function handleExplain() {
    if (!node) return;
    setShowExplain(true);
    if (aiExplain) return;
    setAiExplainLoading(true);
    try {
      const response = await askAI(
        `Explain the Class ${scholarClass} topic "${node.title}" from ${node.subject} for a student about to study it. Use markdown. Cover: what it is, why it matters, key concepts to focus on, common pitfalls, and a 1-line summary at the end.`,
        "default"
      );
      setAiExplain(response);
    } catch {
      toast.error("Couldn't fetch AI explanation. Try again.");
      setShowExplain(false);
    } finally {
      setAiExplainLoading(false);
    }
  }

  return (
    <Dialog open={!!node} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="lv-glass-strong lv-font text-white border-white/10 max-w-lg p-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div
          className="relative p-6 pb-5 shrink-0"
          style={{
            background: `linear-gradient(135deg, rgba(${meta.glow},0.25), rgba(${meta.glow},0.05))`,
            borderBottom: `1px solid rgba(${meta.glow},0.3)`,
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 grid place-items-center h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-white" />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: `${meta.color}33`, color: meta.color }}
            >
              <span>{meta.icon}</span>
              {meta.label}
            </span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/70 uppercase tracking-wider font-semibold">
              {node.difficulty}
            </span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/70 uppercase tracking-wider font-semibold">
              {world.emoji} {world.name}
            </span>
          </div>
          <div className="flex items-start gap-3">
            <div
              className="grid place-items-center h-12 w-12 rounded-2xl shrink-0"
              style={{ background: `linear-gradient(135deg, rgba(${meta.glow},0.4), rgba(${meta.glow},0.1))`, color: meta.color }}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="lv-serif text-2xl text-white italic leading-tight">
                {node.title}
              </DialogTitle>
              <p className="text-xs text-white/60 mt-1">{node.subject} · Node {node.index + 1} of {TOTAL_NODES}</p>
            </div>
          </div>
          <p className="text-sm text-white/70 mt-4 leading-relaxed">{node.description}</p>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Reward chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold">
              <Zap className="h-3.5 w-3.5" /> +{node.xp} XP
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/15 text-yellow-300 text-xs font-semibold">
              <Coins className="h-3.5 w-3.5" /> +{node.coins} coins
            </span>
            {node.type === "treasure" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-xs font-semibold">
                <Crown className="h-3.5 w-3.5" /> Bonus badge
              </span>
            )}
            {node.type === "boss" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/15 text-red-300 text-xs font-semibold">
                <Trophy className="h-3.5 w-3.5" /> World clears
              </span>
            )}
          </div>

          {/* AI info panel */}
          <div className="lv-glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="grid place-items-center h-6 w-6 rounded-lg bg-violet-500/20">
                <Sparkles className="h-3.5 w-3.5 text-violet-300" />
              </div>
              <p className="text-xs font-semibold text-white uppercase tracking-wider">AI Forecast</p>
            </div>
            {aiInfoLoading ? (
              <div className="flex items-center gap-2 text-white/60 text-sm py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing this level...
              </div>
            ) : aiInfo ? (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 rounded-xl bg-white/5">
                  <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Est. time</p>
                  <p className="text-sm font-bold text-white">{aiInfo.time}</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-white/5">
                  <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Success</p>
                  <p className="text-sm font-bold" style={{ color: meta.color }}>{aiInfo.prob}</p>
                </div>
                <div className="text-center p-2 rounded-xl bg-white/5">
                  <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Difficulty</p>
                  <p className="text-sm font-bold text-white">{node.difficulty}</p>
                </div>
              </div>
            ) : null}
            {aiInfo && (
              <p className="text-xs text-white/70 italic leading-relaxed">"{aiInfo.recommended}"</p>
            )}
          </div>

          {/* AI Explain */}
          <div className="lv-glass rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="grid place-items-center h-6 w-6 rounded-lg bg-indigo-500/20">
                  <Bot className="h-3.5 w-3.5 text-indigo-300" />
                </div>
                <p className="text-xs font-semibold text-white uppercase tracking-wider">AI Explain</p>
              </div>
              {!showExplain && (
                <button
                  onClick={handleExplain}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  Explain this topic
                </button>
              )}
            </div>
            {showExplain && (
              aiExplainLoading ? (
                <div className="flex items-center gap-2 text-white/60 text-sm py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating explanation...
                </div>
              ) : aiExplain ? (
                <div className="text-sm text-white/80 max-h-56 overflow-y-auto lv-scroll pr-1">
                  <Markdown content={aiExplain} />
                </div>
              ) : null
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/10 shrink-0 flex items-center gap-3 bg-black/30">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <motion.button
            onClick={(e) => onStart(node, e)}
            disabled={isLocked}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
              boxShadow: `0 4px 20px rgba(${meta.glow},0.4)`,
            }}
          >
            <Play className="h-4 w-4 fill-white" />
            Start {meta.label}
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== Main view =====
export function LevelsView() {
  const CURRICULUM = useCurriculum();
  const scholarClass = useStore((s) => s.user.scholarClass);
  const { appName } = useUserName();
  const allNodes = useMemo(() => generateNodes(CURRICULUM), [CURRICULUM]);
  const xp = useStore((s) => s.xp);
  const coins = useStore((s) => s.coins);
  const streak = useStore((s) => s.streak);
  const mastery = useStore((s) => s.mastery);
  const addXP = useStore((s) => s.addXP);
  const addCoins = useStore((s) => s.addCoins);
  const pushActivity = useStore((s) => s.pushActivity);

  const levelInfo = getLevelInfo(xp);
  const currentGlobalIdx = Math.min(Math.floor(xp / XP_PER_NODE), TOTAL_NODES - 1);
  const currentWorld = currentGlobalIdx < 10 ? WORLDS[0] : currentGlobalIdx < 20 ? WORLDS[1] : WORLDS[2];
  const masteryAvg = useMemo(() => {
    const vals = Object.values(mastery ?? {});
    if (vals.length === 0) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [mastery]);

  const [selectedNode, setSelectedNode] = useState<LevelNode | null>(null);
  const [lessonNode, setLessonNode] = useState<LevelNode | null>(null);
  const [floatingReward, setFloatingReward] = useState<{ x: number; y: number; xp: number; coins: number } | null>(null);
  const [confetti, setConfetti] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [lessonCompletions, setLessonCompletions] = useState<Record<string, LessonCompletionRecord>>(() => loadLessonCompletions(scholarClass));

  useEffect(() => {
    setLessonCompletions(loadLessonCompletions(scholarClass));
  }, [scholarClass]);

  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  function getNodeState(node: LevelNode): NodeState {
    return getNodeStateGlobal(node, currentGlobalIdx);
  }
  function getNodeStateGlobal(node: LevelNode, idx: number): NodeState {
    if (node.index < idx) {
      if (node.type === "treasure" || node.type === "boss" || node.index % 5 === 4) {
        return "perfect";
      }
      return "completed";
    }
    if (node.index === idx) return "current";
    return "locked";
  }

  function handleNodeClick(node: LevelNode) {
    const state = getNodeState(node);
    if (state === "locked") {
      toast.error("This level is locked.", {
        description: "Complete earlier levels to unlock it.",
      });
      return;
    }
    setSelectedNode(node);
  }

  function handleStart(node: LevelNode, _e: React.MouseEvent) {
    // Close the info dialog and open the real lesson modal.
    // XP is only awarded by `handleLessonComplete` after the user finishes
    // the lesson + checkpoint — NEVER here on click.
    setSelectedNode(null);

    const lessonId = `${scholarClass}-${node.index}`;
    if (lessonCompletions[lessonId]) {
      toast.info("Already completed", {
        description: `${node.title} — XP already awarded on ${new Date(lessonCompletions[lessonId].completedAt).toLocaleDateString()}.`,
      });
    }
    const target = nodeRefs.current[node.index];
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setLessonNode(node), target ? 260 : 0);
  }

  function handleLessonComplete(score: number) {
    if (!lessonNode) return;
    const node = lessonNode;
    const lessonId = `${scholarClass}-${node.index}`;

    if (lessonCompletions[lessonId]) {
      toast.info("Lesson already completed — no extra XP.");
      setLessonNode(null);
      return;
    }

    const rec: LessonCompletionRecord = {
      lessonId, startedAt: Date.now(), completedAt: Date.now(),
      xpAwarded: node.xp, score,
    };
    saveLessonCompletion(scholarClass, rec);
    setLessonCompletions((prev) => ({ ...prev, [lessonId]: rec }));

    setFloatingReward({
      x: (typeof window !== "undefined" ? window.innerWidth : 800) / 2,
      y: (typeof window !== "undefined" ? window.innerHeight : 600) / 2,
      xp: node.xp, coins: node.coins,
    });
    setTimeout(() => setFloatingReward(null), 2000);

    addXP(node.xp);
    addCoins(node.coins);
    pushActivity({
      type: node.type,
      text: `Completed ${NODE_TYPES[node.type].label}: ${node.title}`,
      icon: NODE_TYPES[node.type].icon,
    });

    toast.success(`+${node.xp} XP · +${node.coins} coins!`, {
      description: `${NODE_TYPES[node.type].label} — ${node.title}${score === 100 ? " · Perfect!" : ""}`,
    });

    if (node.type === "boss" || node.type === "treasure" || node.type === "checkpoint") {
      const colors = ["#f59e0b", "#10b981", "#6366f1", "#f43f5e", "#a855f7", "#14b8a6"];
      const w = typeof window !== "undefined" ? window.innerWidth : 800;
      const h = typeof window !== "undefined" ? window.innerHeight : 600;
      const particles = Array.from({ length: 28 }, (_, i) => ({
        id: Date.now() + i, x: w / 2, y: h / 2, color: colors[i % colors.length],
      }));
      setConfetti(particles);
      setTimeout(() => setConfetti([]), 2300);

      if (node.type === "boss") {
        toast.success("🏆 World cleared!", { description: `You conquered ${WORLDS[node.worldId].name}.` });
      } else if (node.type === "treasure") {
        toast.success("🎁 Bonus rewards!", { description: "Diamonds + bonus badge unlocked." });
      }
    }

    setLessonNode(null);
  }

  function handleContinue() {
    const el = nodeRefs.current[currentGlobalIdx];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        el.focus({ preventScroll: true });
        const node = allNodes[currentGlobalIdx];
        if (node) handleNodeClick(node);
      }, 700);
    } else {
      // Fallback: just open the dialog
      const node = allNodes[currentGlobalIdx];
      if (node) handleNodeClick(node);
    }
  }

  function registerNodeRef(idx: number, el: HTMLDivElement | null) {
    nodeRefs.current[idx] = el;
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-black overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
        .lv-glass {
          background: rgba(255,255,255,0.01);
          background-blend-mode: luminosity;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: none;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
          position: relative;
          overflow: hidden;
        }
        .lv-glass::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          padding: 1.4px;
          background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .lv-glass-strong {
          background: rgba(20,20,20,0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .lv-font { font-family: 'Inter', sans-serif; }
        .lv-serif { font-family: 'Instrument Serif', serif; }
        .lv-scroll::-webkit-scrollbar { width: 6px; }
        .lv-scroll::-webkit-scrollbar-track { background: transparent; }
        .lv-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        .lv-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}</style>

      <AuroraBackground />

      <div className="relative z-10 flex flex-col min-h-[calc(100vh-4rem)] lv-font">
        {/* Hero */}
        <header className="px-4 sm:px-6 lg:px-10 pt-10 pb-6 max-w-6xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span className="text-[11px] uppercase tracking-widest text-white/50 font-semibold">Learning Path</span>
            </div>
            <h1 className="lv-serif text-5xl sm:text-6xl lg:text-7xl text-white leading-[1.05] tracking-tight">
              Your Learning <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-fuchsia-400 to-teal-300">Journey</span>
            </h1>
            <p className="text-white/60 mt-3 text-sm sm:text-base max-w-xl">
              Progress through an endless adventure of knowledge — 30 levels across 3 worlds, each more challenging than the last.
            </p>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          >
            <StatPill icon={Crown} label="Level" value={`${levelInfo.level}`} accent="#f59e0b" />
            <StatPill icon={Zap} label="XP" value={xp.toLocaleString()} accent="#6366f1" />
            <StatPill icon={Coins} label="Coins" value={coins.toLocaleString()} accent="#eab308" />
            <StatPill icon={Flame} label="Streak" value={`${streak} days`} accent="#f43f5e" />
            <StatPill
              icon={Trophy}
              label="Current World"
              value={`${currentWorld.emoji} ${currentWorld.name}`}
              accent={currentWorld.color}
            />
          </motion.div>

          {/* Secondary stats: mastery + level progress */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-3 lv-glass rounded-2xl p-4 flex items-center gap-4 flex-wrap"
          >
            <div className="flex items-center gap-3 min-w-[12rem] flex-1">
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-indigo-500/20 text-indigo-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-white/50 leading-none mb-1">Level {levelInfo.level} progress</p>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-32 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-teal-400 transition-all"
                      style={{ width: `${(levelInfo.intoLevel / levelInfo.needed) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/70 tabular-nums">{levelInfo.intoLevel}/{levelInfo.needed}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-teal-500/20 text-teal-300">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/50 leading-none mb-1">Avg mastery</p>
                <p className="text-sm font-semibold text-white">{masteryAvg}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-fuchsia-500/20 text-fuchsia-300">
                <Trophy className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/50 leading-none mb-1">Levels done</p>
                <p className="text-sm font-semibold text-white">{Math.min(currentGlobalIdx, TOTAL_NODES)}/{TOTAL_NODES}</p>
              </div>
            </div>
          </motion.div>
        </header>

        {/* World sections */}
        <main className="px-4 sm:px-6 lg:px-10 pb-32 max-w-6xl mx-auto w-full">
          {WORLDS.map((world) => {
            const worldNodes = allNodes.filter((n) => n.worldId === world.id);
            return (
              <WorldSection
                key={world.id}
                world={world}
                nodes={worldNodes}
                currentGlobalIdx={currentGlobalIdx}
                getNodeState={getNodeState}
                onNodeClick={handleNodeClick}
                registerNodeRef={registerNodeRef}
              />
            );
          })}

          {/* Finale */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="lv-glass rounded-3xl p-8 mt-12 text-center"
            style={{ boxShadow: "0 4px 60px rgba(168,85,247,0.2)" }}
          >
            <div className="text-5xl mb-3">🎓</div>
            <h3 className="lv-serif text-3xl text-white italic mb-2">Journey's End</h3>
            <p className="text-white/60 max-w-md mx-auto text-sm">
              {currentGlobalIdx >= TOTAL_NODES - 1
                ? `You've reached the summit. A true ${appName}.`
                : `Only ${TOTAL_NODES - 1 - currentGlobalIdx} levels to go. Keep climbing.`}
            </p>
          </motion.div>
        </main>
      </div>

      {/* Bottom floating bar */}
      <BottomBar onContinue={handleContinue} />

      {/* Dialog */}
      <NodeDialog
        node={selectedNode}
        state={selectedNode ? getNodeState(selectedNode) : "locked"}
        onClose={() => setSelectedNode(null)}
        onStart={handleStart}
        scholarClass={scholarClass}
      />

      {/* Real lesson flow modal — replaces instant XP */}
      {lessonNode && (
        <LessonModal
          node={lessonNode}
          scholarClass={scholarClass}
          onClose={() => setLessonNode(null)}
          onComplete={handleLessonComplete}
        />
      )}

      {/* Floating reward animation */}
      {floatingReward && <FloatingReward data={floatingReward} />}

      {/* Confetti */}
      {confetti.length > 0 && <Confetti particles={confetti} />}
    </div>
  );
}
