"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import s from "./landing.module.css";

export function ShowcaseSection({ id, eyebrow, title, description, children, className = "" }: {
  id: string; eyebrow: string; title: ReactNode; description: string; children: ReactNode; className?: string;
}) {
  return <section id={id} aria-labelledby={`${id}-title`} className={`${s.section} ${className}`} data-showcase={id}>
    <div className={s.sectionLight} aria-hidden="true" />
    <div className={s.sectionContent}>
      <header className={s.heading} data-reveal="">
        <p className={s.eyebrow}><span />{eyebrow}</p>
        <h2 id={`${id}-title`}>{title}</h2>
        <p className={s.description}>{description}</p>
      </header>
      <div className={s.stage} data-reveal="">{children}</div>
    </div>
  </section>;
}

export function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${s.panel} ${className}`}>{children}</div>;
}

export function PreviewLabel({ children = "Interactive sample · local only" }: { children?: ReactNode }) {
  return <p className={s.sampleCaption}><Sparkles size={12} aria-hidden="true" />{children}</p>;
}

export function FeatureLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} prefetch={false} className={s.featureLink}>{children}<ArrowUpRight size={16} aria-hidden="true" /></Link>;
}

export function OrbitalArt({ variant = "gold", className = "" }: { variant?: "gold" | "violet" | "quiet"; className?: string }) {
  return <div className={`${s.orbitalArt} ${className}`} data-orbit={variant} aria-hidden="true">
    <div className={s.orbitGlow} /><div className={s.orbitRing} /><div className={s.orbitRing2} />
    <div className={s.planet}><span /></div><i className={s.satellite} /><i className={s.satellite2} />
    <div className={s.orbitRing3} /><span className={s.starOne}>✦</span><span className={s.starTwo}>✧</span>
  </div>;
}
