"use client";
import { ExamReadyWorkspace } from "@/components/exam-ready/workspace";
import { SectionShutdown } from "@/components/section-shutdown";
import { getSectionShutdown } from "@/lib/section-availability";
// Preserve the established route and exported contract for existing links.
export function ExamPrepView(){
  if (getSectionShutdown("exam-prep")) return <SectionShutdown viewId="exam-prep" />;
  return <ExamReadyWorkspace/>;
}
