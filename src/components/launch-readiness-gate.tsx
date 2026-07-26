"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap } from "lucide-react";
import { BACKGROUND_READY_EVENT } from "@/components/ready-background-video";

const MINIMUM_VISUAL_MS = 1_400;
const NORMAL_MAXIMUM_MS = 3_800;
const EMERGENCY_TIMEOUT_MS = 7_000;

export function LaunchReadinessGate({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [message, setMessage] = useState("Restoring your Scholar profile");

  useEffect(() => {
    const startedAt = performance.now();
    let fontsReady = false;
    let interfaceReady = false;
    let backgroundReady = false;
    let closed = false;
    let minimumElapsed = false;

    const revealIfReady = () => {
      if (closed || !minimumElapsed || !fontsReady || !interfaceReady || !backgroundReady) return;
      closed = true;
      setMessage("Scholar is ready");
      window.setTimeout(() => setVisible(false), 120);
    };
    const markBackgroundReady = () => {
      backgroundReady = true;
      setMessage("Preparing your workspace");
      revealIfReady();
    };
    window.addEventListener(BACKGROUND_READY_EVENT, markBackgroundReady, { once: true });

    void document.fonts.ready.finally(() => {
      fontsReady = true;
      setMessage("Loading your academic workspace");
      revealIfReady();
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        interfaceReady = true;
        revealIfReady();
      });
    });

    const minimumTimer = window.setTimeout(() => {
      minimumElapsed = true;
      revealIfReady();
    }, MINIMUM_VISUAL_MS);
    const normalTimer = window.setTimeout(() => {
      backgroundReady = true;
      revealIfReady();
    }, Math.max(MINIMUM_VISUAL_MS, NORMAL_MAXIMUM_MS - (performance.now() - startedAt)));
    const emergencyTimer = window.setTimeout(() => {
      if (closed) return;
      closed = true;
      setVisible(false);
    }, EMERGENCY_TIMEOUT_MS);

    return () => {
      closed = true;
      window.removeEventListener(BACKGROUND_READY_EVENT, markBackgroundReady);
      window.clearTimeout(minimumTimer);
      window.clearTimeout(normalTimer);
      window.clearTimeout(emergencyTimer);
    };
  }, []);

  return (
    <>
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            key="scholar-launch-gate"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[10000] grid place-items-center overflow-hidden bg-[#03050a]"
            role="status"
            aria-live="polite"
            aria-label={message}
          >
            <img src="/backgrounds/scholar-poster.svg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-65" />
            <div className="absolute inset-0 bg-black/35" />
            <div className="relative flex flex-col items-center px-6 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur-xl"
              >
                <GraduationCap className="h-8 w-8" />
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 text-2xl font-semibold tracking-tight text-white">
                Scholar
              </motion.h1>
              <p className="mt-2 min-h-5 text-sm text-white/60">{message}</p>
              <div className="mt-5 h-1 w-52 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300"
                  initial={{ x: "-100%" }}
                  animate={{ x: "260%" }}
                  transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
