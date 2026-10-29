"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Brain, Check, ChevronRight, Clock3, Lightbulb, ListChecks, RotateCcw, Sparkles, Target, Zap } from "lucide-react";
import { ShowcaseSection, GlassPanel, PreviewLabel, FeatureLink, OrbitalArt } from "./primitives";
import styles from "./intelligence.module.css";

const lessonSteps = ["Understand", "Work it out", "Try a question"];
const lessonNotes = [
  ["Choose the object you are studying.", "Add forces with their directions.", "Net force changes velocity; it does not maintain it."],
  ["Applied force: 10 N to the right.", "Opposing friction: 2 N to the left.", "Net force: 8 N. For a 2 kg block, a = 4 m/s² right."],
  ["Write down the net force first.", "Divide by the mass, keeping units.", "Give the direction as well as the size."],
];

function AuroraPortrait() {
  return <div className={styles.auroraPortrait}>
    <div className={styles.auroraOrbit} aria-hidden="true" />
    <Image src="/lam/identity/avatars/aurora.webp" alt="Aurora, Scholar’s LAM learning companion" width={256} height={270} sizes="(max-width: 600px) 160px, 240px" className={styles.auroraImage} />
    <span className={styles.identity}><Sparkles size={13} aria-hidden="true" /> Aurora LAM</span>
  </div>;
}

