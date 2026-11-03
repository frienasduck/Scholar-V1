import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { MobileLiquidDock } from "../src/components/liquid-glass/mobile-liquid-dock";
import { DockRefractionDefs, GlassFilterDefs } from "../src/components/liquid-glass/glass-filter";
import { dockDragFrame, dockGestureIntent, nearestDockSlot } from "../src/lib/animation/dock-swipe";

const slots = ["dashboard", "study", "practice", "ai-tools", "more"].map((id, i) => ({ id, x: 7 + i * 68, y: 7, width: 64, height: 50 }));
test.each([[3, 2, "pending"], [10, 1, "swipe"], [-25, 3, "swipe"], [2, 20, "scroll"], [9, 10, "scroll"], [8, 8, "pending"]] as const)("gesture intent (%s,%s) is %s", (dx, dy, intent) => expect(dockGestureIntent(dx, dy)).toBe(intent));

test("lens follows actual intermediate finger coordinates, not only whole tabs", () => {
  const a = dockDragFrame(slots, 130, 0, 1, true)!, b = dockDragFrame(slots, 140, 0, 1, true)!;
  expect(b.x - a.x).toBe(10); expect(a.x).not.toBe(slots[1].x);
  expect(nearestDockSlot(slots, 175)?.id).toBe("practice");
});
test("rubber band, vertical lift and deformation are bounded", () => {
  const a = dockDragFrame(slots, -9000, -9000, -900, true)!, b = dockDragFrame(slots, 9000, 9000, 900, true)!;
  expect(a.x).toBe(0); expect(b.x).toBe(286); expect(a.y).toBe(2); expect(b.y).toBe(12);
  expect(a.scaleX).toBeLessThanOrEqual(1.085); expect(a.scaleY).toBeGreaterThanOrEqual(.9575);
  expect(a.light).toBe(0); expect(b.light).toBe(100);
});
test("reduced motion keeps direct manipulation but removes elastic extras", () => {
  const f = dockDragFrame(slots, -500, 100, 100, false)!;
  expect(f.x).toBe(7); expect(f.y).toBe(7); expect(f.scaleX).toBe(1); expect(f.scaleY).toBe(1);
  expect(dockDragFrame([], 10, 10, 0, true)).toBeUndefined();
});
test("all five destinations retain native accessible buttons and current-page semantics", () => {
  const html = renderToStaticMarkup(<MobileLiquidDock active="study" navigate={() => {}} more={() => {}} reduceMotion={false} />);
  expect(html.match(/data-dock-id=/g)).toHaveLength(5);
  expect(html).toContain('aria-current="page"'); expect(html).toContain('aria-label="More sections"');
  expect(html).not.toContain('role="slider"');
});
test("only the dock owns gesture capture; cancels, click suppression and shared optics remain bounded", () => {
  const hook = readFileSync("src/components/liquid-glass/use-dock-swipe.ts", "utf8"), css = readFileSync("src/components/liquid-glass/liquid-velocity.css", "utf8");
  expect(hook).toContain('node.setPointerCapture(e.pointerId)');
  expect(hook).toContain('node.removeEventListener("pointercancel", cancel)');
  expect(hook).toContain('node.removeEventListener("lostpointercapture", lost)');
  expect(hook).toContain('e.detail > 0'); expect(hook).toContain('cancelAnimationFrame(frame)');
  expect(hook).not.toContain("useState"); expect(css).toContain('touch-action: pan-y pinch-zoom');
  expect(css).toContain('url("#sg-refraction-dock")');
});

test("compact optics have a static broad rim without changing the three shared presets", () => {
  const compact = renderToStaticMarkup(<DockRefractionDefs />), shared = renderToStaticMarkup(<GlassFilterDefs />);
  expect(compact).toContain('id="sg-refraction-dock"'); expect(compact).toContain('scale="0.14"');
  expect(compact.match(/<feDisplacementMap/g)).toHaveLength(1);
  expect(shared.match(/<feDisplacementMap/g)).toHaveLength(3);
  expect(shared).not.toContain('id="sg-refraction-dock"');
});
