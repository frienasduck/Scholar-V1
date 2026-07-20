"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { GraduationCap, Sparkles, Target, BookOpen, Trophy, ArrowRight, ArrowLeft, Check, Volume2 } from "lucide-react";
import { useScholarTransition } from "@/components/scholar-transition";

export function Onboarding() {
  const setOnboarded = useStore((s) => s.setOnboarded);
  const addXP = useStore((s) => s.addXP);
  const pushActivity = useStore((s) => s.pushActivity);
  const user = useStore((s) => s.user);
  const studentName = user.scholarClass === 11 ? "Ishan" : "Neha";
  const appName = user.scholarClass === 11 ? "Ishan's Scholar" : "Neha's Scholar";
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const { transition, audioStatus, retrySound, stopTransition } = useScholarTransition();

  const STEPS = [
    { icon: GraduationCap, title: `Welcome, ${studentName}`, desc: `Your complete study operating system for Class ${user.scholarClass} CBSE is ready.`, color: "from-indigo-500 to-violet-500" },
    { icon: Target, title: "Set your goals", desc: "We'll track your streak, XP, and mastery across all your subjects.", color: "from-teal-500 to-emerald-500" },
    { icon: BookOpen, title: "Learn smarter", desc: "AI tutors, notes, flashcards, quizzes, practicals — all interconnected.", color: "from-rose-500 to-pink-500" },
    { icon: Trophy, title: "Stay motivated", desc: "Earn badges, coins, and climb the leaderboard. Have fun!", color: "from-amber-500 to-orange-500" },
  ];

  const finish = () => {
    stopTransition();
    setDone(true);
    addXP(50);
    pushActivity({ type: "onboarding", text: "Completed onboarding (+50 XP)", icon: "✨" });
    setTimeout(() => setOnboarded(true), 900);
  };

  const skipIntro = () => {
    stopTransition();
    setOnboarded(true);
  };

  const isLast = step === STEPS.length - 1;
  const cur = STEPS[step];

  return (
    <div className="min-h-screen grid place-items-center p-4 relative overflow-hidden bg-background">
      <div className="ambient-orb w-[30rem] h-[30rem] bg-indigo-500/20 -top-32 -left-32" />
      <div className="ambient-orb w-[30rem] h-[30rem] bg-teal-500/20 -bottom-32 -right-32" />

      <div className="w-full max-w-lg relative">
        {/* progress dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-8 bg-primary" : i < step ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted"}`} />
          ))}
        </div>

        {transition?.type === "login-intro" && audioStatus === "blocked" && (
          <div className="mb-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={retrySound} aria-label="Tap to enable intro sound">
              <Volume2 className="mr-1.5 h-3.5 w-3.5" /> Tap for sound
            </Button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="premium-card premium-shadow-lg p-8 text-center"
          >
            <div className={`mx-auto grid place-items-center h-16 w-16 rounded-2xl bg-gradient-to-br ${cur.color} text-white shadow-lg mb-5`}>
              <cur.icon className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">{cur.title}</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-sm mx-auto">{cur.desc}</p>

            <div className="flex items-center justify-between mt-7">
              <Button variant="ghost" size="sm" onClick={skipIntro} className="text-muted-foreground">
                Skip intro
              </Button>
              <div className="flex gap-2">
                {step > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                )}
                {!isLast ? (
                  <Button size="sm" onClick={() => setStep(step + 1)} className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white">
                    Next <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={finish} className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white">
                    {done ? <><Check className="h-4 w-4 mr-1" /> Done!</> : <>Start studying <Sparkles className="h-4 w-4 ml-1" /></>}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
