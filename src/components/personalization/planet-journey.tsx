"use client";
import { BUILD_COPY } from "./personalization-presentation";
export function PlanetJourney({active,message}:{active:string;message:string}) {
  const title=BUILD_COPY[active] || "Building your Scholar";
  return <section className="your-scholar-journey" aria-label="Building your Scholar" aria-busy="true">
    <p className="your-scholar-eyebrow">YOUR SCHOLAR</p>
    <h1 key={title} className="your-scholar-build-title" role="status" aria-live="polite" aria-atomic="true">{title}</h1>
    <span className="your-scholar-orbit-loader" aria-hidden="true" />
    <p className="your-scholar-build-caption">Built around how you learn.</p>
    <span className="sr-only">{message}</span>
  </section>;
}
