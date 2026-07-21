"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, Share, Plus, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "scholar-pwa-install-dismissed-at";
const DISMISS_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 days

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if already installed
    const installed = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    queueMicrotask(() => {
      setIsInstalled(Boolean(installed));
      setIsIOS(ios);
    });
    if (installed) {
      return;
    }

    // Detect iOS
    // Listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Check if we should show the prompt
    const checkTiming = () => {
      if (ios) {
        // For iOS, show after 2 visits
        const visits = parseInt(localStorage.getItem("scholar-visits") || "0", 10);
        localStorage.setItem("scholar-visits", String(visits + 1));
        if (visits >= 1) {
          const dismissed = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
          if (Date.now() - dismissed > DISMISS_COOLDOWN) {
            setTimeout(() => setShowPrompt(true), 8000);
          }
        }
      } else if (deferredPrompt) {
        const dismissed = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
        if (Date.now() - dismissed > DISMISS_COOLDOWN) {
          const visits = parseInt(localStorage.getItem("scholar-visits") || "0", 10);
          localStorage.setItem("scholar-visits", String(visits + 1));
          if (visits >= 1) {
            setTimeout(() => setShowPrompt(true), 8000);
          }
        }
      }
    };

    checkTiming();

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [deferredPrompt]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      setShowPrompt(false);
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  if (isInstalled) return null;

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          key="pwa-install-banner"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed left-3 right-3 z-[60] lg:left-auto lg:right-6 lg:bottom-6 lg:w-80"
          style={{ bottom: "calc(80px + var(--safe-area-bottom))" }}
        >
          <div
            className="rounded-2xl border border-white/15 p-4"
            style={{
              background: "rgba(15, 15, 20, 0.88)",
              backdropFilter: "blur(30px) saturate(1.5)",
              WebkitBackdropFilter: "blur(30px) saturate(1.5)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.1)",
            }}
          >
            <div className="flex items-start gap-3">
              <div className="grid place-items-center h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-teal-500 shrink-0">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">Install Scholar</h3>
                <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                  Get faster access, fullscreen study mode, and a more app-like experience.
                </p>
              </div>
              <button onClick={handleDismiss} className="p-1 text-white/40 hover:text-white shrink-0" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-teal-500 text-white font-medium"
              >
                <Download className="h-4 w-4" /> Install
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm hover:text-white"
              >
                Not now
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* iOS Installation Guide */}
      <AnimatePresence key="pwa-ios-guide">
        {showIOSGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowIOSGuide(false)}
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm grid place-items-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/15 bg-zinc-950/95 backdrop-blur-xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Install on iPhone</h3>
                <button onClick={() => setShowIOSGuide(false)} className="p-1 text-white/40 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="grid place-items-center h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-bold shrink-0">1</div>
                  <div className="flex-1">
                    <p className="text-sm text-white/80">Tap the <strong>Share</strong> button</p>
                    <Share className="h-4 w-4 text-indigo-300 mt-1" />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="grid place-items-center h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-bold shrink-0">2</div>
                  <div className="flex-1">
                    <p className="text-sm text-white/80">Tap <strong>Add to Home Screen</strong></p>
                    <Plus className="h-4 w-4 text-indigo-300 mt-1" />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="grid place-items-center h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-bold shrink-0">3</div>
                  <div className="flex-1">
                    <p className="text-sm text-white/80">Tap <strong>Add</strong> to confirm</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setShowIOSGuide(false); handleDismiss(); }}
                className="w-full mt-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-teal-500 text-white text-sm font-medium"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
