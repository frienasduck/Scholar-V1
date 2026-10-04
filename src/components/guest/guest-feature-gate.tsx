"use client";

import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { useId } from "react";
import styles from "./guest-feature-gate.module.css";

type GuestFeatureGateProps = {
  onSignIn: () => void;
  onBack: () => void;
  reduceMotion?: boolean;
};

/** Presentation only: the shell continues to own guest access and authentication. */
export function GuestFeatureGate({ onSignIn, onBack, reduceMotion = false }: GuestFeatureGateProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const edgeId = `${id}-edge`;

  return (
    <section className={styles.stage} aria-labelledby={titleId} aria-describedby={descriptionId} data-guest-feature-gate="true" data-reduce-motion={reduceMotion}>
      <svg className={styles.atmosphere} viewBox="0 0 1672 941" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={edgeId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#aa8249" stopOpacity="0" />
            <stop offset=".36" stopColor="#b88f50" stopOpacity=".48" />
            <stop offset=".7" stopColor="#f3d5a1" />
            <stop offset="1" stopColor="#b28b52" stopOpacity=".12" />
          </linearGradient>
        </defs>
        <g fill="none" stroke={`url(#${edgeId})`} strokeWidth="1.1">
          <path d="M1445 -60 C1320 55 1310 235 1695 328" />
          <path d="M1710 170 C1450 260 1250 438 1280 725 C1290 875 1180 962 1030 1010" />
          <path d="M-65 525 C260 545 455 716 590 1000" />
        </g>
      </svg>

      <div className={styles.panel}>
        <div className={styles.content}>
          <div className={styles.ornament} aria-hidden="true">
            <span className={styles.rule} />
            <span className={styles.lockBadge}><LockKeyhole /></span>
            <span className={styles.rule} />
          </div>
          <p className={styles.eyebrow}>Guest session</p>
          <h1 id={titleId} className={styles.title}>Sign in to use this private feature</h1>
          <p id={descriptionId} className={styles.description}>Guest Mode does not provide cloud files, purchases, payments, subscriptions, or cross-device storage.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={onSignIn}>
              <span>Create account or Sign in</span><ArrowRight aria-hidden="true" />
            </button>
            <button type="button" className={styles.secondary} onClick={onBack}>
              <ArrowLeft aria-hidden="true" /><span>Back to Scholar</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
