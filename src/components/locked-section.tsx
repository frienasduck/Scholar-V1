"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  ChevronDown,
  Eye,
  EyeOff,
  Mail,
  Loader2,
  ShieldCheck,
  X,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/notifications/notification-api";

const SEE_WHY_REASONS = [
  "Beta development — the feature is being actively built and tested.",
  "Experimental features — new capabilities being validated before release.",
  "Feature testing — the section is undergoing quality assurance.",
  "Active updates — a significant update is in progress.",
  "Bug investigation — known issues are being resolved.",
  "Backend migration — the underlying data or API layer is being restructured.",
  "Rebuilding — the section is being redesigned from the ground up.",
  "Renovation — visual and interaction improvements are underway.",
  "Performance testing — load and speed are being optimised.",
  "Temporary maintenance — routine work to keep the feature reliable.",
  "Quality assurance — thorough testing before public availability.",
  "Feature replacement — an improved version is being prepared.",
  "Integration testing — ensuring compatibility with other Scholar systems.",
  "Security testing — validating protections for user data and privacy.",
  "Internal developer tools — part of the internal build and diagnostic environment.",
  "Not yet ready for public release — still in the internal pipeline.",
];

interface LockedSectionProps {
  /** The title of the section that is locked */
  sectionTitle: string;
  /** The gradient class to use for the blurred background */
  gradientClass?: string;
}

export function LockedSection({ sectionTitle, gradientClass }: LockedSectionProps) {
  const devMode = useStore((s) => s.devMode);
  const [seeWhyOpen, setSeeWhyOpen] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If developer is already unlocked, this component should not render
  // (the parent handles this check). But just in case:
  if (devMode) return null;

  const handleUnlock = useCallback(async () => {
    if (!password.trim()) {
      setError("Enter the developer password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/developer/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Access denied.");
      useStore.getState().setDevMode(true);
      window.dispatchEvent(new Event("scholar:session-changed"));
      toast.success("Developer access granted", {
        description: `You now have access to ${sectionTitle}.`,
      });
      setPassword("");
      setShowUnlock(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Access denied.");
    } finally {
      setLoading(false);
    }
  }, [password, sectionTitle]);

  return (
    <div className="relative min-h-[70vh] w-full overflow-hidden rounded-[2rem]">
      {/* Blurred background layer */}
      <div
        className={cn(
          "absolute inset-0 scale-110 blur-xl opacity-30",
          gradientClass || "bg-gradient-to-br from-indigo-500/20 via-background to-teal-500/20"
        )}
      />
      {/* Dark translucent overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[70vh] px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg"
        >
          {/* Glass card */}
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#080d16]/80 shadow-2xl backdrop-blur-2xl">
            {/* Subtle glow border */}
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] border border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]" />

            <div className="px-6 pt-8 pb-6 sm:px-8 sm:pt-10 sm:pb-8 text-center">
              {/* Status badge */}
              <div className="flex justify-center mb-5">
                <Badge className="inline-flex items-center gap-1.5 border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                  <Lock className="h-2.5 w-2.5" />
                  Developer Only
                </Badge>
              </div>

              {/* Lock icon */}
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_0_40px_rgba(99,102,241,0.12)]">
                <Lock className="h-7 w-7 text-white/70" />
              </div>

              {/* Heading */}
              <h2 className="mt-5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Developer Access Required
              </h2>

              {/* Primary message */}
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                This section of Scholar is currently restricted to the developer.
              </p>

              {/* Secondary explanation */}
              <p className="mt-2 text-xs leading-relaxed text-white/40">
                Access is locked while this area is being developed, tested,
                updated, rebuilt, or temporarily maintained.
              </p>

              {/* Separator */}
              <div className="mt-6 border-t border-white/[0.06]" />

              {/* See why expandable */}
              <div className="mt-0">
                <button
                  type="button"
                  onClick={() => setSeeWhyOpen(!seeWhyOpen)}
                  className="flex w-full items-center justify-between px-0 py-3 text-sm font-medium text-white/70 hover:text-white/90 transition-colors"
                >
                  <span>See why</span>
                  <motion.span
                    animate={{ rotate: seeWhyOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {seeWhyOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-4">
                        <p className="text-xs leading-relaxed text-white/50 mb-3">
                          This section is currently part of Scholar&apos;s internal
                          development environment. Features may be unfinished,
                          experimental, under testing, temporarily unavailable, being
                          rebuilt, or scheduled for removal or redesign.
                        </p>
                        <div className="space-y-1.5">
                          {SEE_WHY_REASONS.map((reason) => (
                            <div key={reason} className="flex items-start gap-2 text-[11px] text-white/35">
                              <span className="mt-1 h-1 w-1 rounded-full bg-white/20 shrink-0" />
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>

                        {/* Developer Unlock */}
                        <div className="mt-4 pt-4 border-t border-white/[0.06]">
                          <button
                            type="button"
                            onClick={() => setShowUnlock(!showUnlock)}
                            className="flex w-full items-center justify-between text-xs font-medium text-white/50 hover:text-white/70 transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="h-3 w-3" />
                              Developer Unlock
                            </span>
                            <motion.span
                              animate={{ rotate: showUnlock ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </motion.span>
                          </button>

                          <AnimatePresence>
                            {showUnlock && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 space-y-3">
                                  <div className="relative">
                                    <Input
                                      type={showPassword ? "text" : "password"}
                                      value={password}
                                      onChange={(e) => {
                                        setPassword(e.target.value);
                                        setError(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !loading) handleUnlock();
                                      }}
                                      placeholder="Developer password"
                                      className="h-10 rounded-xl border-white/10 bg-white/[0.04] pr-10 text-sm text-white placeholder:text-white/25 focus:border-white/20 focus:ring-0"
                                      disabled={loading}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowPassword(!showPassword)}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                      tabIndex={-1}
                                    >
                                      {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                      ) : (
                                        <Eye className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>

                                  {error && (
                                    <motion.div
                                      initial={{ opacity: 0, y: -4 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300"
                                    >
                                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                      {error}
                                    </motion.div>
                                  )}

                                  <Button
                                    onClick={handleUnlock}
                                    disabled={loading || !password.trim()}
                                    className="w-full h-10 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-40"
                                  >
                                    {loading ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Unlock Section"
                                    )}
                                  </Button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Contact Developer */}
                        <div className="mt-4 pt-4 border-t border-white/[0.06]">
                          <p className="text-[11px] text-white/35 mb-2">
                            Have a question about this section or want to report an
                            issue?
                          </p>
                          <a
                            href="/help"
                            className="flex items-center justify-center gap-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Scholar support
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
