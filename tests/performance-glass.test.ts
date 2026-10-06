import { expect, test } from "bun:test";
import { glassRuntimeStats, registerGlassSurface, setGlassPointerMotionAllowed } from "../src/components/liquid-glass/glass-runtime";

test("glass batches all layout reads before writes, coalesces pointer frames and cleans up", () => {
  const win = Object.getOwnPropertyDescriptor(globalThis, "window"), doc = Object.getOwnPropertyDescriptor(globalThis, "document");
  const events = new Map<string, (event?: unknown) => void>(); const order: string[] = [];
  let frames = 0, cancelled = 0, frame: (() => void) | undefined;
  const documentMock = { hidden: false, addEventListener: (type: string, fn: () => void) => events.set(type, fn), removeEventListener: (type: string) => events.delete(type) };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener: (type: string, fn: () => void) => events.set(type, fn), removeEventListener: (type: string) => events.delete(type), requestAnimationFrame: (fn: () => void) => { frames++; frame = fn; return frames; }, cancelAnimationFrame: () => { cancelled++; frame = undefined; } } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: documentMock });
  const releases: (() => void)[] = [];
  try {
    setGlassPointerMotionAllowed(true);
    for (let i = 0; i < 3; i++) releases.push(registerGlassSurface({ style: { setProperty: () => order.push(`write:${i}`) }, getBoundingClientRect: () => { order.push(`read:${i}`); return { top: 0, left: 0, width: 100, height: 100 }; } } as unknown as HTMLElement, { elasticity: 1 }));
    for (let i = 0; i < 10; i++) events.get("pointermove")?.({ clientX: 50, clientY: 50 });
    expect(frames).toBe(1); frame?.();
    expect(order.slice(0,3)).toEqual(["read:0", "read:1", "read:2"]); expect(order.slice(3).every(value => value.startsWith("write:"))).toBe(true);
    events.get("pointermove")?.({ clientX: 60, clientY: 60 }); documentMock.hidden = true; events.get("visibilitychange")?.();
    expect(cancelled).toBe(1); expect(glassRuntimeStats().running).toBe(false);
    releases.forEach(fn => fn()); expect(glassRuntimeStats().registered).toBe(0); expect(events.size).toBe(0);
  } finally {
    releases.forEach(fn => fn());
    if (win) Object.defineProperty(globalThis,"window",win); else Reflect.deleteProperty(globalThis,"window");
    if (doc) Object.defineProperty(globalThis,"document",doc); else Reflect.deleteProperty(globalThis,"document");
  }
});
