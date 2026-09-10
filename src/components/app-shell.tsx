"use client";

import dynamic from "next/dynamic";
import { ScholarFooter } from "@/components/scholar-footer";
import { useState, useEffect, useMemo, useCallback, Component, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, getLevelInfo } from "@/lib/store";
import { NAV_ITEMS, NAV_GROUPS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { migrateLegacyStorage } from "@/lib/profile-storage";
import { FloatingMusicWidget } from "@/components/views/music-widget";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { BackgroundTaskNotifications } from "@/components/background-task-notifications";
import {
  markBackgroundTasksViewed,
  useBackgroundTasks,
} from "@/lib/background-tasks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  GraduationCap, Sparkles, Flame, Coins, Zap, Menu, Search, Command as CmdIcon, Bot, X,
  PanelLeftClose, AlertCircle, Home, BookOpen, ListChecks, Lightbulb, LayoutGrid,
} from "lucide-react";

const DashboardView = dynamic(() => import("@/components/views/dashboard").then((module) => module.DashboardView), { loading: ViewLoading });
const IntelligenceView = dynamic(() => import("@/components/views/intelligence").then((module) => module.IntelligenceView), { loading: ViewLoading });
const ChapterCommandCenter = dynamic(() => import("@/components/views/chapter-command").then((module) => module.ChapterCommandCenter), { loading: ViewLoading });
const AITutorView = dynamic(() => import("@/components/views/ai-tutor").then((module) => module.AITutorView), { loading: ViewLoading });
const AIToolsView = dynamic(() => import("@/components/views/ai-tools").then((module) => module.AIToolsView), { loading: ViewLoading });
const NotesView = dynamic(() => import("@/components/views/notes").then((module) => module.NotesView), { loading: ViewLoading });
const FlashcardsView = dynamic(() => import("@/components/views/flashcards").then((module) => module.FlashcardsView), { loading: ViewLoading });
const QuizView = dynamic(() => import("@/components/views/quiz").then((module) => module.QuizView), { loading: ViewLoading });
const PlannerView = dynamic(() => import("@/components/views/planner").then((module) => module.PlannerView), { loading: ViewLoading });
const FocusView = dynamic(() => import("@/components/views/focus").then((module) => module.FocusView), { loading: ViewLoading });
const ResourcesView = dynamic(() => import("@/components/views/resources").then((module) => module.ResourcesView), { loading: ViewLoading });
import { applyTheme, getEquippedTheme } from "@/lib/themes";
const AnalyticsView = dynamic(() => import("@/components/views/analytics").then((module) => module.AnalyticsView), { loading: ViewLoading });
const AchievementsComingSoon = dynamic(() => import("@/components/views/achievements-coming-soon").then((module) => module.AchievementsComingSoon), { loading: ViewLoading });
const CommunityView = dynamic(() => import("@/components/views/community").then((module) => module.CommunityView), { loading: ViewLoading });
const FilesView = dynamic(() => import("@/components/views/files").then((module) => module.FilesView), { loading: ViewLoading });
const StoreView = dynamic(() => import("@/components/views/store").then((module) => module.StoreView), { loading: ViewLoading });
const ExamPrepView = dynamic(() => import("@/components/views/exam-prep").then((module) => module.ExamPrepView), { loading: ViewLoading });
const MindMapView = dynamic(() => import("@/components/views/mindmap").then((module) => module.MindMapView), { loading: ViewLoading });
const GalaxyView = dynamic(() => import("@/components/views/galaxy").then((module) => module.GalaxyView), { loading: ViewLoading });
const FormulaExplorerView = dynamic(() => import("@/components/views/formulas").then((module) => module.FormulaExplorerView), { loading: ViewLoading });
const StudyView = dynamic(() => import("@/components/views/study").then((module) => module.StudyView), { loading: ViewLoading });
const EBookView = dynamic(() => import("@/components/views/ebook").then((module) => module.EBookView), { loading: ViewLoading });
const PracticeView = dynamic(() => import("@/components/views/practice").then((module) => module.PracticeView), { loading: ViewLoading });
const SettingsView = dynamic(() => import("@/components/views/settings").then((module) => module.SettingsView), { loading: ViewLoading });
const FriendsView = dynamic(() => import("@/components/views/friends").then((module) => module.FriendsView), { loading: ViewLoading });
const NigtubeView = dynamic(() => import("@/components/views/nigtube").then((module) => module.NigtubeView), { loading: ViewLoading });
const LabView = dynamic(() => import("@/components/views/lab").then((module) => module.LabView), { loading: ViewLoading });
const LevelsView = dynamic(() => import("@/components/views/levels").then((module) => module.LevelsView), { loading: ViewLoading });
const PastPapersView = dynamic(() => import("@/components/views/past-papers").then((module) => module.PastPapersView), { loading: ViewLoading });
const AnswerLabView = dynamic(() => import("@/components/views/answer-lab").then((module) => module.AnswerLabView), { loading: ViewLoading });
const RevisionHubView = dynamic(() => import("@/components/views/revision-hub").then((module) => module.RevisionHubView), { loading: ViewLoading });
const MockExamView = dynamic(() => import("@/components/views/mock-exam").then((module) => module.MockExamView), { loading: ViewLoading });
const GoalCenterView = dynamic(() => import("@/components/views/goal-center").then((module) => module.GoalCenterView), { loading: ViewLoading });
const RemindersView = dynamic(() => import("@/components/views/reminders").then((module) => module.RemindersView), { loading: ViewLoading });
const DoubtHistoryView = dynamic(() => import("@/components/views/doubt-history").then((module) => module.DoubtHistoryView), { loading: ViewLoading });
const DownloadsView = dynamic(() => import("@/components/views/downloads").then((module) => module.DownloadsView), { loading: ViewLoading });
const AssignmentsView = dynamic(() => import("@/components/views/assignments").then((module) => module.AssignmentsView), { loading: ViewLoading });
const WorkspaceView = dynamic(() => import("@/components/views/workspace").then((module) => module.WorkspaceView), { loading: ViewLoading });
const MusicView = dynamic(() => import("@/components/views/music").then((module) => module.MusicView), { loading: ViewLoading });
const CanvasView = dynamic(() => import("@/components/views/canvas").then((module) => module.CanvasView), { loading: ViewLoading });
const ToolboxView = dynamic(() => import("@/components/views/toolbox").then((module) => module.ToolboxView), { loading: ViewLoading });
const PracticalsView = dynamic(() => import("@/components/views/practicals").then((module) => module.PracticalsView), { loading: ViewLoading });
const PythonView = dynamic(() => import("@/components/views/python").then((module) => module.PythonView), { loading: ViewLoading });
const DerivationsView = dynamic(() => import("@/components/views/derivations").then((module) => module.DerivationsView), { loading: ViewLoading });
import { LamWidget } from "@/components/lam-widget";
import { ReminderScheduler } from "@/lib/reminders/scheduler";
import { initReminderStoreSync } from "@/lib/reminders/store";
import { useScholarTransition } from "@/components/scholar-transition";
import { useScholarStartupReady } from "@/components/launch-readiness-gate";
const ScholarPlusView = dynamic(() => import("@/components/views/scholar-plus").then((module) => module.ScholarPlusView), { loading: ViewLoading });
const SubscriptionPaymentView = dynamic(() => import("@/components/views/subscription-payment").then((module) => module.SubscriptionPaymentView), { loading: ViewLoading });
import { PlusGate } from "@/components/subscriptions/plus-gate";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import type { ScholarEntitlement } from "@/lib/subscriptions/entitlements";
import { openScholarPlus } from "@/lib/subscriptions/promo";
import { PlusPromotion } from "@/components/subscriptions/plus-promotion";

