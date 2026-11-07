"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { WorkspacePanel, WorkspaceTabs, useWorkspaceMode } from "@/components/workspaces/workspace-tabs";

const DoubtHistoryView = dynamic(() => import("@/components/views/doubt-history").then((module) => module.DoubtHistoryView), {
  loading: () => <div className="min-h-[50vh] animate-pulse rounded-3xl bg-muted/40" />,
});
const AnswerLabView = dynamic(() => import("@/components/views/answer-lab").then((module) => module.AnswerLabView), {
  loading: () => <div className="min-h-[50vh] animate-pulse rounded-3xl bg-muted/40" />,
});

export function DoubtLabView() {
  const { mode, select } = useWorkspaceMode("doubt-lab", "history");
  const [targetDoubt, setTargetDoubt] = useState<{ question: string; subject: string; chapter?: string } | null>(null);

  const handleSolveDoubt = useCallback(
    (doubt: { question: string; subject: string; chapter?: string }) => {
      setTargetDoubt(doubt);
      select("solve");
    },
    [select],
  );

  const handleBackToDoubts = useCallback(() => {
    select("history");
  }, [select]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col" data-workspace="doubt-lab">
      <WorkspaceTabs workspaceId="doubt-lab" active={mode} onSelect={select} />
      <WorkspacePanel workspaceId="doubt-lab" mode={mode} className="flex flex-col">
        {mode === "history" ? <DoubtHistoryView onSolveDoubt={handleSolveDoubt} /> : null}
        {mode === "solve" ? (
          <AnswerLabView
            key={targetDoubt?.question || "default-solve"}
            initialQuestion={targetDoubt}
            onBackToDoubts={handleBackToDoubts}
          />
        ) : null}
      </WorkspacePanel>
    </div>
  );
}

export default DoubtLabView;
