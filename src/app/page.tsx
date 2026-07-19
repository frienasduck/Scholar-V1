"use client";

import dynamic from "next/dynamic";

// Completely skip SSR for app content to avoid hydration mismatches
// caused by Zustand persist (localStorage rehydration) + Date.now() in seed data.
// The loading skeleton renders on the server and during client chunk load,
// then AppContent hydrates client-only with zero mismatch risk.
const AppContent = dynamic(
  () => import("@/components/app-content").then((m) => m.AppContent),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-500 text-white shadow-lg animate-pulse">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            Loading Scholar…
          </p>
        </div>
      </div>
    ),
  }
);

export default function Home() {
  return <AppContent />;
}
