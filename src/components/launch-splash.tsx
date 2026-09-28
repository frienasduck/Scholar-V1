import type { ReactNode } from "react";

type LaunchSplashProps = {
  overlay?: boolean;
  visible?: boolean;
  reducedMotion?: boolean;
  progress?: number;
  message?: string;
  modeLabel?: string;
  children?: ReactNode;
};

export function LaunchSplash({
  overlay = false,
  visible = true,
  reducedMotion = false,
  progress,
  message = "Preparing your workspace…",
  modeLabel,
  children,
}: LaunchSplashProps) {
  const percentage = progress === undefined ? null : Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div
      className={`scholar-launch${overlay ? " scholar-launch-overlay" : ""}${reducedMotion ? " scholar-launch-reduced" : ""}`}
      style={overlay ? { opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none", transitionDuration: reducedMotion ? "0ms" : "550ms" } : undefined}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      aria-label={message}
      data-visible={visible}
      data-startup-progress={percentage ?? undefined}
      data-startup-mode={modeLabel?.toLowerCase()}
    >
      <div className="scholar-launch-sky" aria-hidden="true">
        <div className="scholar-launch-stars" />
        <div className="scholar-launch-aura" />
        <div className="scholar-launch-planet scholar-launch-planet-left" />
        <div className="scholar-launch-planet scholar-launch-planet-right" />
        <div className="scholar-launch-orbit scholar-launch-orbit-one"><span /></div>
        <div className="scholar-launch-orbit scholar-launch-orbit-two"><span /></div>
        <div className="scholar-launch-horizon" />
        <div className="scholar-launch-wave scholar-launch-wave-one" />
        <div className="scholar-launch-wave scholar-launch-wave-two" />
      </div>

      <div className="scholar-launch-center">
        <div className="scholar-launch-emblem" aria-hidden="true">
          <div className="scholar-launch-emblem-inner">
            <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
              <path d="M40 13 6 29.5 40 46l34-16.5L40 13Z" fill="white" />
              <path d="M17 39v15c13 10 33 10 46 0V39L40 50 17 39Z" fill="url(#cap-light)" />
              <path d="M74 30v22" stroke="#D6F7FF" strokeWidth="4" strokeLinecap="round" />
              <circle cx="74" cy="55" r="4" fill="#D6F7FF" />
              <defs><linearGradient id="cap-light" x1="17" y1="39" x2="59" y2="66"><stop stopColor="white" /><stop offset="1" stopColor="#96DDF4" /></linearGradient></defs>
            </svg>
          </div>
        </div>
        <h1 className="scholar-launch-title">Scholar</h1>
        <p className="scholar-launch-subtitle">Preparing your workspace<span aria-hidden="true">…</span></p>

        <div className="scholar-launch-progress" role="progressbar" aria-label="Scholar startup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage ?? undefined} aria-valuetext={percentage === null ? "Loading" : `${percentage}%`}>
          <div className={`scholar-launch-progress-fill${percentage === null ? " is-indeterminate" : ""}`} style={percentage === null ? undefined : { width: `${Math.max(3, percentage)}%` }} />
          {percentage !== null ? <span className="scholar-launch-progress-value" aria-hidden="true">{percentage}%</span> : null}
        </div>
        <p className="scholar-launch-status">{message}</p>
        <p className="scholar-launch-steps" aria-hidden="true">Loading tools <span>•</span> Syncing your study environment <span>•</span> Finalizing your space</p>
        {modeLabel ? <p className="scholar-launch-mode">{modeLabel} startup</p> : null}
        {children}
      </div>
    </div>
  );
}
