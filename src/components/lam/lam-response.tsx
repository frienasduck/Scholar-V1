"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";
import { ScholarAIContent } from "@/components/ai/scholar-ai-content";
import { animateLamResponseReveal } from "@/lib/animation/lam-animations";
import { resolveScholarAnimationQuality } from "@/lib/animation/animation-preferences";
import { parseLamTextBlocks } from "@/lib/lam/schemas";

export const LamResponse = memo(function LamResponse({ content, optimized = false, streaming = false }: { content: string; optimized?: boolean; streaming?: boolean }) {
  const blocks = useMemo(() => parseLamTextBlocks(content), [content]);
  const firstHeading = blocks.find((block) => block.type === "heading");
  const rootRef = useRef<HTMLDivElement>(null);
  const quality = useMemo(() => resolveScholarAnimationQuality({ forceQuality: optimized ? "mobile-optimized" : undefined }), [optimized]);

  useEffect(() => {
    if (!rootRef.current) return;
    return animateLamResponseReveal(rootRef.current, quality);
  }, [quality]);

  return <div ref={rootRef} className="space-y-3">
    <div data-lam-reveal="heading" className="mb-3 flex items-center gap-2 border-b border-white/8 pb-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-violet-300/10 text-violet-100"><Sparkles className="h-3.5 w-3.5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-violet-100/55">LAM answer</p><h2 className="text-base font-extrabold tracking-tight text-white">{firstHeading?.type === "heading" ? firstHeading.content : "Here’s what you need to know"}</h2></div></div>
    {blocks.map((block, index) => {
      if (block.type === "heading") return index === blocks.indexOf(firstHeading!) ? null : <h3 data-lam-reveal="block" key={index} className="pt-2 text-sm font-bold tracking-tight text-white">{block.content}</h3>;
      if (block.type === "bullets") return <ul data-lam-reveal="block" key={index} className="space-y-1 pl-4 text-sm text-white/82">{block.items.map((item) => <li key={item} className="list-disc"><ScholarAIContent content={item} mode="compact" streaming={streaming} /></li>)}</ul>;
      if (block.type === "formula") return <div data-lam-reveal="equation" key={index} className="rounded-xl border border-amber-300/15 bg-amber-300/8 p-3"><ScholarAIContent content={block.expression} mode="compact" streaming={streaming} /></div>;
      if (block.type === "definition") return <div data-lam-reveal="block" key={index} className="rounded-xl border border-cyan-300/15 bg-cyan-300/8 p-3"><strong>{block.term}</strong><ScholarAIContent content={block.meaning} mode="compact" streaming={streaming} className="mt-1 text-white/72" /></div>;
      if (block.type === "progress") return <div data-lam-reveal="block" key={index}><div className="mb-1 flex justify-between text-xs"><span>{block.label}</span><span>{block.value}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><i className="block h-full rounded-full bg-cyan-300" style={{ width: `${block.value}%` }} /></div></div>;
      if (block.type === "text") return <div data-lam-reveal="block" key={index}><ScholarAIContent content={block.content} streaming={streaming} /></div>;
      return null;
    })}
  </div>;
});
