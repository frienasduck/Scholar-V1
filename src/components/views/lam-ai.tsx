"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BrainCircuit, Plus, Search, Sparkles } from "lucide-react";
import { ToolContent } from "@/components/views/ai-tools";
import { PlusGate } from "@/components/subscriptions/plus-gate";
import { useScholarAccess } from "@/components/subscriptions/subscription-provider";
import { GuestFeatureGate } from "@/components/guest/guest-feature-gate";
import { useStore } from "@/lib/store";
import {
  LAM_PLUGINS,
  PLUGIN_CATEGORIES,
  pluginById,
  pluginsByCategory,
  plannedPlugins,
  searchLamPlugins,
  type LamPlugin,
  type PluginCategory,
} from "@/lib/lam/plugin-registry";
import {
  LAM_PLUGIN_TARGET_EVENT,
  consumeLamPluginTarget,
  peekLamPluginTarget,
  setLamPluginTarget,
  type ScholarWorkspaceId,
} from "@/lib/shrinking-scholar";
import { WorkspacePanel, WorkspaceTabs, useWorkspaceMode } from "@/components/workspaces/workspace-tabs";
import "@/components/live-tutor/live-tutor.css";
import { cn } from "@/lib/utils";

const LiveTutorView = dynamic(
  () => import("@/components/views/live-tutor").then((module) => module.LiveTutorView),
  { loading: () => <div className="min-h-[60vh] animate-pulse bg-[#07090d]" /> },
);
const AITutorView = dynamic(
  () => import("@/components/views/ai-tutor").then((module) => module.AITutorView),
  { loading: () => <div className="min-h-[60vh] animate-pulse bg-background" /> },
);

const WORKSPACE: ScholarWorkspaceId = "lam-ai";

type PluginTarget = { pluginId: string; prompt: string } | null;

const AVAILABLE_PLUGINS = LAM_PLUGINS.filter((plugin) => plugin.availability === "available");
const PLANNED_PLUGINS = plannedPlugins();

function PluginBadges({ plugin }: { plugin: LamPlugin }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-full border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {plugin.category}
      </span>
      {plugin.entitlement || plugin.plus ? (
        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-200">
          Plus
        </span>
      ) : null}
      {plugin.attachments !== "none" ? (
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-cyan-200">
          {plugin.attachments === "required" ? "Attachment" : "Optional file"}
        </span>
      ) : null}
    </span>
  );
}

