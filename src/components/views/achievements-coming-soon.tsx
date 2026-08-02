"use client";

import { Trophy } from "lucide-react";

export function AchievementsComingSoon() {
  return <main className="min-h-[70vh] grid place-items-center"><section className="max-w-lg rounded-[2rem] border border-white/10 bg-white/5 p-9 text-center backdrop-blur-xl"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-300/10 text-amber-200"><Trophy className="h-6 w-6" /></span><h1 className="mt-5 text-3xl font-semibold">Achievements</h1><p className="mt-3 leading-7 text-white/55">Track major study milestones, subject mastery and long-term progress.</p><span className="mt-6 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-white/60">Coming soon</span></section></main>;
}
