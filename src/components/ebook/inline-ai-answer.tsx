"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Clipboard,
  EyeOff,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/lib/shared";

export type InlineAIStatus =
  | "idle"
  | "loading"
  | "generated"
  | "saved"
  | "hidden"
  | "error"
  | "regenerating";

type InlineAIAnswerProps = {
  status: InlineAIStatus;
  answer?: string;
  error?: string;
  saved?: boolean;
  hasSavedRecord?: boolean;
  onGenerate: () => void;
  onSave: () => void;
  onRemove: () => void;
  onRegenerate: () => void;
  onHide: () => void;
  onShow: () => void;
  onCopy: () => void;
};

export function InlineAIAnswer({
  status,
  answer,
  error,
  saved,
  hasSavedRecord,
  onGenerate,
  onSave,
  onRemove,
  onRegenerate,
  onHide,
  onShow,
  onCopy,
}: InlineAIAnswerProps) {
  const reducedMotion = useReducedMotion();
  const busy = status === "loading" || status === "regenerating";
  const visible = status !== "idle" && status !== "hidden";

  if (status === "idle") {
    return (
      <Button
        size="sm"
        onClick={onGenerate}
        className="bg-indigo-500 hover:bg-indigo-600"
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate AI Answer
      </Button>
    );
  }

  if (status === "hidden") {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={onShow}
        className="border-white/10 bg-white/5"
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Show AI Answer
      </Button>
    );
  }

  return (
    <div className="basis-full">
      <AnimatePresence initial={false}>
        {visible && (
          <motion.div
            key="inline-answer"
            initial={reducedMotion ? false : { opacity: 0, height: 0, y: 8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={
              reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: 8 }
            }
            transition={{
              duration: reducedMotion ? 0 : 0.32,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.07] p-4 shadow-xl shadow-indigo-950/10">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />
                ) : saved ? (
                  <Check className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Sparkles className="h-4 w-4 text-indigo-300" />
                )}
                <p className="text-sm font-bold">
                  {busy
                    ? status === "regenerating"
                      ? "Regenerating answer…"
                      : "Generating answer…"
                    : saved
                      ? "Saved AI Answer"
                      : "AI Answer"}
                </p>
              </div>
              {busy && (
                <div
                  role="status"
                  className="py-6 text-center text-sm text-white/50"
                >
                  Using the printed page context…
                </div>
              )}
              {status === "error" && (
                <div role="alert" className="py-4">
                  <p className="text-sm text-rose-200">
                    {error ||
                      "The answer could not be generated. Please try again."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onGenerate}
                    className="mt-3 border-rose-300/20 bg-rose-500/10"
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
                  </Button>
                </div>
              )}
              {!busy && status !== "error" && answer && (
                <div className="prose prose-sm mt-4 max-w-none text-white/85 dark:prose-invert">
                  <Markdown content={answer} />
                </div>
              )}
              {!busy && status !== "error" && answer && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                  <Button
                    size="sm"
                    onClick={onSave}
                    disabled={saved}
                    className={
                      saved
                        ? "bg-emerald-600"
                        : "bg-indigo-500 hover:bg-indigo-600"
                    }
                  >
                    {saved ? (
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                    ) : (
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {saved ? "Saved" : hasSavedRecord ? "Update Saved Answer" : "Save Answer"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRegenerate}
                    className="border-white/10 bg-white/5"
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onCopy}
                    className="border-white/10 bg-white/5"
                  >
                    <Clipboard className="mr-1.5 h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onHide}>
                    <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hide
                  </Button>
                  {hasSavedRecord && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onRemove}
                      className="text-rose-300"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove Saved
                      Answer
                    </Button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
