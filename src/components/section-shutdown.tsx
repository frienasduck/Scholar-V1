"use client";

import { ArrowLeft, ArrowRight, BookOpen, CirclePause, Copyright, Headphones, ShieldCheck, VideoOff } from "lucide-react";
import { useId } from "react";
import { getSectionShutdown } from "@/lib/section-availability";
import layout from "./subscriptions/plus-feature-preview.module.css";
import styles from "./section-shutdown.module.css";

function navigate(viewId: string) {
  window.dispatchEvent(new CustomEvent("neha-scholar:navigate", { detail: { viewId } }));
}

/** A service pause, not a subscription lock: upgrading cannot bypass this notice. */
export function SectionShutdown({ viewId }: { viewId: string }) {
  const id = useId();
  const notice = getSectionShutdown(viewId);
  if (!notice) return null;
  const Icon = notice.tone === "coral" ? VideoOff : Headphones;
  const cards = [
    { icon: Copyright, title: "Why we’re paused", text: `Access to ${notice.title} is temporarily unavailable while we address copyright and licensing concerns with the ${notice.medium}.` },
    { icon: ShieldCheck, title: "A responsible return", text: `We’ll try to bring ${notice.title} back as soon as possible. There is no confirmed return date yet; thank you for your patience.` },
    { icon: BookOpen, title: "Keep your study flow", text: "Your saved Scholar data is not deleted by this pause. E-Books, notes, practice and the Focus Timer remain available under your existing access." },
  ];

  return (
    <section className={`${layout.preview} ${styles.notice}`} data-section-shutdown={viewId} data-tone={notice.tone} aria-labelledby={`${id}-title`}>
      <div className={`${layout.shell} ${styles.shell}`}>
        <svg className={layout.filaments} viewBox="0 0 1500 860" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs><linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--pause-accent)" stopOpacity="0" /><stop offset=".65" stopColor="var(--pause-accent)" stopOpacity=".4" /><stop offset=".85" stopColor="var(--pause-light)" /><stop offset="1" stopColor="var(--pause-accent)" stopOpacity=".1" /></linearGradient></defs>
          <g fill="none" stroke={`url(#${id}-edge)`} strokeWidth="1">
            <path d="M1250 -80 C1130 30 1210 230 1490 248" />
            <path d="M1510 90 C1310 170 1270 235 1230 350" />
            <path d="M-90 630 C170 640 220 795 325 930" />
            <path d="M1560 550 C1440 620 1330 750 1305 900" />
          </g>
        </svg>
        <div className={layout.content}>
          <div className={layout.eyebrow}>
            <span className={`${layout.lockBadge} ${styles.icon}`}><Icon aria-hidden="true" /></span>
            <p className={styles.eyebrow}><span>Scholar</span><span className={layout.labelDot} aria-hidden="true">·</span><span className={layout.previewLabel}>Temporary shutdown</span></p>
            <span className={`${layout.headerLine} ${styles.line}`} aria-hidden="true" />
          </div>
          <h1 id={`${id}-title`} className={`${layout.title} ${styles.title}`}>{notice.title} is taking a pause.</h1>
          <p className={`${layout.description} ${styles.description}`}>Scholar is facing copyright issues with the {notice.medium}. We’ll try to bring {notice.title} back as soon as possible.</p>
          <ul className={layout.cards} aria-label="About this temporary shutdown">
            {cards.map((card, index) => (
              <li key={card.title} className={`${layout.card} ${styles.card}`}>
                <div className={layout.cardTop}><span className={`${layout.iconBadge} ${styles.icon}`}><card.icon aria-hidden="true" /></span><span className={`${layout.cardLine} ${styles.line}`} aria-hidden="true" /><span className={`${layout.number} ${styles.number}`} aria-hidden="true">0{index + 1}</span></div>
                <h2>{card.title}</h2><p>{card.text}</p>
              </li>
            ))}
          </ul>
          <div className={styles.status}><CirclePause aria-hidden="true" /><p>Paused for all users, including Scholar Plus. This is not a plan restriction.</p></div>
          <div className={layout.actions}>
            <button type="button" className={`${layout.primary} ${styles.primary}`} onClick={() => navigate(notice.alternative.viewId)}><BookOpen aria-hidden="true" /><span>{notice.alternative.title}</span><ArrowRight aria-hidden="true" /></button>
            <button type="button" className={`${layout.secondary} ${styles.secondary}`} onClick={() => navigate("dashboard")}><ArrowLeft aria-hidden="true" /><span>Back to Scholar</span></button>
          </div>
        </div>
      </div>
    </section>
  );
}
