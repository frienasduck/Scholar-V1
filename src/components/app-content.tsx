"use client";

import { useStore } from "@/lib/store";
import { AuthScreen } from "@/components/auth-screen";
import { Onboarding } from "@/components/onboarding";
import { AppShell } from "@/components/app-shell";

export function AppContent() {
  const authed = useStore((s) => s.authed);
  const onboarded = useStore((s) => s.onboarded);

  if (!authed) return <AuthScreen />;
  if (!onboarded) return <Onboarding />;
  return <AppShell />;
}
