"use client";

import { SectionShutdown } from "@/components/section-shutdown";
import { WorkspacePanel, WorkspaceTabs, useWorkspaceMode } from "@/components/workspaces/workspace-tabs";

/**
 * LAMTube and Study Music are merged for navigation, but both services stay
 * paused. This intentionally renders the existing shutdown notices rather than
 * the old players, so merging cannot bypass the licensing pause.
 */
export function StudyMediaView() {
  const { mode, select } = useWorkspaceMode("study-media", "lamtube");
  return (
    <div className="flex min-h-[calc(var(--scholar-vvh,100dvh)-4rem)] flex-col" data-workspace="study-media">
      <WorkspaceTabs
        workspaceId="study-media"
        active={mode}
        onSelect={select}
        badges={{ lamtube: "Paused", music: "Paused" }}
      />
      <WorkspacePanel workspaceId="study-media" mode={mode} className="flex flex-1 flex-col">
        <SectionShutdown viewId={mode === "music" ? "music" : "nigtube"} />
      </WorkspacePanel>
    </div>
  );
}

export default StudyMediaView;
