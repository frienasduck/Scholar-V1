"use client";

import { useStore } from "@/lib/store";
import { Class9QuizView } from "./quiz/Class9QuizView";
import { Class11QuizView } from "./quiz/Class11QuizView";

export function QuizView() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  if (scholarClass === 11) return <Class11QuizView />;
  return <Class9QuizView />;
}

export default QuizView;
