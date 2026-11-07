"use client";

import { useStore } from "@/lib/store";
import { Class9FlashcardsView } from "./flashcards/Class9FlashcardsView";
import { Class11FlashcardsView } from "./flashcards/Class11FlashcardsView";

export function FlashcardsView() {
  const scholarClass = useStore((s) => s.user.scholarClass);
  return <>{scholarClass === 11 ? <Class11FlashcardsView/> : <Class9FlashcardsView/>}<></></>;
}

export default FlashcardsView;
