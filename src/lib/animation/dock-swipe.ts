/** Dock-only gesture math: no document access, navigation, timers or React. */
export type DockSlot = { id: string; x: number; y: number; width: number; height: number };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function dockGestureIntent(dx: number, dy: number): "pending" | "swipe" | "scroll" {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return "pending";
  if (Math.abs(dy) > Math.abs(dx) * 1.1) return "scroll";
  return Math.abs(dx) >= 8 && Math.abs(dx) >= Math.abs(dy) * 1.2 ? "swipe" : "pending";
}

export function nearestDockSlot(slots: readonly DockSlot[], x: number): DockSlot | undefined {
  return slots.reduce<DockSlot | undefined>((best, slot) => !best || Math.abs(x - slot.x - slot.width / 2) < Math.abs(x - best.x - best.width / 2) ? slot : best, undefined);
}

export function dockDragFrame(slots: readonly DockSlot[], x: number, dy: number, speed: number, elastic: boolean) {
  const slot = nearestDockSlot(slots, x);
  if (!slot) return undefined;
  const min = Math.min(...slots.map(s => s.x)), max = Math.max(...slots.map(s => s.x + s.width)) - slot.width;
  const raw = x - slot.width / 2, bounded = clamp(raw, min, max);
  const stretch = elastic ? Math.min(.085, Math.abs(speed) * .025) : 0;
  // Direct manipulation is X-only. Vertical finger drift must never lift the
  // lens, track, labels or icons; deformation is horizontal too.
  void dy;
  return { slot, x: bounded, y: slot.y, width: slot.width, height: slot.height,
    scaleX: 1 + stretch, scaleY: 1, light: clamp((x - bounded) / slot.width, 0, 1) * 100 };
}
