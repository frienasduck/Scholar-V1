"use client";
import { useStore } from "@/lib/store";

export function useUserName(): { name: string; shortName: string; appName: string; madeFor: string } {
  const user = useStore((s) => s.user);
  if (user.scholarClass === 11) {
    return {
      name: "Ishan",
      shortName: "Ishan",
      appName: "Ishan's Scholar",
      madeFor: "Made with care for Ishan",
    };
  }
  return {
    name: user.name || "Neha",
    shortName: (user.name || "Neha").split(" ")[0],
    appName: "Neha's Scholar",
    madeFor: "Made with care for Neha Salah",
  };
}
