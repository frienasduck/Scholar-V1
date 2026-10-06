"use client";
import { useSyncExternalStore } from "react";
import { visibleClock } from "./visible-clock";

const serverSnapshot = () => 0;
export function useVisibleClock(fallback = 0) {
  return useSyncExternalStore(visibleClock.subscribe, visibleClock.getSnapshot, serverSnapshot) || fallback;
}
