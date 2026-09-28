"use client";

import dynamic from "next/dynamic";
import { LaunchSplash } from "@/components/launch-splash";

// Completely skip SSR for app content to avoid hydration mismatches
// caused by Zustand persist (localStorage rehydration) + Date.now() in seed data.
// The loading skeleton renders on the server and during client chunk load,
// then AppContent hydrates client-only with zero mismatch risk.
const AppContent = dynamic(
  () => import("@/components/app-content").then((m) => m.AppContent),
  {
    ssr: false,
    loading: () => <LaunchSplash message="Loading Scholar…" />,
  }
);

export default function Home() {
  return <AppContent />;
}
