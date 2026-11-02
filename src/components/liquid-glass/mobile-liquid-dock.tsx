"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Home, BookOpen, ListChecks, Lightbulb, Menu } from "lucide-react";
import { NavigationLens, useNavigationLens } from "./velocity-motion";

const ITEMS = [{ id: "dashboard", title: "Home", icon: Home }, { id: "study", title: "Study", icon: BookOpen }, { id: "practice", title: "Practice", icon: ListChecks }, { id: "ai-tools", title: "AI", icon: Lightbulb }];

/** Native buttons: no drag-to-navigate, touch capture or scroll prevention. */
export function MobileLiquidDock({ active, navigate, more, reduceMotion }: { active: string; navigate: (id: string) => void; more: () => void; reduceMotion: boolean }) {
  const root = useRef<HTMLElement>(null);
  const lens = useNavigationLens(root, active, "x");
  useEffect(() => {
    const reset = () => { lens.current?.style.removeProperty("--sg-touch-x"); lens.current?.style.removeProperty("--sg-touch-y"); };
    document.addEventListener("visibilitychange", reset); window.addEventListener("blur", reset);
    return () => { document.removeEventListener("visibilitychange", reset); window.removeEventListener("blur", reset); };
  }, [lens]);
  const release = () => { lens.current?.style.removeProperty("--sg-touch-x"); lens.current?.style.removeProperty("--sg-touch-y"); };
  return <motion.nav ref={root} id="scholar-mobile-bottom-navigation" className="scholar-bottom-nav sg-velocity-dock"
    initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
    transition={{ duration: reduceMotion ? 0 : 0.17 }} aria-label="Primary mobile navigation" data-sg-chrome="mobile-nav"
    onPointerMove={event => {
      if (!event.buttons || event.pointerType !== "touch" || reduceMotion || !lens.current || document.documentElement.dataset.sgMotion === "reduced") return;
      const box = event.currentTarget.getBoundingClientRect();
      lens.current.style.setProperty("--sg-touch-x", `${Math.max(-2, Math.min(2, (event.clientX - box.left - box.width / 2) / 70))}px`);
      lens.current.style.setProperty("--sg-touch-y", "-1px");
    }} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}>
    <NavigationLens lensRef={lens} axis="x" />
    {ITEMS.map(item => <button key={item.id} type="button" onClick={() => navigate(item.id)} className={active === item.id ? "active" : ""} aria-label={item.id === "ai-tools" ? "AI Tools" : item.title} aria-current={active === item.id ? "page" : undefined}><item.icon />{item.title}</button>)}
    <button type="button" onClick={more} aria-label="More sections"><Menu />More</button>
  </motion.nav>;
}
