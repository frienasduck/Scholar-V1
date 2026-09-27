"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Plus, Share, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
const DISMISS_KEY = "scholar-pwa-install-dismissed-at";
const INSTALLED_KEY = "scholar-pwa-installed";
const VISITS_KEY = "scholar-visits";
const DEFAULT_COOLDOWN = 14 * 24 * 60 * 60 * 1000;

function readStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private mode / denied storage */ }
}

export function PWAInstallPrompt() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const promptTimer = useRef<number | null>(null);
  const guideRef = useRef<HTMLElement | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isIOS] = useState(() => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent));
  const [installed, setInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone) || readStorage(INSTALLED_KEY) === "true";
  });

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) writeStorage(INSTALLED_KEY, "true");
    const previousVisits = Number(readStorage(VISITS_KEY) || 0);
    const visits = (Number.isFinite(previousVisits) ? previousVisits : 0) + 1;
    writeStorage(VISITS_KEY, String(visits));

    const schedulePrompt = () => {
      if (promptTimer.current !== null) window.clearTimeout(promptTimer.current);
      promptTimer.current = window.setTimeout(() => {
        promptTimer.current = null;
        setShowPrompt(true);
      }, 1800);
    };

    const eligible = () => {
      if (standalone || readStorage(INSTALLED_KEY) === "true") return false;
      const dismissed = Number(readStorage(DISMISS_KEY) || 0);
      return Date.now() - dismissed >= DEFAULT_COOLDOWN && visits >= 2;
    };
    const beforeInstall = (event: Event) => { event.preventDefault(); deferredPrompt.current = event as BeforeInstallPromptEvent; if (eligible()) schedulePrompt(); };
    const installedEvent = () => { writeStorage(INSTALLED_KEY, "true"); deferredPrompt.current = null; setInstalled(true); setShowPrompt(false); setShowGuide(false); };
    const manual = () => { if (standalone) return; if (deferredPrompt.current) setShowPrompt(true); else setShowGuide(true); };
    const suppress = () => setShowPrompt(false);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installedEvent);
    window.addEventListener("scholar:install-app", manual);
    window.addEventListener("scholar:plus-popup-open", suppress);
    if (isIOS && eligible()) schedulePrompt();
    return () => {
      if (promptTimer.current !== null) window.clearTimeout(promptTimer.current);
      promptTimer.current = null;
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installedEvent);
      window.removeEventListener("scholar:install-app", manual);
      window.removeEventListener("scholar:plus-popup-open", suppress);
    };
  }, [isIOS]);

  useEffect(() => {
    if (!showGuide) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      guideRef.current?.querySelector<HTMLElement>("button")?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowGuide(false);
        writeStorage(DISMISS_KEY, String(Date.now()));
        return;
      }
      if (event.key !== "Tab" || !guideRef.current) return;
      const controls = Array.from(guideRef.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])"))
        .filter((element) => !element.hasAttribute("disabled"));
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [showGuide]);

  const dismiss = () => { setShowPrompt(false); setShowGuide(false); writeStorage(DISMISS_KEY, String(Date.now())); };
  const install = async () => {
    if (!deferredPrompt.current) { setShowPrompt(false); setShowGuide(true); return; }
    const prompt = deferredPrompt.current;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") { writeStorage(INSTALLED_KEY, "true"); setInstalled(true); }
      else writeStorage(DISMISS_KEY, String(Date.now()));
    } catch {
      setShowGuide(true);
    } finally {
      deferredPrompt.current = null;
      setShowPrompt(false);
    }
  };
  if (installed) return null;
  return <AnimatePresence>
    {showPrompt && <motion.aside key="scholar-install" initial={{ y: 30, opacity: 0, scale: .96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: .97 }} className="fixed inset-x-3 z-[10050] mx-auto max-w-sm rounded-[1.6rem] border border-white/15 bg-[#09111c]/85 p-4 text-white shadow-2xl backdrop-blur-2xl lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0" style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }} aria-label="Install Scholar">
      <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400"><Smartphone className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Install Scholar</h2><p className="mt-1 text-xs leading-5 text-white/55">Open Scholar faster and use it like an app.</p></div><button type="button" onClick={dismiss} aria-label="Close install prompt" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/40 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div>
      <div className="mt-4 flex gap-2"><button onClick={install} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-semibold text-black"><Download className="h-4 w-4" /> Install</button><button onClick={dismiss} className="rounded-full border border-white/10 px-4 text-sm text-white/60">Not now</button></div>
    </motion.aside>}
    {showGuide && <motion.div key="install-guide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10060] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={dismiss}><motion.section ref={guideRef} role="dialog" aria-modal="true" aria-labelledby="scholar-install-guide-title" initial={{ scale: .96 }} animate={{ scale: 1 }} onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-[1.75rem] border border-white/15 bg-[#07101a] p-6 text-white shadow-2xl"><div className="flex items-center justify-between gap-3"><h2 id="scholar-install-guide-title" className="text-lg font-semibold">Install Scholar</h2><button type="button" onClick={dismiss} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-white/10" aria-label="Close instructions"><X className="h-4 w-4" /></button></div>{isIOS ? <ol className="mt-5 space-y-4 text-sm text-white/70"><li className="flex gap-3"><Share className="h-5 w-5 text-cyan-200" />1. Open the browser Share menu.</li><li className="flex gap-3"><Plus className="h-5 w-5 text-cyan-200" />2. Choose Add to Home Screen.</li><li>3. Confirm Add.</li></ol> : <p className="mt-4 text-sm leading-6 text-white/65">Your browser has not offered an installation prompt. Open its app or page menu and choose Install Scholar or Install app when available.</p>}<button type="button" onClick={dismiss} className="mt-6 min-h-11 w-full rounded-full bg-white py-2.5 font-semibold text-black">Got it</button></motion.section></motion.div>}
  </AnimatePresence>;
}