/** An intentionally scripted, browser-local teaching sample. No AI request or student state. */
export function LamShowcase() {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [clarified, setClarified] = useState(false);
  const sampleId = useId();

  function chooseStep(next: number) {
    setStep(next);
    setClarified(false);
  }

  return <ShowcaseSection id="meet-lam" eyebrow="Meet LAM" title={<>Study inside an<br /><em>intelligent classroom.</em></>} description="Follow an idea from the first explanation to the moment it clicks. LAM brings concepts, worked examples, and thoughtful questions into one learning space.">
    <div className={styles.classroomLayout}>
      <GlassPanel className={styles.classroom}>
        <div className={styles.workspaceHeader}>
          <div className={styles.headingWithIcon}><span className={styles.icon}><Brain size={23} aria-hidden="true" /></span><div><h3>LAM teaching session</h3><p>Class 11 Physics · Laws of Motion</p></div></div>
          <span className={styles.badge}>One idea at a time</span>
        </div>
        <div className={styles.classroomStage}>
          <div className={styles.teacherRail}>
            <AuroraPortrait />
            <div className={styles.speech}>
              <Sparkles size={15} aria-hidden="true" />
              <p>{step === 0 ? "A force is a push or a pull. What matters for acceleration is the total force on the object." : step === 1 ? "Let’s keep the directions clear, find the net force, then use a = Fnet / m." : "Your turn. Start with the forces, then let the equation do the rest."}</p>
            </div>
            <span className={styles.scriptLabel}>Scripted lesson sample</span>
          </div>
          <div className={styles.lessonBoard}>
            <div className={styles.boardMeta}><span>NEWTON’S SECOND LAW</span><span>0{step + 1} / 03</span></div>
            <div className={styles.lessonContent} key={step}>
              {step === 0 && <>
                <h4>The force that changes motion.</h4>
                <p>An object accelerates in the direction of the <strong>net force</strong> acting on it. For a constant mass, doubling the net force doubles the acceleration.</p>
                <div className={styles.formulaHero}><span>F<sub>net</sub> = ma</span><small>net force = mass × acceleration</small></div>
                <div className={styles.forceDiagram} aria-label="Force diagram: 10 newtons to the right and 2 newtons to the left on a 2 kilogram block">
                  <span className={styles.leftForce}>← 2 N</span><span className={styles.block}>2 kg</span><span className={styles.rightForce}>10 N →</span>
                </div>
                <p className={styles.caption}>Opposing forces subtract. The larger force sets the net direction.</p>
              </>}
              {step === 1 && <>
                <h4>Two forces. One net effect.</h4>
                <p>A 2 kg block is pulled right with 10 N. Friction acts left with 2 N. What is its acceleration?</p>
                <ol className={styles.workedSteps}>
                  <li><span>1</span><div><strong>Choose right as positive.</strong><p>F<sub>net</sub> = +10 − 2 = +8 N</p></div></li>
                  <li><span>2</span><div><strong>Divide by the mass.</strong><p>a = F<sub>net</sub> / m = 8 / 2</p></div></li>
                  <li><span><Check size={14} aria-hidden="true" /></span><div><strong>a = 4 m/s² to the right.</strong><p>The acceleration follows the net force.</p></div></li>
                </ol>
              </>}
              {step === 2 && <>
                <h4>A quick check for understanding.</h4>
                <p id={`${sampleId}-question`}>A 3 kg block is pulled right with 15 N. Friction is 3 N to the left. What is the acceleration?</p>
                <div className={styles.answerOptions} role="group" aria-labelledby={`${sampleId}-question`}>
                  {["5 m/s² right", "4 m/s² right", "6 m/s² right"].map((label, index) => <button key={label} type="button" aria-pressed={answer === index} className={answer === index ? styles.selectedAnswer : ""} onClick={() => { setAnswer(index); setChecked(false); }}><span>{String.fromCharCode(65 + index)}</span>{label}</button>)}
                </div>
                <button type="button" className={styles.goldButton} disabled={answer === null} onClick={() => setChecked(true)}>Check my answer <ArrowRight size={15} aria-hidden="true" /></button>
                {checked && <div className={styles.feedback} data-correct={answer === 1} role="status"><strong>{answer === 1 ? "Exactly. You used the net force." : "Start with the total force, not just the pull."}</strong><p>15 − 3 = 12 N right. Then a = 12 / 3 = <strong>4 m/s² right</strong>. Friction reduces the acceleration.</p></div>}
              </>}
            </div>
          </div>
        </div>
        <div className={styles.sequence} aria-label="Explore the sample lesson">
          {lessonSteps.map((label, index) => <button type="button" key={label} aria-pressed={step === index} onClick={() => chooseStep(index)}><span>{index + 1}</span>{label}<ChevronRight size={14} aria-hidden="true" /></button>)}
        </div>
        <div className={styles.sampleFooter}><PreviewLabel>Interactive scripted sample · no live AI calls</PreviewLabel><FeatureLink href="/ai-tutor">Learn with LAM</FeatureLink></div>
      </GlassPanel>
      <div className={styles.companionPanels}>
        <GlassPanel className={styles.notesPanel}>
          <div className={styles.headingWithIcon}><BookOpen size={22} aria-hidden="true" /><h3>Keep the useful ideas.</h3></div>
          <p className={styles.panelDescription}>Notes stay beside the explanation, so the thread of your thinking stays intact.</p>
          <div className={styles.noteSheet}><span>LESSON NOTES</span><h4>Force & acceleration</h4><ul>{lessonNotes[step].map(note => <li key={note}>{note}</li>)}</ul><div className={styles.noteRule} /></div>
        </GlassPanel>
        <GlassPanel className={styles.formulaPanel}>
          <div className={styles.headingWithIcon}><Zap size={20} aria-hidden="true" /><h3>The key relation.</h3></div>
          <div className={styles.formulaStrip}>a = <span>F<sub>net</sub> / m</span></div><p>Newtons ÷ kilograms = metres per second squared.</p>
        </GlassPanel>
        <GlassPanel className={styles.clarifyPanel}>
          <div className={styles.headingWithIcon}><Lightbulb size={20} aria-hidden="true" /><h3>Follow your curiosity.</h3></div>
          <button type="button" className={styles.questionButton} aria-expanded={clarified} onClick={() => setClarified(value => !value)}>Why do we subtract friction?<ChevronRight size={16} aria-hidden="true" /></button>
          {clarified && <p className={styles.clarification} role="status">Forces have directions. Here friction points opposite the pull, so it has a negative sign when right is positive. Add the signed forces: +10 + (−2) = +8 N.</p>}
        </GlassPanel>
      </div>
    </div>
  </ShowcaseSection>;
}

const recallCards = [
  { prompt: "An object moves with constant velocity. What is the net force on it?", answer: "Zero. Constant velocity means zero acceleration, so Fnet = ma = 0." },
  { prompt: "The same net force acts on twice the mass. What happens to acceleration?", answer: "It halves. From a = Fnet / m, acceleration is inversely proportional to mass when net force is fixed." },
];
type PlanView = "plan" | "recall" | "repair";

