import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getLamPanelMotion, LamDismissScrim, LamPanelSurface } from "../src/components/lam/lam-panel-presence";

test("LAM closes with a bounded opacity/transform transition, without blur or layout animation", () => {
  const motion = getLamPanelMotion(false);
  expect(motion.initial).toEqual({ opacity: 0, y: -8, scale: 0.98 });
  expect(motion.animate).toEqual({ opacity: 1, y: 0, scale: 1 });
  expect(motion.exit.opacity).toBe(0);
  expect(motion.exit).toMatchObject({ y: -12, scale: 0.975 });
  expect(motion.exit.transition.duration).toBe(0.2);
  expect(motion.exit).not.toHaveProperty("filter");
  expect(motion.exit).not.toHaveProperty("height");
  expect(motion.exit).not.toHaveProperty("width");
});

test("reduced motion uses an almost instant fade without travel or shrink", () => {
  const motion = getLamPanelMotion(true);
  expect(motion.initial).toEqual({ opacity: 0 });
  expect(motion.exit.transition.duration).toBe(0.01);
  expect(motion.transition.duration).toBe(0.01);
  expect(motion.exit).not.toHaveProperty("y");
  expect(motion.exit).not.toHaveProperty("scale");
});

test("open panel keeps its content and top-anchored motion; scrim stays a labelled button", () => {
  const panel = renderToStaticMarkup(<LamPanelSurface reducedMotion={false} className="lam-premium-panel"><button>Close LAM</button></LamPanelSurface>);
  expect(panel).toContain('data-lam-panel-state="open"');
  expect(panel).toContain("transform-origin:50% 0%");
  expect(panel).not.toContain("inert=");
  expect(panel).toContain("Close LAM");
  const scrim = renderToStaticMarkup(<LamDismissScrim reducedMotion={false} aria-label="Dismiss LAM" />);
  expect(scrim).toContain('type="button"');
  expect(scrim).toContain('aria-label="Dismiss LAM"');
  expect(scrim).not.toContain("disabled=");
});
