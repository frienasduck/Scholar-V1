"use client";
import { ArrowLeft, ArrowRight, ChartNoAxesColumnIncreasing, Goal, LockKeyhole, NotebookText, Sparkles } from "lucide-react";
import type { ScholarEntitlement } from "@/lib/subscriptions/entitlements";
import { useId, type ReactNode } from "react";
import styles from "./plus-feature-preview.module.css";

const capabilities: Partial<Record<ScholarEntitlement, string[]>> = {
  study_music_ad_free: ["Choose your study soundtrack", "Keep your songs and playlists", "Focus with native ambience"],
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
  assignments: ["Organise your assignments", "Develop your answers", "Review and improve your work"],
  formula_explorer: ["Explore chapter formulas", "Understand every symbol", "Put formulas into practice"],
  lam_ai: ["Learn with a contextual tutor", "Break down difficult concepts", "Choose your next learning step"],
};
const details: Partial<Record<ScholarEntitlement, string[]>> = {
  study_music_ad_free: ["Listen with Scholar's compact music controller and supported YouTube source player.", "Organise favorites, imported tracks and queues without losing your saved library.", "Pair study sessions with focus timers and original rain, ocean and noise textures."],
  scholar_intelligence: ["See the bigger picture from all your saved work, organised intelligently.", "Spot gaps and patterns so you know where to focus next.", "Get tailored suggestions to keep your learning on track and moving forward."],
  levels: ["Follow your progress as your study activity builds over time.", "See the milestones and achievements along your learning journey.", "Find the next goal to work towards, one focused step at a time."],
  assignments: ["Keep your chapter tasks and assignment work together in one place.", "Use a structured workflow to plan and develop your responses.", "Return to your saved work and refine it before submission."],
  practical_lab: ["Discover activities connected to the concepts you are studying.", "Work through procedures, measurements and observations.", "Connect the results of a practical to its underlying theory."],
  derivation_library: ["Follow the reasoning behind an equation, one step at a time.", "Understand the conditions and assumptions used in each result.", "Revisit the important steps and practise their application."],
  formula_explorer: ["Find the relationships and equations for your chapter.", "Read the meaning of each quantity and when the formula applies.", "Build understanding with focused, formula-based questions."],
  python_workspace: ["Use an interactive Python environment for your coding practice.", "Learn with examples connected to your chapter and syllabus.", "Return to your saved code and continue where you left off."],
  premium_experiments: ["Explore an experiment through its interactive controls.", "Compare observations as you adjust variables and repeat a trial.", "Follow a structured activity and understand what its results mean."],
  slideshow_generation_plus: ["Start with your study material and build a structured presentation.", "Shape the layout and detail to suit the lesson you want to share.", "Review your slides, make changes and export your finished work."],
  aisig: ["Start with the concept, diagram or visual you want to explain.", "Add context and detail to make your educational prompt clearer.", "Create an image to support your understanding and revision."],
  homework_scanner: ["Bring a clear photo of the questions you are working through.", "Read the extracted questions and check the source material.", "Work through doubts with hints and step-by-step explanations."],
  workspace_ai: ["Keep intelligent study tools alongside your learning material.", "Break down a difficult idea or revisit the essentials.", "Continue learning without losing the context of your work."],
  lam_ai: ["Ask questions with the context of your learning material.", "Explore explanations, examples and guided follow-up questions.", "Keep working on the concepts you want to understand better."],
};
const defaultDetails = ["Bring the tools and material for this section into one focused workspace.", "Work through the section's study tools at your own pace.", "Your saved Scholar work stays yours on every plan."];
const cardIcons = [NotebookText, ChartNoAxesColumnIncreasing, Goal];
export type PreviewProps = { entitlement: ScholarEntitlement; title: string; description: string; anchor?: string; onBack?: () => void; featureBullets?: string[]; visualPreview?: ReactNode; ctaLabel?: string };
/** Capability preview, never a fake live dashboard or a client access grant. */
export function PlusFeaturePreview({ entitlement, title, description, anchor, onBack, featureBullets, visualPreview, ctaLabel = "Explore Scholar Plus" }: PreviewProps) {
  const instanceId = useId();
  const edgeId = `${instanceId}-edge`;
  const items = featureBullets ?? capabilities[entitlement] ?? ["Open the complete learning workspace", "Use its guided study tools", "Keep your existing Scholar work"];
  const descriptions = featureBullets ? defaultDetails : details[entitlement] ?? defaultDetails;
  return <section className={styles.preview} aria-label={`${title} preview`} data-plus-preview={entitlement}>
    <div className={styles.shell}>
      <svg className={styles.filaments} viewBox="0 0 1500 860" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs><linearGradient id={edgeId} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b38c54" stopOpacity="0" /><stop offset=".55" stopColor="#a78350" stopOpacity=".35" /><stop offset=".8" stopColor="#f2d5a1" /><stop offset="1" stopColor="#aa8755" stopOpacity=".1" /></linearGradient></defs>
        <g fill="none" stroke={`url(#${edgeId})`} strokeWidth="1">
          <path d="M1250 -80 C1130 30 1210 230 1490 248" />
          <path d="M1510 90 C1310 170 1270 235 1230 350" />
          <path d="M-90 630 C170 640 220 795 325 930" />
          <path d="M1560 550 C1440 620 1330 750 1305 900" />
          <path d="M1130 890 C1280 840 1430 865 1560 690" />
        </g>
      </svg>
      <div className={styles.content}>
        <div className={styles.eyebrow}>
          <span className={styles.lockBadge}><LockKeyhole aria-hidden="true" /></span>
          <p><span>Scholar Plus</span><span className={styles.labelDot} aria-hidden="true">·</span><span className={styles.previewLabel}>Feature preview</span></p>
          <span className={styles.headerLine} aria-hidden="true" />
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        {visualPreview && <div className={styles.visualPreview} aria-label="Illustrative feature preview">{visualPreview}</div>}
        <ul className={styles.cards} aria-label="Inside this workspace">{items.map((item, i) => {
          const Icon = cardIcons[i % cardIcons.length];
          return <li key={item} className={styles.card}>
            <div className={styles.cardTop}><span className={styles.iconBadge}><Icon aria-hidden="true" /></span><span className={styles.cardLine} aria-hidden="true" /><span className={styles.number} aria-hidden="true">{String(i + 1).padStart(2, "0")}</span></div>
            <h2>{item}</h2><p>{descriptions[i] ?? defaultDetails[i % defaultDetails.length]}</p>
          </li>;
        })}</ul>
        <div className={styles.divider} aria-hidden="true"><span /><i /><span /></div>
        <p className={styles.notice}>Included with Scholar Plus. Your existing saved work stays yours; viewing this preview does not change your plan.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "plus", anchor } }))}><Sparkles aria-hidden="true" /><span>{ctaLabel}</span><ArrowRight aria-hidden="true" /></button>
          <button type="button" className={styles.secondary} onClick={onBack ?? (() => window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId: "dashboard" } })))}><ArrowLeft aria-hidden="true" /><span>Back to Scholar</span></button>
        </div>
      </div>
    </div>
  </section>;
}
