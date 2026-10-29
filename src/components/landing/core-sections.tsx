"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Atom, BookOpen, Brain, ChartNoAxesColumnIncreasing, Check, Clock3, Headphones, Lightbulb, Pause, Play, RotateCcw, Sparkles, Target, Timer, TriangleAlert } from "lucide-react";
import { ShowcaseSection, GlassPanel, PreviewLabel, FeatureLink, OrbitalArt } from "./primitives";
import { chapterExamples, checkPractice, practiceExamples } from "./demo-data";
import s from "./landing.module.css";

export function ScholarExperience() {
  const [summary, setSummary] = useState(false);
  return <ShowcaseSection id="experience" eyebrow="The Scholar Experience" title={<>A learning system <em>designed to flow.</em></>} description="A place for your questions, your ideas, and your next breakthrough. Bring the parts of studying together.">
    <div className={s.horizon} aria-hidden="true" />
    <div className={s.grid3}>
      <GlassPanel className={s.ecosystemCard}>
        <div className={s.panelHeader}><span className={s.icon}><Brain size={24} /></span><div className={s.tags}><span>Contextual</span><span>Step by step</span></div></div>
        <h3 className={s.featureTitle}>AI tutors</h3><p className={s.muted}>Explore a concept, ask a follow-up, and find another way to understand it.</p>
        <div className={s.ecosystemVisual}><Image src="/lam/identity/avatars/aurora.webp" width={180} height={190} alt="Aurora, Scholar’s LAM companion" className={s.tutorArt} sizes="180px" loading="lazy" /><div className={s.bubble}>Let’s break this down.<br /><strong>What changes when the net force doubles?</strong></div><p className={s.tiny} style={{position:"absolute",right:15,bottom:17}}>Scripted lesson preview</p></div>
        <FeatureLink href="/ai-tutor">Meet your tutors</FeatureLink><p className={s.tiny}>AI tutoring requires a signed-in Plus account.</p>
      </GlassPanel>
      <GlassPanel className={s.ecosystemCard}>
        <div className={s.panelHeader}><span className={s.icon}><BookOpen size={24} /></span><div className={s.tags}><span>Markdown</span><span>PDF export</span></div></div>
        <h3 className={s.featureTitle}>Smart notes</h3><p className={s.muted}>Give your ideas structure. Keep explanations, formulas, and your own words together.</p>
        <div className={s.ecosystemVisual}><div className={s.miniNote}><h4>Newton’s second law</h4><p>{summary ? "Net force changes motion. For constant mass, acceleration grows with net force: Fnet = ma." : "• Identify the object and its mass.\n• Add forces as vectors.\n• Use the net force to find acceleration."}</p><p style={{color:"#edcd98"}}>F<sub>net</sub> = ma</p><button className={s.button} aria-pressed={summary} onClick={() => setSummary(!summary)}><Sparkles size={13} />{summary ? "Show source note" : "Preview summary"}</button></div></div>
        <FeatureLink href="/notes">Make room for your ideas</FeatureLink>
      </GlassPanel>
      <GlassPanel className={s.ecosystemCard}>
        <div className={s.panelHeader}><span className={s.icon}><ChartNoAxesColumnIncreasing size={24} /></span><div className={s.tags}><span>Study activity</span><span>Reflection</span></div></div>
        <h3 className={s.featureTitle}>Mastery tracking</h3><p className={s.muted}>Review your study activity and question results. Find the topics worth another look.</p>
        <div className={s.ecosystemVisual}><OrbitalArt /><div className={s.miniBars}><span>Motion<b>In progress</b></span><span>Forces<b>Revisit</b></span><span>Energy<b>Next up</b></span></div></div>
        <FeatureLink href="/analytics">Explore study insights</FeatureLink><p className={s.tiny}>Illustrative topics, not your learning records.</p>
      </GlassPanel>
    </div><PreviewLabel>Illustrative product previews · no live AI requests</PreviewLabel>
  </ShowcaseSection>;
}

