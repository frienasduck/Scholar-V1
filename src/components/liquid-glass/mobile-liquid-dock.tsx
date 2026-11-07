"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Home, BookOpen, ListChecks, Lightbulb, Menu } from "lucide-react";
import { NavigationLens, useNavigationLens, type NavigationLensControl } from "./velocity-motion";
import { useDockSwipe } from "./use-dock-swipe";

const ITEMS = [{ id: "dashboard", title: "Home", icon: Home }, { id: "study", title: "Study", icon: BookOpen }, { id: "question-practice", title: "Practice", icon: ListChecks }, { id: "lam-ai", title: "LAM AI", icon: Lightbulb }];

/** Native taps plus horizontal direct manipulation; vertical scrolling stays native. */
export function MobileLiquidDock({ active, navigate, more, reduceMotion }: { active: string; navigate: (id: string) => void; more: () => void; reduceMotion: boolean }) {
  const root = useRef<HTMLElement>(null);
  const control = useRef<NavigationLensControl | null>(null);
  const lens = useNavigationLens(root, active, "x", control);
  useDockSwipe(root, control, active, reduceMotion, id => id === "more" ? more() : navigate(id));
  return <motion.nav ref={root} id="scholar-mobile-bottom-navigation" className="scholar-bottom-nav sg-velocity-dock"
    initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: reduceMotion ? 0 : 0.17 }} aria-label="Primary mobile navigation" data-sg-chrome="mobile-nav" data-velocity-press="off">
    <NavigationLens lensRef={lens} axis="x" />
    {ITEMS.map(item => <button key={item.id} type="button" data-dock-id={item.id} onClick={() => navigate(item.id)} className={active === item.id ? "active" : ""} aria-label={item.id === "lam-ai" ? "LAM AI" : item.title} aria-current={active === item.id ? "page" : undefined}><item.icon />{item.title}</button>)}
    <button type="button" data-dock-id="more" onClick={more} aria-label="More sections"><Menu />More</button>
  </motion.nav>;
}