function ViewLoading() {
  return <div role="status" aria-live="polite" className="min-h-[45vh] space-y-4 p-6"><div className="h-7 w-44 animate-pulse rounded-lg bg-muted" /><div className="h-40 animate-pulse rounded-2xl bg-muted/50" /><p className="text-sm text-muted-foreground">Opening your workspace…</p></div>;
}

const VIEW_COMPONENTS: Record<string, React.ComponentType> = {
  dashboard: DashboardView,
  intelligence: IntelligenceView,
  "chapter-command": ChapterCommandCenter,
  "ai-tutor": AITutorView,
  "ai-tools": AIToolsView,
  notes: NotesView,
  flashcards: FlashcardsView,
  quiz: QuizView,
  planner: PlannerView,
  focus: FocusView,
  resources: ResourcesView,
  analytics: AnalyticsView,
  achievements: AchievementsComingSoon,
  community: CommunityView,
  files: FilesView,
  store: StoreView,
  "exam-prep": ExamPrepView,
  mindmap: MindMapView,
  galaxy: GalaxyView,
  formulas: FormulaExplorerView,
  study: StudyView,
  ebook: EBookView,
  practice: PracticeView,
  settings: SettingsView,
  friends: FriendsView,
  nigtube: NigtubeView,
  lab: LabView,
  levels: LevelsView,
  "past-papers": PastPapersView,
  "answer-lab": AnswerLabView,
  "revision-hub": RevisionHubView,
  "mock-exam": MockExamView,
  "goal-center": GoalCenterView,
  reminders: RemindersView,
  "doubt-history": DoubtHistoryView,
  downloads: DownloadsView,
  assignments: AssignmentsView,
  workspace: WorkspaceView,
  music: MusicView,
  canvas: CanvasView,
  toolbox: ToolboxView,
  practicals: PracticalsView,
  python: PythonView,
  derivations: DerivationsView,
  plus: ScholarPlusView,
  "subscription-payment": SubscriptionPaymentView,
};

