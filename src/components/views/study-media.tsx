"use client";

import dynamic from "next/dynamic";
import { SectionShutdown } from "@/components/section-shutdown";
import { WorkspacePanel, WorkspaceTabs, useWorkspaceMode } from "@/components/workspaces/workspace-tabs";
import { navigateTo } from "@/lib/nav-event";

const LamTubeWorkspace = dynamic(() => import("@/components/lamtube/workspace"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted-foreground">
      Loading AI Video Maker…
    </div>
  ),
});

/**
 * Partial unpause of Study Media:
 * - LAMTube → AI Video Maker is live and functional. Third-party YouTube feeds stay paused inside the workspace banner.
 * - Study Music remains completely paused for licensing.
 */
export function StudyMediaView() {
  const { mode, select } = useWorkspaceMode("study-media", "lamtube");
  return (
    <div className="flex min-h-[calc(var(--scholar-vvh,100dvh)-4rem)] flex-col" data-workspace="study-media">
      <WorkspaceTabs
        workspaceId="study-media"
        active={mode}
        onSelect={select}
        badges={{ lamtube: "AI Video Maker", music: "Paused" }}
      />
      <WorkspacePanel workspaceId="study-media" mode={mode} className="flex flex-1 flex-col">
        {mode === "music" ? (
          <SectionShutdown viewId="music" />
        ) : (
          <LamTubeWorkspace onBack={() => navigateTo("dashboard")} />
        )}
      </WorkspacePanel>
    </div>
  );
}

export default StudyMediaView;
