"use client";
import { ArrowLeft, Check, LockKeyhole, Sparkles } from "lucide-react";
import type { ScholarEntitlement } from "@/lib/subscriptions/entitlements";
import { GlassSurface } from "@/components/liquid-glass/glass-surface";
import type { ReactNode } from "react";

const capabilities: Partial<Record<ScholarEntitlement, string[]>> = {
  premium_experiments: ["Control interactive instruments", "Take measurements and repeat trials", "Complete guided experiments"],
  slideshow_generation_plus: ["Turn notes, chapters or PDFs into slides", "Choose layouts and presentation density", "Preview, edit and export your presentation"],
  levels: ["Explore your learning progression", "Track milestones and achievements", "See your next learning challenge"],
  scholar_intelligence: ["Review learning evidence", "Find weak areas worth revisiting", "Choose a focused next step"],
  aisig: ["Describe an educational visual", "Refine your study-image prompt", "Generate a visual study aid"],
  homework_scanner: ["Upload a homework image", "Extract questions from the page", "Get guided hints and explanations"],
  workspace_ai: ["Use AI within your workspace", "Explain and summarize study material", "Keep your work in context"],
  python_workspace: ["Write and run Python exercises", "Work with chapter-related examples", "Save your coding work"],
  practical_lab: ["Explore practical activities", "Follow structured experiment guidance", "Review observations and concepts"],
  derivation_library: ["Explore step-by-step derivations", "Review assumptions and formulas", "Revise the reasoning behind results"],
};
export type PreviewProps = { entitlement: ScholarEntitlement; title: string; description: string; anchor?: string; onBack?: () => void; featureBullets?: string[]; visualPreview?: ReactNode; ctaLabel?: string };
/** Capability preview, never a fake live dashboard or a client access grant. */
export function PlusFeaturePreview({ entitlement, title, description, anchor, onBack, featureBullets, visualPreview, ctaLabel = "Explore Scholar Plus" }: PreviewProps) {
  const items = featureBullets ?? capabilities[entitlement] ?? ["Open the complete learning workspace", "Use its guided study tools", "Keep your existing Scholar work"];
  return <section className="relative mx-auto w-full max-w-3xl py-6 sm:py-12" aria-label={`${title} preview`}>
    <GlassSurface material="elevated" radius={28} className="p-6 sm:p-10">
      <div className="flex items-center gap-3"><span className="rounded-2xl border border-cyan-200/25 bg-cyan-200/10 p-3 text-cyan-100"><LockKeyhole size={22} /></span><span className="text-xs font-semibold uppercase tracking-widest text-cyan-100">Scholar Plus · Feature preview</span></div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">{description}</p>
      {visualPreview && <div className="mt-5" aria-label="Illustrative feature preview">{visualPreview}</div>}
      <h2 className="mt-7 text-sm font-medium text-white">Inside this workspace</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">{items.map((item, i) => <li key={item} className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/10 to-white/[.02] p-4 text-sm leading-6 text-slate-200"><span className="mb-3 flex items-center gap-2 text-cyan-200"><Check size={16} />0{i + 1}</span>{item}</li>)}</ul>
      <p className="mt-6 text-xs leading-6 text-slate-400">Included with Scholar Plus. Your existing saved work stays yours; viewing this preview does not change your plan.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="sg-cta-primary inline-flex min-h-11 items-center gap-2 rounded-full px-5" onClick={() => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "plus", anchor } }))}><Sparkles size={16} />{ctaLabel}</button>
        <button className="sg-cta-quiet inline-flex min-h-11 items-center gap-2 rounded-full px-5" onClick={onBack ?? (() => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "dashboard" } })))}><ArrowLeft size={16} /> Back to Scholar</button>
      </div>
    </GlassSurface>
  </section>;
}
