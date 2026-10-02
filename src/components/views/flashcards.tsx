"use client";

import { useStore } from "@/lib/store";
import { Class9FlashcardsView } from "./flashcards/Class9FlashcardsView";
import { Class11FlashcardsView } from "./flashcards/Class11FlashcardsView";
import { ResourceShelf } from "@/components/resources/resource-library";

export function FlashcardsView() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  return <><ResourceShelf grade={scholarClass} type="notes" aid="flashcards" title="Review from source-linked cards"/>{scholarClass === 11 ? <Class11FlashcardsView/> : <Class9FlashcardsView/>}</>;
}

export default FlashcardsView;