const VIEW_ENTITLEMENTS: Record<string, { entitlement: ScholarEntitlement; title: string; description: string }> = {
  levels: { entitlement: "levels", title: "Levels", description: "Unlock Scholar progression, advanced rewards, and full level insights." },
  "exam-prep": { entitlement: "exam_prep", title: "Exam Prep", description: "Build complete exam-focused revision plans and advanced preparation material." },
  assignments: { entitlement: "assignments", title: "Assignments", description: "Create, manage, and improve assignments with Scholar’s advanced workflow." },
  practicals: { entitlement: "practical_lab", title: "Practical Lab", description: "Explore practical procedures, observations, and interactive laboratory guidance." },
  derivations: { entitlement: "derivation_library", title: "Derivation Library", description: "Study complete derivations with guided steps and focused practice." },
  formulas: { entitlement: "formula_explorer", title: "Formula Explorer", description: "Explore formulas visually, understand each symbol, and generate guided practice." },
  python: { entitlement: "python_workspace", title: "Python Workspace", description: "Write, run, and learn Python in browser with an interactive CPython environment and AI code assistance." },
};
const GUEST_RESTRICTED_VIEWS = new Set(["files", "store", "plus", "subscription-payment"]);

function useNavBadges() {
  const flashcards = useStore((s) => s.flashcards);
  const tasks = useStore((s) => s.tasks);
  const dailyChallenge = useStore((s) => s.dailyChallenge);
  const forumPosts = useStore((s) => s.forumPosts);
  const qaItems = useStore((s) => s.qaItems);
  const friendRequests = useStore((s) => s.friendRequests);
  return useMemo(() => {
    try {
      const fc = Array.isArray(flashcards) ? flashcards : [];
      const tk = Array.isArray(tasks) ? tasks : [];
      const fp = Array.isArray(forumPosts) ? forumPosts : [];
      const qa = Array.isArray(qaItems) ? qaItems : [];
      const fr = Array.isArray(friendRequests) ? friendRequests : [];
      const due = fc.filter((c) => c && c.lastReviewed && Date.now() - c.lastReviewed > 86400000 * (c.box ?? 1)).length;
      const dueTasks = tk.filter((t) => t && t.date && !t.done && new Date(t.date) <= new Date(Date.now() + 86400000)).length;
      const communityActivity = fp.length + qa.length;
      const dc = dailyChallenge ? !dailyChallenge.completed : false;
      const pendingReqs = fr.filter((r) => r && r.status === "pending").length;
      return {
        flashcards: due > 0 ? (due > 9 ? "9+" : String(due)) : null,
        planner: dueTasks > 0 ? String(dueTasks) : null,
        quiz: dc ? "•" : null,
        community: communityActivity > 0 ? String(communityActivity) : null,
        friends: pendingReqs > 0 ? String(pendingReqs) : null,
      };
    } catch {
      return {
        flashcards: null,
        planner: null,
        quiz: null,
        community: null,
        friends: null,
      };
    }
  }, [flashcards, tasks, dailyChallenge, forumPosts, qaItems, friendRequests]);
}

const PLUS_SOURCE_BY_NAV: Record<string, "achievements" | "mind-map" | "concept-galaxy"> = {
  achievements: "achievements",
  mindmap: "mind-map",
  galaxy: "concept-galaxy",
};