export function ChapterShowcase() {
  const [subject, setSubject] = useState<keyof typeof chapterExamples>("Physics");
  const [selected, setSelected] = useState(1);
  const chapter = chapterExamples[subject][selected];
  return <ShowcaseSection id="chapters" eyebrow="Chapter Command" title={<>Move through your syllabus <em>with clarity.</em></>} description="Choose a subject. Open a chapter. Bring the concepts, formulas, and your next study action into focus.">
    <div className={s.chapterLayout}>
      <GlassPanel><p className={s.tiny}>CLASS 11 · SAMPLE SUBJECTS</p><div className={s.subjectNav}>{(Object.keys(chapterExamples) as Array<keyof typeof chapterExamples>).map(name => <button key={name} aria-pressed={subject===name} className={subject===name?s.selected:""} onClick={() => {setSubject(name);setSelected(0);}}><Atom size={17} />{name}</button>)}</div></GlassPanel>
      <GlassPanel><div className={s.row}><span className={s.tiny}>{subject} / Your chapter journey</span><span className={s.badge}>Explore a sample</span></div><h3 className={s.featureTitle} style={{marginTop:20}}>One chapter. A clearer next step.</h3><div className={s.chapterRoute}>{chapterExamples[subject].map((item,i) => <button key={item.title} className={s.chapterNode} aria-pressed={selected===i} onClick={() => setSelected(i)}><span>{String(i+1).padStart(2,"0")}</span><span>{item.title}</span>{selected===i?<ArrowRight size={16} />:<BookOpen size={16} />}</button>)}</div><div className={s.inset} key={`${subject}-${selected}`}><p className={s.muted}>{chapter.concept}</p><div className={s.tags} style={{marginTop:14}}>{chapter.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div></GlassPanel>
      <GlassPanel className={s.chapterDetails}><div><p className={s.tiny}>SELECTED CHAPTER</p><h3>{chapter.title}</h3><p className={s.muted}>{chapter.detail}</p><OrbitalArt variant="quiet" /></div><div><p className={s.tiny}>A KEY CONNECTION</p><p style={{fontFamily:"Georgia,serif",fontSize:20,margin:"14px 0"}}>{chapter.formula}</p><p className={s.tiny}>{subject==="Physics"&&selected===2?"Ideal projectile, level launch and landing, no air resistance.":"Sample concept from this chapter."}</p><FeatureLink href="/chapter-command">Open Chapter Command</FeatureLink></div></GlassPanel>
    </div><PreviewLabel>Changing this preview does not change your class or study records</PreviewLabel>
  </ShowcaseSection>;
}

export function PracticeShowcase() {
  const [index,setIndex] = useState(0);
  const [selected,setSelected] = useState<number|null>(null);
  const [checked,setChecked] = useState(false);
  const item=practiceExamples[index];
  const result=checked&&selected!==null?checkPractice(index,selected):null;
  function changeQuestion(next:number){setIndex(next);setSelected(null);setChecked(false);}
  return <ShowcaseSection id="practice" eyebrow="Practice & Mocks" title={<>Practice what matters.<br /><em>Understand every attempt.</em></>} description="Try a question, see the reasoning, and give it another go. Build a study habit around understanding, not just choosing an option.">
    <div className={s.questionLayout}>
      <GlassPanel><div className={s.toolbar}><div className={s.tags}><span>Class 11 Physics</span><span>{item.topic}</span></div><div className={s.row}><Clock3 size={14} /><span className={s.tiny}>Untimed sample · {index+1} of 2</span></div></div><h3 className={s.question}>{item.question}</h3><div className={s.options} role="group" aria-label="Practice answer">{item.options.map((option,i) => <button key={option} aria-pressed={selected===i} className={`${s.option} ${selected===i?s.selected:""}`} onClick={()=>{setSelected(i);setChecked(false);}}><span>{"ABCD"[i]}</span>{option}</button>)}</div><div className={s.row} style={{flexWrap:"wrap"}}><button className={s.primaryButton} disabled={selected===null} onClick={()=>setChecked(true)}>Check my answer<ArrowRight size={16}/></button><button className={s.button} onClick={()=>changeQuestion((index+1)%practiceExamples.length)}>Try another question<RotateCcw size={14}/></button></div>{result?<div className={s.feedback} data-correct={result.correct} role="status"><strong>{result.correct?"That’s right.":"Try that once more."}</strong><p>{result.text}</p></div>:<p className={s.tiny} style={{marginTop:18}}>Choose an answer to explore the explanation.</p>}<PreviewLabel>Scholar-authored sample · not saved or graded by AI</PreviewLabel></GlassPanel>
      <div className={s.supportStack}><GlassPanel><span className={s.icon}><Brain size={23}/></span><h3>Make mistakes useful.</h3><p>A good explanation helps you notice the missing step and try again with a better approach.</p><div className={s.inset} style={{marginTop:20}}><Lightbulb size={19} style={{color:"#e4c28c",marginBottom:10}}/><p>Velocity is a value. Acceleration measures how that value changes with time.</p></div></GlassPanel><GlassPanel><span className={s.icon}><Target size={23}/></span><h3>Bring it to the exam.</h3><p>Explore the available chapter practice or set up a mock to review your responses.</p><FeatureLink href="/practice">Explore chapter practice</FeatureLink><br/><FeatureLink href="/mock-exam">Open mock exams</FeatureLink><p className={s.tiny}>Available chapters and account access vary by feature.</p></GlassPanel></div>
    </div>
  </ShowcaseSection>;
}

export function FocusShowcase() {
  const [preset,setPreset]=useState(25);
  const [remaining,setRemaining]=useState(25*60);
  const [running,setRunning]=useState(false);
  const deadline=useRef(0);
  const [theme,setTheme]=useState("Cosmic");
  useEffect(()=>{
    if(!running)return;
    const interval=window.setInterval(()=>{const seconds=Math.max(0,Math.ceil((deadline.current-Date.now())/1000));setRemaining(seconds);if(seconds===0)setRunning(false);},250);
    return ()=>window.clearInterval(interval);
  },[running]);
  function toggleTimer(){if(remaining<=0)return;if(!running)deadline.current=Date.now()+remaining*1000;setRunning(!running);}
  function choose(minutes:number){setRunning(false);setPreset(minutes);setRemaining(minutes*60);}
  const time=`${Math.floor(remaining/60).toString().padStart(2,"0")}:${(remaining%60).toString().padStart(2,"0")}`;
  return <ShowcaseSection id="focus-modes" eyebrow="A Little Space to Focus" title={<>Build the atmosphere<br /><em>your mind settles into.</em></>} description="Give your next study session a little structure. Try the timer here, then explore Scholar’s dedicated focus space.">
    <div className={s.focusLayout}>
      <GlassPanel><span className={s.icon}><Timer size={24}/></span><h3 className={s.featureTitle} style={{marginTop:20}}>One focused moment.</h3><p className={s.muted}>A real, local countdown. Nothing to sign up for and no activity added to your account.</p><div className={s.timer} aria-label="Focus time remaining">{time}</div><div className={s.tabs} aria-label="Focus duration">{[25,50,90].map(minutes=><button key={minutes} aria-pressed={preset===minutes} onClick={()=>choose(minutes)}>{minutes} min</button>)}</div><div className={s.row} style={{marginTop:20}}><button className={s.primaryButton} onClick={toggleTimer} disabled={remaining===0}>{running?<Pause size={15}/>:<Play size={15}/>} {running?"Pause timer":"Start timer"}</button><button className={s.button} aria-label="Reset focus timer" onClick={()=>choose(preset)}><RotateCcw size={15}/></button></div></GlassPanel>
      <GlassPanel><p className={s.availability}><TriangleAlert size={13}/>Study Music is temporarily unavailable</p><div className={s.focusArtwork} data-theme={theme}><OrbitalArt variant={theme==="Rain"?"violet":"gold"}/><span>{theme} atmosphere · concept artwork</span></div><div className={s.row}><span className={s.icon}><Headphones size={24}/></span><span className={s.badge}>Availability notice</span></div><h3 className={s.featureTitle} style={{marginTop:18}}>A calmer study space.</h3><p className={s.muted}>The music library is paused while copyright concerns are addressed. Focus timers and native ambience remain available in Focus.</p><FeatureLink href="/music">Read the Study Music update</FeatureLink></GlassPanel>
      <GlassPanel><span className={s.icon}><Sparkles size={24}/></span><h3 className={s.featureTitle} style={{marginTop:20}}>Find your setting.</h3><p className={s.muted}>Explore a visual mood for this preview. These tiles don’t start audio.</p><div className={s.themeGrid}>{["Cosmic","Forest","Rain","Library"].map(name=><button key={name} data-theme={name} aria-pressed={theme===name} className={`${s.theme} ${theme===name?s.selected:""}`} onClick={()=>setTheme(name)}>{theme===name?<Check size={14}/>:<span aria-hidden="true">✦</span>}<p>{name}</p></button>)}</div><FeatureLink href="/focus">Enter the focus space</FeatureLink></GlassPanel>
    </div><PreviewLabel>Timer runs on this page · visual themes are silent</PreviewLabel>
  </ShowcaseSection>;
}
