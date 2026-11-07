"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NavigationLens, useNavigationLens } from "@/components/liquid-glass/velocity-motion";
import {
  SCHOLAR_WORKSPACES,
  WORKSPACE_MODE_EVENT,
  isWorkspaceMode,
  peekWorkspaceMode,
  resolveScholarDestination,
  setWorkspaceMode,
  type ScholarWorkspaceId,
} from "@/lib/shrinking-scholar";

/** Read a deep-linked mode without losing it to React Strict Mode double-render. */
export function useWorkspaceMode(workspaceId: ScholarWorkspaceId, preferred?: string) {
  const workspace = SCHOLAR_WORKSPACES[workspaceId];
  const [mode, setMode] = useState<string>(() => {
    const deepLinked = peekWorkspaceMode(workspaceId);
    if (isWorkspaceMode(workspaceId, deepLinked)) return deepLinked;
    if (typeof window !== "undefined") {
      const seg = window.location.pathname.split("/").filter(Boolean)[0];
      const params = new URLSearchParams(window.location.search);
      const fromUrl = seg
        ? resolveScholarDestination({
            viewId: seg,
            mode: params.get("mode") ?? undefined,
            pluginId: params.get("plugin") ?? params.get("tool") ?? undefined,
          }).mode
        : undefined;
      if (isWorkspaceMode(workspaceId, fromUrl)) return fromUrl;
    }
    if (isWorkspaceMode(workspaceId, preferred)) return preferred;
    return workspace.defaultMode;
  });

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ viewId?: string; mode?: string }>).detail;
      if (detail?.viewId !== workspaceId || !isWorkspaceMode(workspaceId, detail.mode)) return;
      setMode(detail.mode);
    };
    window.addEventListener(WORKSPACE_MODE_EVENT, onChange);
    return () => window.removeEventListener(WORKSPACE_MODE_EVENT, onChange);
  }, [workspaceId]);

  const select = useCallback((next: string) => {
    if (!isWorkspaceMode(workspaceId, next)) return;
    setMode(next);
    setWorkspaceMode(workspaceId, next);
  }, [workspaceId]);

  return { workspace, mode, select };
}

export function WorkspaceTabs({
  workspaceId,
  active,
  onSelect,
  badges,
  className,
  flush = false,
}: {
  workspaceId: ScholarWorkspaceId;
  active: string;
  onSelect: (mode: string) => void;
  badges?: Record<string, string>;
  className?: string;
  /** The parent already runs edge-to-edge (for example the immersive main area). */
  flush?: boolean;
}) {
  const workspace = SCHOLAR_WORKSPACES[workspaceId];
  const tabsRef = useRef<HTMLDivElement>(null);
  const lens = useNavigationLens(tabsRef, active, "x");
  return (
    <header
      className={cn(
        "scholar-workspace-header relative z-20 border-b border-white/[0.08] bg-black/40 px-3 py-2 backdrop-blur-xl sm:px-4 lg:px-6",
        !flush && "-mx-3 -mt-3 sm:-mx-4 sm:-mt-4 lg:-mx-6 lg:-mt-6",
        className,
      )}
      data-workspace={workspaceId}
      data-workspace-mode={active}
    >
      <div className="mx-auto flex min-h-10 w-full max-w-none items-center gap-3">
        <span className="hidden text-xs font-semibold tracking-wide text-muted-foreground sm:inline-block shrink-0">
          {workspace.label}
        </span>
        <div
          ref={tabsRef}
          role="tablist"
          aria-label={`${workspace.label} sections`}
          className="scholar-workspace-tabs sg-velocity-tabs relative isolate flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-white/[0.1] bg-muted/25 p-1"
        >
          <NavigationLens lensRef={lens} axis="x" />
          {workspace.modes.map((mode, idx) => {
            const selected = mode.id === active;
            const badge = badges?.[mode.id];
            return (
              <button
                key={mode.id}
                type="button"
                role="tab"
                data-slot="tabs-trigger"
                data-state={selected ? "active" : "inactive"}
                data-velocity-control="navigation"
                aria-selected={selected}
                aria-controls={`${workspaceId}-${mode.id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelect(mode.id)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const dir = e.key === "ArrowRight" ? 1 : -1;
                    const nextIdx = (idx + dir + workspace.modes.length) % workspace.modes.length;
                    onSelect(workspace.modes[nextIdx].id);
                  }
                }}
                title={mode.description}
                className={cn(
                  "relative z-10 inline-flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors duration-200 sm:px-3 sm:text-[13px]",
                  selected
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode.label}
                {badge ? (
                  <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-200">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export function WorkspacePanel({
  workspaceId,
  mode,
  children,
  className,
  flush = false,
}: {
  workspaceId: ScholarWorkspaceId;
  mode: string;
  children: ReactNode;
  className?: string;
  /** The parent already runs edge-to-edge (for example the immersive main area). */
  flush?: boolean;
}) {
  return (
    <section
      id={`${workspaceId}-${mode}-panel`}
      role="tabpanel"
      aria-label={mode}
      className={cn(
        "min-w-0 flex-1 [&>*]:!m-0",
        !flush && "-mx-3 sm:-mx-4 lg:-mx-6",
        className,
      )}
    >
      {children}
    </section>
  );
}
