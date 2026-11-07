"use client";

import dynamic from "next/dynamic";
import { WorkspacePanel, WorkspaceTabs, useWorkspaceMode } from "@/components/workspaces/workspace-tabs";

const PracticeView = dynamic(() => import("@/components/views/practice").then((module) => module.PracticeView), {
  loading: () => <div className="min-h-[50vh] animate-pulse rounded-3xl bg-muted/40" />,
});
const QuizView = dynamic(() => import("@/components/views/quiz").then((module) => module.QuizView), {
  loading: () => <div className="min-h-[50vh] animate-pulse rounded-3xl bg-muted/40" />,
});
const PastPapersView = dynamic(() => import("@/components/views/past-papers").then((module) => module.PastPapersView), {
  loading: () => <div className="min-h-[50vh] animate-pulse rounded-3xl bg-muted/40" />,
});

export function QuestionPracticeView() {
  const { mode, select } = useWorkspaceMode("question-practice", "practice");
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col" data-workspace="question-practice">
      <WorkspaceTabs workspaceId="question-practice" active={mode} onSelect={select} />
      <WorkspacePanel workspaceId="question-practice" mode={mode} className="flex flex-col">
        {mode === "practice" ? <PracticeView /> : null}
        {mode === "quiz" ? <QuizView /> : null}
        {mode === "past-papers" ? <PastPapersView /> : null}
      </WorkspacePanel>
    </div>
  );
}

export default QuestionPracticeView;