/** A local planning example, deliberately separate from the real Exam Ready state. */
export function ExamReadyShowcase() {
  const [view, setView] = useState<PlanView>("plan");
  const [card, setCard] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [repairAnswer, setRepairAnswer] = useState<number | null>(null);
  const [repairChecked, setRepairChecked] = useState(false);
  const panelId = useId();
  const recall = recallCards[card];

  function changeCard(direction: number) {
    setCard(index => (index + direction + recallCards.length) % recallCards.length);
    setRevealed(false);
  }

  return <ShowcaseSection id="exam-ready" eyebrow="Scholar Exam Ready" title={<>Turn limited time into<br /><em>a smarter revision plan.</em></>} description="Choose your chapters, make room for practice, and return to the ideas that need attention. A focused path through preparation, with LAM beside you.">
    <div className={styles.examLayout}>
      <div className={styles.examSide}>
        <GlassPanel className={styles.purposePanel}>
          <Target size={26} className={styles.featureIcon} aria-hidden="true" /><h3>Practice with purpose.</h3><p>Use your answers to uncover the reasoning that needs another look.</p>
          <div className={styles.miniQuestion}><span>ILLUSTRATIVE CHECK</span><p>Constant speed, straight path. Does it need a forward net force?</p><div><span>Think</span><ArrowRight size={14} aria-hidden="true" /><span>Check</span><ArrowRight size={14} aria-hidden="true" /><span>Repair</span></div></div>
          <button type="button" className={styles.textButton} onClick={() => setView("repair")}>Try the misconception check <ArrowRight size={16} aria-hidden="true" /></button>
        </GlassPanel>
        <p className={styles.sideNote}><ListChecks size={17} aria-hidden="true" />A plan is a starting point. Checked answers provide the learning evidence.</p>
      </div>
      <GlassPanel className={styles.examWorkspace}>
        <div className={styles.workspaceHeader}><div className={styles.headingWithIcon}><span className={styles.icon}><Target size={22} aria-hidden="true" /></span><div><h3>Your exam plan</h3><p>Class 11 · Physics · illustrative preparation</p></div></div><span className={styles.badge}>Early Beta</span></div>
        <div className={styles.planTabs} aria-label="Explore the Exam Ready sample">{([['plan', 'Your plan'], ['recall', 'Recall'], ['repair', 'Repair a gap']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}</div>
        <div className={styles.planBody} key={view}>
          {view === "plan" && <>
            <div className={styles.timeSummary}><div className={styles.timeRing}><span>60<strong>min</strong></span></div><div><span className={styles.smallCaps}>A SAMPLE STUDY WINDOW</span><h4>Small steps.<br />A clear next move.</h4><p>Time is a budget, not a readiness score.</p></div></div>
            <div className={styles.nextAction}><span className={styles.nextIcon}><Sparkles size={20} aria-hidden="true" /></span><div><span>RECOMMENDED NEXT ACTION</span><strong>Understand net force.</strong><small>Learn the idea, then check it with a question.</small></div><ArrowRight size={20} aria-hidden="true" /></div>
            <div className={styles.priorityList}>
              {[{ title: "Laws of Motion", detail: "Concept + worked example", time: "25 min", width: "42%" }, { title: "Work, Energy & Power", detail: "Guided practice", time: "20 min", width: "33%" }, { title: "Units & Measurements", detail: "Quick recall", time: "15 min", width: "25%" }].map((chapter, index) => <div className={styles.priorityRow} key={chapter.title}><span className={styles.chapterNumber}>0{index + 1}</span><div><strong>{chapter.title}</strong><small>{chapter.detail}</small><span className={styles.timeBar}><i style={{ width: chapter.width }} /></span></div><span>{chapter.time}</span></div>)}
            </div>
          </>}
          {view === "recall" && <div className={styles.recallWorkspace}>
            <div className={styles.recallMeta}><span><BookOpen size={15} aria-hidden="true" /> ACTIVE RECALL</span><span>{card + 1} / {recallCards.length}</span></div>
            <div className={styles.flashcard} key={card}><span className={styles.smallCaps}>{revealed ? "THE REASONING" : "TRY TO RECALL FIRST"}</span><h4>{revealed ? recall.answer : recall.prompt}</h4><span className={styles.flashcardOrb} aria-hidden="true">✦</span></div>
            <div className={styles.flashcardControls}><button type="button" className={styles.squareButton} aria-label="Previous sample flashcard" onClick={() => changeCard(-1)}><ArrowLeft size={18} aria-hidden="true" /></button><button type="button" className={styles.goldButton} onClick={() => setRevealed(value => !value)}>{revealed ? "Show question" : "Reveal answer"}<Sparkles size={15} aria-hidden="true" /></button><button type="button" className={styles.squareButton} aria-label="Next sample flashcard" onClick={() => changeCard(1)}><ArrowRight size={18} aria-hidden="true" /></button></div>
            <p className={styles.caption}>A recall preview. Revealing an answer does not measure mastery.</p>
          </div>}
          {view === "repair" && <div className={styles.repairWorkspace}>
            <span className={styles.smallCaps}>REPAIR THE REASONING</span><h4>Motion does not always need a net force.</h4><p id={`${panelId}-repair`}>A puck moves in a straight line at constant velocity. The net force on it is:</p>
            <div className={styles.answerOptions} role="group" aria-labelledby={`${panelId}-repair`}>{["Zero", "Forward, to keep it moving", "Backward, because it is slowing"].map((label, index) => <button type="button" key={label} aria-pressed={repairAnswer === index} className={repairAnswer === index ? styles.selectedAnswer : ""} onClick={() => { setRepairAnswer(index); setRepairChecked(false); }}><span>{String.fromCharCode(65 + index)}</span>{label}</button>)}</div>
            <button type="button" className={styles.goldButton} disabled={repairAnswer === null} onClick={() => setRepairChecked(true)}>Check the reasoning <ArrowRight size={16} aria-hidden="true" /></button>
            {repairChecked && <div className={styles.feedback} data-correct={repairAnswer === 0} role="status"><strong>{repairAnswer === 0 ? "Yes. Zero acceleration means zero net force." : "Separate velocity from acceleration."}</strong><p>A force changes velocity. Here velocity stays constant, so a = 0 and F<sub>net</sub> = ma = 0. Individual forces may still exist, but they balance.</p><button type="button" className={styles.textButton} onClick={() => { setRepairAnswer(null); setRepairChecked(false); }}>Try again <RotateCcw size={14} aria-hidden="true" /></button></div>}
          </div>}
        </div>
        <div className={styles.sampleFooter}><PreviewLabel>Interactive sample · no preparation is saved</PreviewLabel><FeatureLink href="/exam-prep">Build your preparation</FeatureLink></div>
      </GlassPanel>
      <div className={styles.examSide}>
        <GlassPanel className={styles.recallPanel}>
          <Brain size={26} className={styles.featureIcon} aria-hidden="true" /><h3>Recall what matters.</h3><p>Bring a concept back to mind before you reveal the answer.</p>
          <button type="button" className={styles.miniFlashcard} onClick={() => { setView("recall"); setRevealed(false); }}><span>ACTIVE RECALL</span><strong>What changes<br />an object’s velocity?</strong><span>Open the flashcard <ArrowRight size={15} aria-hidden="true" /></span></button>
        </GlassPanel>
        <GlassPanel className={styles.weaknessPanel}><span className={styles.headingWithIcon}><Zap size={21} aria-hidden="true" /><h3>Fix the why.</h3></span><p>Revisit the misconception, understand the correction, and try again.</p><button type="button" className={styles.textButton} onClick={() => setView("repair")}>Explore weakness repair <ArrowRight size={16} aria-hidden="true" /></button></GlassPanel>
      </div>
    </div>
    <div className={styles.missionStrip}><span><BookOpen size={17} aria-hidden="true" />Learn</span><ChevronRight size={14} aria-hidden="true" /><span><Target size={17} aria-hidden="true" />Apply</span><ChevronRight size={14} aria-hidden="true" /><span><Brain size={17} aria-hidden="true" />Recall</span><ChevronRight size={14} aria-hidden="true" /><span><Zap size={17} aria-hidden="true" />Repair</span><span className={styles.missionNote}><Clock3 size={15} aria-hidden="true" />Make your available time count.</span></div>
    <OrbitalArt variant="quiet" className={styles.examOrbit} />
  </ShowcaseSection>;
}
