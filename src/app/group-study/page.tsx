import type { Metadata } from "next";
import { GroupStudyLanding } from "@/components/group-study/landing";

export const metadata: Metadata = {
  title: "Group Study · Scholar",
  description: "Join a live Scholar study room, share materials, ask Group LAM questions, solve quizzes, and stay focused together.",
  robots: { index: false, follow: false },
};

export default function GroupStudyPage() {
  return <GroupStudyLanding />;
}
