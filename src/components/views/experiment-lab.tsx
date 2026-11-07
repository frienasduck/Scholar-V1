"use client";

import dynamic from "next/dynamic";
import { PlusGate } from "@/components/subscriptions/plus-gate";
import { WorkspacePanel, WorkspaceTabs, useWorkspaceMode } from "@/components/workspaces/workspace-tabs";

const LabView = dynamic(() => import("@/components/views/lab").then((module) => module.LabView), {
  loading: () => <div className="min-h-[50vh] animate-pulse rounded-3xl bg-muted/40" />,
});
const PracticalsView = dynamic(() => import("@/components/views/practicals").then((module) => module.PracticalsView), {
  loading: () => <div className="min-h-[50vh] animate-pulse rounded-3xl bg-muted/40" />,
});

export function ExperimentLabView() {
  const { mode, select } = useWorkspaceMode("experiment-lab", "experiments");
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col" data-workspace="experiment-lab">
      <WorkspaceTabs workspaceId="experiment-lab" active={mode} onSelect={select} flush />
      <WorkspacePanel workspaceId="experiment-lab" mode={mode} flush className="flex flex-col">
        {mode === "experiments" ? <LabView /> : null}
        {mode === "practicals" ? (
          <PlusGate
            entitlement="practical_lab"
            title="Practical Lab"
            description="Explore practical procedures, observations, and interactive laboratory guidance."
          >
            <PracticalsView />
          </PlusGate>
        ) : null}
      </WorkspacePanel>
    </div>
  );
}

export default ExperimentLabView;