function NavList({ active, onNavigate, badges }: { active: string; onNavigate: (id: string) => void; badges: ReturnType<typeof useNavBadges> }) {
  const backgroundTasks = useBackgroundTasks();
  const access = useScholarAccess();
  return (
    <nav className="flex flex-col gap-6 px-3 py-2">
      {NAV_GROUPS.map((group) => (
        <div key={group}>
          <p className="scholar-nav-section px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{group}</p>
          <div className="flex flex-col gap-0.5">
            {NAV_ITEMS.filter((n) => n.group === group && (!n.preview || access.developerMode)).map((item) => {
              const isActive = active === item.id;
              const plusLocked = Boolean(VIEW_ENTITLEMENTS[item.id] && !access.has(VIEW_ENTITLEMENTS[item.id].entitlement));
              const badge = (badges as Record<string, string | null>)[item.id];
              const hasFinishedTask = backgroundTasks.some(
                (task) =>
                  task.viewId === item.id &&
                  task.status === "complete" &&
                  !task.read,
              );
              if (item.plus) {
                // Scholar Plus benefit card — opens Scholar Plus rather than the
                // (not yet built) feature itself.
                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      openScholarPlus({
                        source: PLUS_SOURCE_BY_NAV[item.id] ?? "nav",
                        feature: item.id,
                      })
                    }
                    className="group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all relative text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  >
                    <item.icon className="scholar-nav-icon h-4.5 w-4.5 shrink-0 text-amber-200/80" />
                    <span className="scholar-nav-label truncate flex-1 text-left">{item.label}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200/25 bg-gradient-to-r from-amber-300/15 to-violet-400/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-100 shadow-[0_0_10px_rgba(252,211,77,0.14)]">
                      <Sparkles className="h-2 w-2" /> Plus
                    </span>
                  </button>
                );
              }
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    markBackgroundTasksViewed(item.id);
                    onNavigate(item.id);
                  }}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all relative",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    item.highlight && !isActive && "bg-gradient-to-r from-red-500/10 to-fuchsia-500/10 text-white border border-red-500/20",
                    hasFinishedTask &&
                      !isActive &&
                      "border border-cyan-300/25 bg-cyan-300/[0.07] shadow-[inset_0_0_18px_rgba(34,211,238,.08),0_0_14px_rgba(34,211,238,.11)]",
                  )}
                >
                  {isActive && <motion.div layoutId="nav-active" className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-primary" />}
                  <item.icon className={cn("scholar-nav-icon h-4.5 w-4.5 shrink-0", isActive && "text-primary", item.highlight && !isActive && "text-red-400")} />
                  <span className={cn("scholar-nav-label truncate flex-1 text-left", item.highlight && !isActive && "font-bold tracking-wide")}>{item.label}</span>
                  {hasFinishedTask && (
                    <span
                      className="scholar-nav-badge h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_9px_rgba(103,232,249,.9)]"
                      aria-label="Background task finished"
                    />
                  )}
                  {item.badge && !badge && (
                    <span className="scholar-nav-badge text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white animate-pulse">{item.badge}</span>
                  )}
                  {plusLocked && <span className="scholar-nav-badge rounded-full border border-cyan-300/20 bg-cyan-300/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-cyan-200">Plus</span>}
                  {badge && (
                    <span className={cn(
                      "scholar-nav-badge",
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                      badge === "•" ? "bg-orange-500/20 text-orange-400 pulse-ring" : "bg-orange-500 text-white"
                    )}>{badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function TopBar({ onOpenCmd, onOpenMobile, onToggleSidebar, sidebarOpen }: { onOpenCmd: () => void; onOpenMobile: () => void; onToggleSidebar: () => void; sidebarOpen: boolean }) {
  const user = useStore((s) => s.user);
  const guestMode = useStore((s) => s.guestMode);
  const xp = useStore((s) => s.xp);
  const coins = useStore((s) => s.coins);
  const streak = useStore((s) => s.streak);
  const devMode = useStore((s) => s.devMode);
  const li = getLevelInfo(xp);

  return (
    <header className="scholar-mobile-topbar sticky top-0 z-30 h-16 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="h-full flex items-center gap-2 px-3 sm:px-4 lg:px-6">
          <Button id="scholar-mobile-menu" variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobile} aria-label="Open navigation menu" aria-haspopup="dialog">
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden lg:flex" onClick={onToggleSidebar} aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"} title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}>
            <PanelLeftClose className={`h-5 w-5 transition-transform ${sidebarOpen ? "" : "rotate-180"}`} />
          </Button>

          {/* Class badge — small indicator only, switcher is in Settings */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
            style={{
              background: user.scholarClass === 11 ? "rgba(59,130,246,0.12)" : "rgba(99,102,241,0.12)",
              color: user.scholarClass === 11 ? "#60a5fa" : "#818cf8",
            }}
          >
            <span>{user.scholarClass === 11 ? "⚛️" : "📘"}</span>
            <span className="hidden sm:inline">Class {user.scholarClass}</span>
            {user.jeeMode && <span className="px-1 py-0.5 rounded-full bg-orange-500 text-white text-[8px]">JEE</span>}
          </div>

          <Button variant="outline" size="sm" onClick={onOpenCmd} className="scholar-top-search min-w-0 max-w-xs flex-1 lg:w-72 lg:flex-none justify-start text-muted-foreground font-normal">
            <Search className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Search or jump to…</span>
          <span className="sm:hidden">Search</span>
          <kbd className="ml-auto hidden lg:inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">
            <CmdIcon className="h-3 w-3" />K
          </kbd>
        </Button>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {guestMode && <Badge variant="outline" className="scholar-top-status border-cyan-300/30 bg-cyan-300/10 text-cyan-100">Guest</Badge>}
          {devMode && <Badge variant="outline" className="scholar-top-status text-orange-400 border-orange-400/40 bg-orange-400/10 hidden sm:inline-flex">DEV</Badge>}
          <div className="scholar-top-status hidden sm:contents">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 text-orange-500">
            <Flame className="h-4 w-4" />
            <span className="text-sm font-semibold tabular-nums">{streak}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-500">
            <Coins className="h-4 w-4" />
            <span className="text-sm font-semibold tabular-nums">{coins}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hidden sm:flex">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-semibold tabular-nums">Lv {li.level}</span>
          </div>
          </div>
          <div className="scholar-top-profile shrink-0 grid place-items-center h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 text-white text-sm font-semibold overflow-hidden ring-2 ring-background">
            {user.avatar.startsWith("data:") ? (
              <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span>{user.avatar}</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function CommandPalette({ open, onOpenChange, onNavigate }: { open: boolean; onOpenChange: (o: boolean) => void; onNavigate: (id: string) => void }) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search views, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV_ITEMS.filter((item) => !item.preview).map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => { onNavigate(item.id); onOpenChange(false); }}
              className="cursor-pointer"
            >
              <item.icon className="h-4 w-4 mr-2 text-muted-foreground" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Class 11 E-Books">
          <CommandItem onSelect={() => { try { sessionStorage.setItem("scholar:ebook:target", JSON.stringify({ bookId: "chemistry-pt1", destination: "Reader" })); } catch {} onNavigate("ebook"); onOpenChange(false); }}>
            <BookOpen className="h-4 w-4 mr-2 text-rose-400" /> Chemistry Part 1 — Some Basic Concepts · Structure of Atom · Clean PDF · Original Scan
          </CommandItem>
          <CommandItem onSelect={() => { try { sessionStorage.setItem("scholar:ebook:target", JSON.stringify({ bookId: "maths-pt1", destination: "Reader" })); } catch {} onNavigate("ebook"); onOpenChange(false); }}>
            <BookOpen className="h-4 w-4 mr-2 text-indigo-400" /> Mathematics Part 1 — Sets · Relations and Functions
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => { onNavigate("ai-tutor"); onOpenChange(false); }}>
            <Bot className="h-4 w-4 mr-2 text-muted-foreground" /> Ask AI Tutor
          </CommandItem>
          <CommandItem onSelect={() => { onNavigate("quiz"); onOpenChange(false); }}>
            <Sparkles className="h-4 w-4 mr-2 text-muted-foreground" /> Take a Quiz
          </CommandItem>
          <CommandItem onSelect={() => { onNavigate("focus"); onOpenChange(false); }}>
            <Zap className="h-4 w-4 mr-2 text-muted-foreground" /> Start Focus Timer
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

// Lightweight command dialog wrapper using the available Dialog primitives
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
function CommandDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl max-w-xl" showCloseButton={true}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Footer({ active }: { active: string }) {
  return <ScholarFooter compact={["ebook", "mock-exam", "subscription-payment", "ai-tutor"].includes(active)} />;
}

// ===== Error Boundary — prevents view crashes from taking down the sidebar =====
class ViewErrorBoundary extends Component<{ children: ReactNode; viewName: string }, { hasError: boolean; error: Error | null }> {
  state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: any) { console.error(`[ViewErrorBoundary] ${this.props.viewName} crashed:`, error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] grid place-items-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="grid place-items-center h-16 w-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">This view encountered an error</h2>
            <p className="text-sm text-white/50">We couldn’t open this section. Retry, or choose another section from navigation. Your saved work has not been removed.</p>
            <Button variant="outline" onClick={() => this.setState({ hasError: false, error: null })} className="bg-white/5 border-white/15 text-white hover:bg-white/10">Try again</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AppShell() {
  const startupReady = useScholarStartupReady();
  const user = useStore((s) => s.user);
  const guestMode = useStore((s) => s.guestMode);
  const setAuthed = useStore((s) => s.setAuthed);
  const switchClass = useStore((s) => s.switchClass);
  const toggleJeeMode = useStore((s) => s.toggleJeeMode);
  const settings = useStore((s) => s.settings);
  const { startTransition } = useScholarTransition();
  const access = useScholarAccess();
  const appearanceLabUnlocked = access.has("appearance_lab");
  const [active, setActive] = useState(() => {
    if (typeof window === "undefined") return "dashboard";
    const segment = window.location.pathname.split("/").filter(Boolean)[0];
    return segment && VIEW_COMPONENTS[segment] ? segment : "dashboard";
  });
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Persist sidebar open/closed state across reloads. Default to open on desktop.
    if (typeof window === "undefined") return false;
    try {
      const preference = useStore.getState().settings.sidebarBehavior ?? "remember";
      if (preference === "open") return true;
      if (preference === "closed") return false;
      const stored = localStorage.getItem("scholar-sidebar-open");
      if (stored !== null) return stored === "true";
      // Default to open on desktop (lg+), closed on mobile
      return window.innerWidth >= 1024;
    } catch { return false; }
  });
  const [classLoading, setClassLoading] = useState(false);
  const [loadingText, setLoadingText] = useState({ title: "", subtitle: "" });
  const badges = useNavBadges();

  // Migrate legacy unscoped localStorage keys to profile-scoped keys.
  // Runs once on app load, before any view reads from localStorage. Safe to
  // call repeatedly — it short-circuits if the migration version is current.
  useEffect(() => {
    migrateLegacyStorage();
  }, []);

  // Cross-tab synchronisation for Smart Reminders (re-hydrate on storage events).
  useEffect(() => {
    const stop = initReminderStoreSync();
    return stop;
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => document.documentElement.dataset.scholarKeyboardOpen = String(window.innerHeight - viewport.height > 160);
    sync();
    viewport.addEventListener("resize", sync);
    return () => { viewport.removeEventListener("resize", sync); delete document.documentElement.dataset.scholarKeyboardOpen; };
  }, []);

  useEffect(() => {
    applyTheme(getEquippedTheme(user.scholarClass));
  }, [user.scholarClass]);

  useEffect(() => {
    if (!access.loading && access.entitlementsLoaded && access.status !== "error" && user.scholarClass === 9 && !access.has("class_9_access")) {
      switchClass(11);
      window.dispatchEvent(new CustomEvent("scholar:notification", { detail: { type: "info", title: "Scholar now opens in Class 11", message: "Class 9 is available with Scholar Plus." } }));
    }
  }, [access, switchClass, user.scholarClass]);

  useEffect(() => {
    const root = document.documentElement;
    // The experimental appearance engine is intentionally locked. Always
    // restore Scholar's original presentation on launch; the developer-only
    // font preview can opt in for the current session from Settings.
    root.dataset.fontScale = settings.fontScale ?? "100";
    root.dataset.density = appearanceLabUnlocked ? (settings.density ?? "comfortable") : "comfortable";
    root.dataset.highContrast = String(appearanceLabUnlocked && Boolean(settings.highContrast));
    root.dataset.readableFont = String(Boolean(settings.readableFont));
    root.dataset.backgroundPattern = "true";
    root.dataset.reduceMotion = String(Boolean(settings.reduceMotion));
    root.dataset.pageTransitions = String(settings.pageTransitions !== false);
  }, [appearanceLabUnlocked, settings.density, settings.fontScale, settings.highContrast, settings.pageTransitions, settings.readableFont, settings.reduceMotion]);

  useEffect(() => {
    if (settings.sidebarBehavior === "remember") return;
    const timer = window.setTimeout(
      () => setSidebarOpen(settings.sidebarBehavior === "open"),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [settings.sidebarBehavior]);

  // Persist sidebar state
  useEffect(() => {
    try { localStorage.setItem("scholar-sidebar-open", String(sidebarOpen)); } catch { /* ignore */ }
  }, [sidebarOpen]);

  // Listen for class switch events from Settings
  useEffect(() => {
    const onClassSwitch = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.newClass) {
        const toClass = detail.newClass as 9 | 11;
        if (toClass === 9 && !access.has("class_9_access")) {
          setActive("plus");
          window.history.pushState({ viewId: "plus" }, "", "/plus");
          return;
        }
        if (toClass !== user.scholarClass) {
          const response = await fetch("/api/academic-class", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scholarClass: toClass }) });
          if (!response.ok) {
            if (response.status === 403) {
              setActive("plus");
              window.history.pushState({ viewId: "plus" }, "", "/plus");
            }
            return;
          }
          void startTransition({
            type: "academic-switch",
            fromClass: user.scholarClass,
            toClass,
            durationMs: 1_200,
            prepare: async () => {
              await Promise.all([
                import("@/lib/curriculum"),
                import("@/lib/curriculum-class11"),
                import("@/lib/ebook-data"),
              ]);
            },
            commit: () => switchClass(toClass),
          });
        }
      }
      if (detail?.jeeToggle) {
        setLoadingText({
          title: user.jeeMode ? "Disabling JEE Mode" : "Enabling JEE Mode",
          subtitle: user.jeeMode ? "Returning to standard CBSE mode" : "Switching to advanced competitive preparation",
        });
        setClassLoading(true);
        setTimeout(() => {
          toggleJeeMode();
          setClassLoading(false);
        }, 2000);
      }
    };
    const listener = (event: Event) => { void onClassSwitch(event); };
    window.addEventListener("scholar:class-switch", listener);
    return () => window.removeEventListener("scholar:class-switch", listener);
  }, [access, startTransition, switchClass, toggleJeeMode, user.jeeMode, user.scholarClass]);

  // Keyboard shortcut for command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navigate = useCallback((id: string, updateHistory = true) => {
    setActive(id);
    setMobileOpen(false);
    if (updateHistory) {
      const nextPath = id === "dashboard" ? "/" : `/${id}`;
      if (window.location.pathname !== nextPath) window.history.pushState({ viewId: id }, "", nextPath);
    }
    const main = document.getElementById("main-scroll");
    if (main) main.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const segment = window.location.pathname.split("/").filter(Boolean)[0];
      navigate(segment && VIEW_COMPONENTS[segment] ? segment : "dashboard", false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [navigate]);

  // Listen for global nav events (from views — enables interconnections)
  useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.viewId && VIEW_COMPONENTS[detail.viewId]) {
        navigate(detail.viewId);
      }
    };
    window.addEventListener("neha-scholar:navigate", onNav);
    return () => window.removeEventListener("neha-scholar:navigate", onNav);
  }, [navigate]);

  const View = VIEW_COMPONENTS[active] ?? DashboardView;

  // Per-view gradient background classes
  const viewBg: Record<string, string> = {
    dashboard: "bg-gradient-to-br from-indigo-500/5 via-background to-teal-500/5",
    "chapter-command": "bg-gradient-to-br from-violet-500/5 via-background to-fuchsia-500/5",
    "ai-tutor": "bg-gradient-to-br from-fuchsia-500/5 via-background to-indigo-500/5",
    "ai-tools": "bg-gradient-to-br from-violet-500/5 via-background to-indigo-500/5",
    notes: "bg-gradient-to-br from-amber-500/5 via-background to-orange-500/5",
    resources: "bg-gradient-to-br from-emerald-500/5 via-background to-teal-500/5",
    study: "bg-gradient-to-br from-teal-500/5 via-background to-emerald-500/5",
    ebook: "bg-gradient-to-br from-indigo-500/5 via-background to-blue-500/5",
    practice: "bg-gradient-to-br from-blue-500/5 via-background to-cyan-500/5",
    flashcards: "bg-gradient-to-br from-yellow-500/5 via-background to-amber-500/5",
    quiz: "bg-gradient-to-br from-rose-500/5 via-background to-pink-500/5",
    "exam-prep": "bg-gradient-to-br from-red-500/5 via-background to-orange-500/5",
    planner: "bg-gradient-to-br from-cyan-500/5 via-background to-blue-500/5",
    focus: "bg-gradient-to-br from-sky-500/5 via-background to-indigo-500/5",
    analytics: "bg-gradient-to-br from-indigo-500/5 via-background to-violet-500/5",
    achievements: "bg-gradient-to-br from-amber-500/5 via-background to-yellow-500/5",
    mindmap: "bg-gradient-to-br from-violet-500/5 via-background to-purple-500/5",
    galaxy: "bg-gradient-to-br from-purple-500/5 via-background to-fuchsia-500/5",
    formulas: "bg-gradient-to-br from-blue-500/5 via-background to-cyan-500/5",
    community: "bg-gradient-to-br from-pink-500/5 via-background to-rose-500/5",
    store: "bg-gradient-to-br from-emerald-500/5 via-background to-green-500/5",
    files: "bg-gradient-to-br from-slate-500/5 via-background to-zinc-500/5",
    settings: "bg-gradient-to-br from-zinc-500/5 via-background to-slate-500/5",
    friends: "bg-gradient-to-br from-pink-500/5 via-background to-fuchsia-500/5",
    nigtube: "bg-gradient-to-br from-red-500/5 via-background to-fuchsia-500/5",
    lab: "bg-gradient-to-br from-emerald-500/5 via-background to-teal-500/5",
    levels: "bg-gradient-to-br from-amber-500/5 via-background to-teal-500/5",
    "past-papers": "bg-gradient-to-br from-cyan-500/5 via-background to-blue-500/5",
    "answer-lab": "bg-gradient-to-br from-rose-500/5 via-background to-pink-500/5",
    "revision-hub": "bg-gradient-to-br from-emerald-500/5 via-background to-green-500/5",
    "mock-exam": "bg-gradient-to-br from-red-500/5 via-background to-orange-500/5",
    "goal-center": "bg-gradient-to-br from-amber-500/5 via-background to-yellow-500/5",
    reminders: "bg-gradient-to-br from-fuchsia-500/5 via-background to-pink-500/5",
    "doubt-history": "bg-gradient-to-br from-violet-500/5 via-background to-purple-500/5",
    downloads: "bg-gradient-to-br from-sky-500/5 via-background to-cyan-500/5",
    assignments: "bg-gradient-to-br from-teal-500/5 via-background to-emerald-500/5",
    workspace: "bg-gradient-to-br from-indigo-500/5 via-background to-purple-500/5",
    music: "bg-gradient-to-br from-purple-500/5 via-background to-indigo-500/5",
    canvas: "bg-gradient-to-br from-slate-500/5 via-background to-zinc-500/5",
    toolbox: "bg-gradient-to-br from-orange-500/5 via-background to-amber-500/5",
    practicals: "bg-gradient-to-br from-green-500/5 via-background to-emerald-500/5",
    python: "bg-gradient-to-br from-purple-500/5 via-background to-blue-500/5",
    derivations: "bg-gradient-to-br from-cyan-500/5 via-background to-sky-500/5",
  };

  return (
    <div className="scholar-shell flex h-dvh w-full overflow-hidden bg-background">
      <a href="#main-scroll" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[11000] focus:rounded-xl focus:bg-background focus:p-3">Skip to study content</a>
      {/* Desktop sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="scholar-desktop-sidebar hidden lg:flex shrink-0 flex-col border-r border-border/60 bg-sidebar backdrop-blur-xl sticky top-0 h-screen overflow-hidden z-30 relative"
          >
            <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border/60 shrink-0">
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-teal-500 text-white shadow-md">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div className="scholar-sidebar-title">
                <p className="text-sm font-semibold leading-tight">{guestMode ? "Guest workspace" : `${user.name.split(" ")[0] || "Your"}’s Scholar`}</p>
                <p className="text-[10px] text-muted-foreground">Class {user.scholarClass} · CBSE{user.jeeMode ? " · JEE" : ""}</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <NavList active={active} onNavigate={navigate} badges={badges} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={(open) => {
        setMobileOpen(open);
        if (!open) window.setTimeout(() => document.getElementById("scholar-mobile-menu")?.focus(), 0);
      }}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="h-16 flex-row items-center gap-2.5 px-5 border-b border-border/60 space-y-0">
            <div className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-teal-500 text-white shadow-md">
              <GraduationCap className="h-5 w-5" />
            </div>
            <SheetTitle className="text-left">{guestMode ? "Guest workspace" : `${user.name.split(" ")[0] || "Your"}’s Scholar`}</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-[calc(100vh-4rem)] no-scrollbar">
            <NavList active={active} onNavigate={navigate} badges={badges} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative z-20 w-full">
        <TopBar onOpenCmd={() => setCmdOpen(true)} onOpenMobile={() => setMobileOpen(true)} onToggleSidebar={() => setSidebarOpen((o) => !o)} sidebarOpen={sidebarOpen} />
        {guestMode ? (
          <section className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-2 text-xs text-cyan-50 sm:px-5" aria-label="Guest session information">
            <p><strong>Guest session</strong><span className="ml-2 text-white/55">Your progress is saved only on this device until you create an account.</span></p>
            <button type="button" onClick={() => setAuthed(false)} className="rounded-full border border-cyan-200/20 bg-white/[0.06] px-3 py-1.5 font-semibold hover:bg-white/[0.1]">Create account or Sign in</button>
          </section>
        ) : null}
        <BackgroundTaskNotifications onNavigate={navigate} />
        <main id="main-scroll" tabIndex={-1} className={`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-3 transition-colors duration-500 sm:p-4 lg:p-6 ${viewBg[active] ?? ""}`} style={{ position: "relative", zIndex: 10, width: "100%" }}>
          <div className="flex-1" style={{ position: "relative", width: "100%" }}>
          <motion.div
            key={active}
            initial={settings.pageTransitions === false || settings.reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: settings.pageTransitions === false || settings.reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <ViewErrorBoundary viewName={active}>
              {guestMode && GUEST_RESTRICTED_VIEWS.has(active) ? (
                <section className="mx-auto grid min-h-[55vh] max-w-lg place-items-center text-center">
                  <div className="rounded-3xl border border-white/10 bg-black/25 p-8 backdrop-blur-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Guest session</p>
                    <h1 className="mt-3 text-2xl font-semibold">Sign in to use this private feature</h1>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">Guest Mode does not provide cloud files, purchases, payments, subscriptions, or cross-device storage.</p>
                    <button type="button" onClick={() => setAuthed(false)} className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">Create account or Sign in</button>
                  </div>
                </section>
              ) : VIEW_ENTITLEMENTS[active] && !access.has(VIEW_ENTITLEMENTS[active].entitlement) ? (
                <PlusGate {...VIEW_ENTITLEMENTS[active]}><View /></PlusGate>
              ) : <View />}
            </ViewErrorBoundary>
          </motion.div>
          </div>
          <Footer active={active} />
        </main>
      </div>

      {startupReady && !guestMode ? <LamWidget currentView={active} /> : null}

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} onNavigate={navigate} />

      {/* JEE mode keeps its existing short, silent transition. Academic class
          switching is handled by the shared transition provider. */}
      {classLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] grid place-items-center overflow-hidden"
        >
          <video autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover">
            <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260514_102933_4e8f73b5-775a-4179-b2fb-472f59063dcd.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
          <div className="relative z-10 text-center px-4">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="inline-block mb-6">
              <div className="grid place-items-center h-16 w-16 rounded-full bg-white/10 backdrop-blur-md border border-white/30">
                <Zap className="h-8 w-8 text-white" />
              </div>
            </motion.div>
            <h2 className="font-serif italic text-4xl md:text-5xl text-white mb-3 drop-shadow-lg">{loadingText.title}</h2>
            <p className="text-base text-white/90 mb-8 drop-shadow">{loadingText.subtitle}</p>
            <div className="w-72 h-1.5 bg-white/20 rounded-full overflow-hidden mx-auto backdrop-blur-sm">
              <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2, ease: "linear" }} className="h-full bg-white" />
            </div>
            <p className="text-xs text-white/70 mt-4 drop-shadow">Please wait…</p>
          </div>
        </motion.div>
      )}

      {/* Mobile bottom navigation — hidden on desktop (lg+) */}
      {active !== "subscription-payment" && <nav className="scholar-bottom-nav lg:hidden">
        <button onClick={() => navigate("dashboard")} className={cn(active === "dashboard" && "active")} aria-label="Home">
          <Home /> Home
        </button>
        <button onClick={() => navigate("study")} className={cn(active === "study" && "active")} aria-label="Study">
          <BookOpen /> Study
        </button>
        <button onClick={() => navigate("practice")} className={cn(active === "practice" && "active")} aria-label="Practice">
          <ListChecks /> Practice
        </button>
        <button onClick={() => navigate("ai-tools")} className={cn(active === "ai-tools" && "active")} aria-label="AI Tools">
          <Lightbulb /> AI
        </button>
        <button onClick={() => setMobileOpen(true)} aria-label="More sections">
          <Menu /> More
        </button>
      </nav>}

      {/* Smart Reminders 2.0 — global due-check scheduler (in-app + browser notifications + Talk Reminders) */}
      <ReminderScheduler scholarClass={user.scholarClass} />

      {/* Floating music widget — persistent across navigation */}
      <FloatingMusicWidget />

      {/* PWA install prompt */}
      <PWAInstallPrompt />
      <PlusPromotion />
    </div>
  );
}