function LamPluginsPanel({ target, onTargetHandled }: { target: PluginTarget; onTargetHandled: () => void }) {
  const access = useScholarAccess();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(() => {
    const plugin = pluginById(target?.pluginId);
    return plugin?.availability === "available" ? plugin.id : null;
  });
  const [prompt, setPrompt] = useState(target?.prompt ?? "");

  const [prevTarget, setPrevTarget] = useState(target);
  if (target !== prevTarget) {
    setPrevTarget(target);
    const plugin = pluginById(target?.pluginId);
    if (plugin?.availability === "available") {
      setOpenId(plugin.id);
      setPrompt(target?.prompt ?? "");
    }
  }

  useEffect(() => {
    if (!target) return;
    onTargetHandled();
  }, [onTargetHandled, target]);

  const filtered = useMemo(
    () => searchLamPlugins(query, AVAILABLE_PLUGINS),
    [query],
  );
  const visibleCategories = useMemo(
    () => PLUGIN_CATEGORIES.filter((category) => pluginsByCategory(category, filtered).length > 0),
    [filtered],
  );

  const activePlugin = openId ? pluginById(openId) : null;

  if (activePlugin?.toolId) {
    const content = <ToolContent id={activePlugin.toolId} initialPrompt={prompt || undefined} />;
    return (
      <div className="min-h-[calc(100vh-10rem)] bg-background pt-[var(--lam-topbar-h,64px)]" data-lam-plugin={activePlugin.id}>
        <div className="sticky top-[var(--lam-topbar-h,64px)] z-20 flex flex-wrap items-center gap-3 border-b border-border/60 bg-background/85 px-3 py-2.5 backdrop-blur-xl sm:px-5">
          <button
            type="button"
            onClick={() => { setOpenId(null); setPrompt(""); }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All plugins
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
              <activePlugin.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{activePlugin.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{activePlugin.description}</p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <PluginBadges plugin={activePlugin} />
          </div>
        </div>
        {prompt ? (
          <div className="mx-auto mt-3 max-w-4xl px-3 sm:px-5">
            <p className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">From LAM:</span> {prompt.slice(0, 400)}
            </p>
          </div>
        ) : null}
        <div className="tool-content [&>div]:!m-0">
          {activePlugin.entitlement ? (
            <PlusGate
              entitlement={activePlugin.entitlement}
              title={activePlugin.name}
              description={activePlugin.description}
            >
              {content}
            </PlusGate>
          ) : content}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-10rem)] px-3 pb-6 pt-[calc(var(--lam-topbar-h,64px)+16px)] sm:px-5">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-card/50 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">Real Scholar tools</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Plugins</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              {AVAILABLE_PLUGINS.length} working plugins, grouped by what you are trying to do. Every
              available card opens the real tool with your actual Scholar data and permissions.
            </p>
          </div>
          <label className="flex min-h-10 w-full items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 sm:w-72">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a plugin…"
              aria-label="Search LAM AI plugins"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </label>
        </div>

        {visibleCategories.map((category: PluginCategory) => {
          const plugins = pluginsByCategory(category, filtered);
          return (
            <section key={category} aria-label={`${category} plugins`} className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">{category}</h3>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">{plugins.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {plugins.map((plugin) => {
                  const locked = Boolean(plugin.entitlement && !access.has(plugin.entitlement));
                  return (
                    <button
                      key={plugin.id}
                      type="button"
                      onClick={() => { setOpenId(plugin.id); setPrompt(""); }}
                      className={cn(
                        "group relative flex min-h-32 flex-col items-start gap-3 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br p-4 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "from-white/[0.06] to-white/[0.015]",
                      )}
                      data-plugin-id={plugin.id}
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/20 text-white shadow-inner">
                        <plugin.icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{plugin.name}</span>
                          {locked ? (
                            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-200">Plus</span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{plugin.description}</span>
                        <span className="mt-2 block"><PluginBadges plugin={plugin} /></span>
                      </span>
                      <Sparkles className="absolute right-3 top-3 h-3.5 w-3.5 text-foreground/30 transition-colors group-hover:text-foreground/70" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {!filtered.length ? (
          <p className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            No available plugin matches “{query}”. Try a tool name such as PDF Generator or Mistake Analyzer.
          </p>
        ) : null}

        <section aria-label="Plugins coming later" className="space-y-2.5 pt-2">
          <div className="flex flex-wrap items-center gap-2 px-1">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">Coming later</h3>
            <span className="text-[10px] text-muted-foreground/60">Planned — not available yet</span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {PLANNED_PLUGINS.map((plugin) => (
              <div
                key={plugin.id}
                aria-disabled="true"
                className="flex items-start gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/15 p-3.5 opacity-70"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <plugin.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-foreground/80">{plugin.name}</span>
                    <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Planned</span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">{plugin.description}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function LamAIView() {
  const { mode, select } = useWorkspaceMode(WORKSPACE, "chat");
  const guestMode = useStore((s) => s.guestMode);
  const setAuthed = useStore((s) => s.setAuthed);
  const reduceMotion = useStore((s) => s.settings.reduceMotion);
  const [pluginTarget, setPluginTarget] = useState<PluginTarget>(() => peekLamPluginTarget());
  const [pendingNewChat, setPendingNewChat] = useState(false);
  const clearPluginTarget = useCallback(() => {
    consumeLamPluginTarget();
    setPluginTarget(null);
  }, []);

  const startNewChat = useCallback(() => {
    setPendingNewChat(true);
    if (mode !== "chat") select("chat");
  }, [mode, select]);

  const handleNewChatHandled = useCallback(() => {
    setPendingNewChat(false);
  }, []);

  useEffect(() => {
    if (pluginTarget?.pluginId && mode !== "plugins") {
      select("plugins");
    }
  }, [mode, pluginTarget, select]);

  useEffect(() => {
    const onTarget = (event: Event) => {
      const detail = (event as CustomEvent<{ pluginId?: string; prompt?: string }>).detail;
      if (typeof detail?.pluginId !== "string") return;
      setPluginTarget({ pluginId: detail.pluginId, prompt: typeof detail.prompt === "string" ? detail.prompt : "" });
      select("plugins");
    };
    window.addEventListener(LAM_PLUGIN_TARGET_EVENT, onTarget);
    return () => window.removeEventListener(LAM_PLUGIN_TARGET_EVENT, onTarget);
  }, [select]);

  const openPlugin = useCallback((pluginId: string, prompt: string) => {
    setPluginTarget({ pluginId, prompt });
    setLamPluginTarget(pluginId, prompt);
    select("plugins");
  }, [select]);

  const headerPill = (
    <nav className="lt-nav lt-nav--header" aria-label="LAM AI navigation">
      <span className="lt-nav-brand">
        <span className="lt-scholar-mark">
          <BrainCircuit />
        </span>
        <span className="lt-nav-title">Scholar</span>
        <span className="lt-nav-beta">LAM AI</span>
      </span>
      <span className="lt-nav-div" />
      <button
        type="button"
        className="lt-nav-new"
        onClick={startNewChat}
        aria-label="New conversation"
        title="New conversation"
      >
        <Plus />
      </button>
    </nav>
  );

  return (
    <div
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#07090d] text-white [--lam-topbar-h:58px] sm:[--lam-topbar-h:64px]"
      data-workspace={WORKSPACE}
    >
      <WorkspaceTabs
        workspaceId={WORKSPACE}
        active={mode}
        onSelect={select}
        leftSlot={headerPill}
        refractiveOverlay
        flush
      />
      <WorkspacePanel
        workspaceId={WORKSPACE}
        mode={mode}
        flush
        className={cn("min-h-0 flex flex-col", mode === "chat" ? "overflow-hidden" : "overflow-y-auto")}
      >
        {mode === "chat" ? (
          <LiveTutorView
            embedded
            onOpenPlugin={openPlugin}
            pendingNewChat={pendingNewChat}
            onNewChatHandled={handleNewChatHandled}
          />
        ) : null}
        {mode === "tutor" ? (
          <AITutorView />
        ) : null}
        {mode === "plugins" ? (
          <LamPluginsPanel
            target={pluginTarget}
            onTargetHandled={clearPluginTarget}
          />
        ) : null}
      </WorkspacePanel>
    </div>
  );
}

export function LamAIWorkspaceHeaderMark() {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold">
      <BrainCircuit className="h-4 w-4" /> LAM AI
    </span>
  );
}

export default LamAIView;
