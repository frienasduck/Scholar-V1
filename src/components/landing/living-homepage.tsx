"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, Pause, Sparkles } from "lucide-react";
import { ScholarExperience, ChapterShowcase, PracticeShowcase, FocusShowcase } from "./core-sections";
import { LamShowcase, ExamReadyShowcase } from "./intelligence-sections";
import { MaterialsShowcase, GroupShowcase, PlannerShowcase, ReadingShowcase } from "./knowledge-sections";
import s from "./landing.module.css";

export function LivingHomepage({ onSignup, onGuest, paused = false, onMotionToggle }: {
  onSignup: () => void; onGuest: () => void; paused?: boolean; onMotionToggle?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || typeof IntersectionObserver !== "function") return;
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { (entry.target as HTMLElement).dataset.revealed = "true"; reveal.unobserve(entry.target); }
    }), { threshold: .06, rootMargin: "0px 0px 30px 0px" });
    element.querySelectorAll<HTMLElement>("[data-reveal]").forEach(item => {
      // Only defer panels below the current viewport. Content stays readable if JS is unavailable.
      item.dataset.revealed = item.getBoundingClientRect().top < window.innerHeight ? "true" : "false";
      reveal.observe(item);
    });
    element.classList.add(s.motionReady);
    const presence = new IntersectionObserver(entries => entries.forEach(entry => {
      (entry.target as HTMLElement).dataset.inView = String(entry.isIntersecting);
    }), { rootMargin: "80px" });
    element.querySelectorAll("[data-showcase]").forEach(item => presence.observe(item));
    const visibility = () => { element.dataset.hidden = String(document.hidden); };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => { reveal.disconnect(); presence.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  return <div ref={root} className={s.journey} data-testid="cinematic-homepage" data-motion={paused?"paused":"active"}>
    <div className={s.motionControl}><span>A closer look at your study world</span>{onMotionToggle?<button onClick={onMotionToggle} aria-pressed={paused}><Pause size={11} style={{display:"inline",marginRight:6}}/>{paused?"Resume ambient motion":"Pause ambient motion"}</button>:null}</div>
    <ScholarExperience />
    <LamShowcase />
    <ExamReadyShowcase />
    <MaterialsShowcase />
    <ChapterShowcase />
    <PracticeShowcase />
    <PlannerShowcase />
    <GroupShowcase />
    <ReadingShowcase />
    <FocusShowcase />
    <section className={s.finalCta} aria-labelledby="begin-scholar-title">
      <p className={s.eyebrow}><Sparkles size={13}/>Your next chapter</p>
      <h2 id="begin-scholar-title" style={{marginTop:25}}>Curiosity brought you here.<br /><em>See where it takes you.</em></h2>
      <p>Find your rhythm, follow a question, and make a little more sense of your world.</p>
      <div className={s.ctaActions}><button className={s.primaryButton} onClick={onSignup}>Start your Scholar<ArrowUpRight size={17}/></button><button className={s.button} onClick={onGuest}>Explore as Guest<ArrowUpRight size={17}/></button></div>
    </section>
  </div>;
}
