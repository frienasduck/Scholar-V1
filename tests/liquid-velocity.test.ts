import { expect, test } from "bun:test";
import { nextVelocityQuality, velocityMotionAllowed } from "../src/lib/animation/velocity-policy";
import { displacementMapX, displacementMapY, REFRACTION_PRESETS, GlassFilterDefs } from "../src/components/liquid-glass/glass-filter";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { supportsSvgBackdrop } from "../src/components/liquid-glass/liquid-glass-provider";
import { glassRuntimeStats, registerGlassSurface, setGlassOpticalBudget, setGlassPointerMotionAllowed } from "../src/components/liquid-glass/glass-runtime";

test("quality requires sustained bad windows and never upgrades", () => {
  expect(nextVelocityQuality("high", 1)).toBe("high");
  expect(nextVelocityQuality("high", 2)).toBe("balanced");
  expect(nextVelocityQuality("balanced", 2)).toBe("lightweight");
  expect(nextVelocityQuality("lightweight", 0)).toBe("lightweight");
});

test("all iOS browsers, desktop Safari, Firefox and unknown engines fail closed", () => {
  for (const ua of ["iPhone CriOS/150 Safari/605", "iPad Safari/605", "Macintosh Safari/605", "Firefox/156", "UnknownBrowser"]) expect(supportsSvgBackdrop(ua)).toBe(false);
  expect(supportsSvgBackdrop("Macintosh Chrome/156", true)).toBe(false);
  expect(supportsSvgBackdrop("Windows Chrome/156 Safari/537")).toBe(true);
  expect(supportsSvgBackdrop("Android Chrome/156 Mobile Safari/537")).toBe(true);
});

test("optical fields have signed edges and a wide neutral centre", () => {
  for (const [map, channel] of [[displacementMapX(), "#800000"], [displacementMapY(), "#000080"]]) {
    const svg = decodeURIComponent(map.split(",")[1]);
    expect(svg).toContain('offset=".035"'); expect(svg).toContain('offset=".965"');
    expect(svg.match(new RegExp(channel, "g"))?.length).toBe(2);
  }
  expect(Object.keys(REFRACTION_PRESETS)).toHaveLength(3);
  expect(REFRACTION_PRESETS.prominent.displacement).toBeLessThanOrEqual(0.08);
  const html = renderToStaticMarkup(createElement(GlassFilterDefs));
  expect(html.match(/primitiveUnits="objectBoundingBox"/g)).toHaveLength(3);
  expect(html.match(/width="1" height="1"/g)).toHaveLength(6);
});

test("offscreen surfaces are not measured; real optical budget and hidden cleanup", () => {
  const keys = ["window", "document", "IntersectionObserver"] as const;
  const descriptors = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  let observed: ((changes: unknown[]) => void) | undefined, frame: (() => void) | undefined;
  const events = new Map<string, (event?: unknown) => void>(); let reads = 0;
  const doc = { hidden: false, documentElement: { dataset: {} }, addEventListener: (k: string, fn: () => void) => events.set(k, fn), removeEventListener: (k: string) => events.delete(k) };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener: (k: string, fn: () => void) => events.set(k, fn), removeEventListener: (k: string) => events.delete(k), requestAnimationFrame: (fn: () => void) => { frame = fn; return 1; }, cancelAnimationFrame: () => { frame = undefined; }, matchMedia: () => ({ matches: false }) } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: class { constructor(callback: (entries: unknown[]) => void) { observed = callback; } observe() {} unobserve() {} disconnect() {} } });
  const nodes = Array.from({length: 8}, () => ({ dataset: {} as Record<string, string>, style: { setProperty() {} }, getBoundingClientRect() { reads++; return { top: 0, left: 0, width: 100, height: 50 }; } } as unknown as HTMLElement));
  const releases: (() => void)[] = [];
  try {
    setGlassOpticalBudget(true, 2); setGlassPointerMotionAllowed(true);
    nodes.forEach(node => releases.push(registerGlassSurface(node, { elasticity: 1 })));
    observed?.(nodes.slice(0,3).map(target => ({ target, isIntersecting: true, boundingClientRect: { width: 100, height: 50 } })));
    events.get("pointermove")?.({clientX: 10, clientY: 10}); frame?.();
    expect(reads).toBe(3); expect(glassRuntimeStats().lastMeasured).toBe(3); expect(glassRuntimeStats().optical).toBe(2);
    doc.hidden = true; events.get("visibilitychange")?.();
    expect(glassRuntimeStats().optical).toBe(0); expect(glassRuntimeStats().running).toBe(false);
    doc.hidden = false;
    doc.documentElement.dataset = { reduceMotion: "true" } as typeof doc.documentElement.dataset;
    expect(velocityMotionAllowed()).toBe(false);
  } finally {
    releases.forEach(off => off()); setGlassPointerMotionAllowed(false); setGlassOpticalBudget(false, 0);
    keys.forEach((key, i) => { if (descriptors[i]) Object.defineProperty(globalThis,key,descriptors[i]!); else Reflect.deleteProperty(globalThis,key); });
  }
  expect(glassRuntimeStats().registered).toBe(0);
});
