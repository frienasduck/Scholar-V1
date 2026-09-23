"use client";
import { useStore } from "@/lib/store";

export function useUserName(): { name: string; shortName: string; appName: string; madeFor: string } {
  const user = useStore((s) => s.user);
  if (user.scholarClass === 11) {
    return {
      name: user.name || "Student",
      shortName: (user.name || "Student").split(" ")[0],
      appName: "Scholar",
      madeFor: "Made for focused learning",
    };
  }
  return {
    name: user.name || "Student",
    shortName: (user.name || "Student").split(" ")[0],
    appName: "Scholar",
    madeFor: "Made for focused learning",
  };
}
