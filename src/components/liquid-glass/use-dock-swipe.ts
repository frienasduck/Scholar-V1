"use client";

import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import { dockDragFrame, dockGestureIntent, nearestDockSlot, type DockSlot } from "@/lib/animation/dock-swipe";
import { velocityMotionAllowed } from "@/lib/animation/velocity-policy";
import type { NavigationLensControl } from "./velocity-motion";

type Slot = DockSlot & { element: HTMLElement };
type Gesture = { pointer: number; startX: number; startY: number; x: number; y: number; previousX: number; at: number; speed: number; dragging: boolean; box: DOMRect; slots: Slot[]; preview?: HTMLElement };

/** Direct finger tracking is local to the dock. Native vertical pan/pinch and
 * ordinary button/keyboard clicks remain native; only a real swipe commits. */
export function useDockSwipe(root: RefObject<HTMLElement | null>, control: RefObject<NavigationLensControl | null>, active: string, reduced: boolean, onSelect: (id: string) => void) {
  const abort = useRef<(() => void) | null>(null);
  const select = useEffectEvent(onSelect);
  const elastic = useEffectEvent(() => !reduced && velocityMotionAllowed());

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let gesture: Gesture | undefined, frame = 0, suppressUntil = 0;
    const clearPaint = () => {
      delete node.dataset.sgDragging;
      node.style.removeProperty("--sg-drag-scale-x"); node.style.removeProperty("--sg-drag-scale-y"); node.style.removeProperty("--sg-drag-light");
    };
    const finish = (commit = false) => {
      const g = gesture;
      if (!g) return;
      gesture = undefined; cancelAnimationFrame(frame); frame = 0;
      g.preview?.removeAttribute("data-dock-preview"); clearPaint();
      if (node.hasPointerCapture(g.pointer)) node.releasePointerCapture(g.pointer);
      const moved = Math.hypot(g.x - g.startX, g.y - g.startY) >= 8;
      if (moved) suppressUntil = performance.now() + 600;
      const inside = g.x >= g.box.left - 40 && g.x <= g.box.right + 40 && g.y >= g.box.top - 28 && g.y <= g.box.bottom + 28;
      const target = commit && g.dragging && inside ? nearestDockSlot(g.slots, g.x - g.box.left) : undefined;
      control.current?.settle((target as Slot | undefined)?.element);
      if (target) select(target.id);
    };
    const cancel = () => finish();
    abort.current = cancel;
    const paint = () => {
      frame = 0;
      const g = gesture;
      if (!g?.dragging) return;
      const next = dockDragFrame(g.slots, g.x - g.box.left, g.y - g.startY, g.speed, elastic());
      if (!next) return;
      control.current?.track(next);
      node.style.setProperty("--sg-drag-scale-x", String(next.scaleX)); node.style.setProperty("--sg-drag-scale-y", String(next.scaleY)); node.style.setProperty("--sg-drag-light", `${next.light}%`);
      const preview = (next.slot as Slot).element;
      if (preview !== g.preview) { g.preview?.removeAttribute("data-dock-preview"); preview.setAttribute("data-dock-preview", "true"); g.preview = preview; }
    };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary) { cancel(); return; }
      if (gesture || e.button !== 0 || !(e.target instanceof Element) || !e.target.closest("button[data-dock-id]")) return;
      const box = node.getBoundingClientRect();
      const slots = [...node.querySelectorAll<HTMLElement>(":scope > button[data-dock-id]:not(:disabled)")].map(element => {
        const r = element.getBoundingClientRect();
        return { element, id: element.dataset.dockId!, x: r.left - box.left, y: r.top - box.top, width: r.width, height: r.height };
      });
      suppressUntil = 0;
      gesture = { pointer: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, previousX: e.clientX, at: e.timeStamp, speed: 0, dragging: false, box, slots };
    };
    const move = (e: PointerEvent) => {
      const g = gesture;
      if (!g || e.pointerId !== g.pointer) return;
      g.x = e.clientX; g.y = e.clientY;
      if (!g.dragging) {
        const intent = dockGestureIntent(g.x - g.startX, g.y - g.startY);
        if (intent === "scroll") { cancel(); return; }
        if (intent !== "swipe") return;
        g.dragging = true; node.dataset.sgDragging = "true";
        node.setPointerCapture(e.pointerId);
        // Release the initial button's delegated press, not its click semantics.
        window.dispatchEvent(new Event("scholar:motion-boundary"));
      }
      g.speed = (g.x - g.previousX) / Math.max(1, e.timeStamp - g.at); g.previousX = g.x; g.at = e.timeStamp;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const up = (e: PointerEvent) => { if (gesture?.pointer === e.pointerId) { gesture.x = e.clientX; gesture.y = e.clientY; finish(true); } };
    const lost = (e: PointerEvent) => { if (e.target === node && gesture?.pointer === e.pointerId) cancel(); };
    const click = (e: MouseEvent) => { if (e.detail > 0 && performance.now() < suppressUntil) { e.preventDefault(); e.stopPropagation(); } };
    const hidden = () => { if (document.hidden) cancel(); };
    const boundary = () => { if (!gesture?.dragging) cancel(); };
    const preferences = new MutationObserver(cancel);
    preferences.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sg-motion", "data-sg-hidden", "data-appearance-glass", "data-scholar-keyboard-open"] });
    node.addEventListener("pointerdown", down, { passive: true }); node.addEventListener("pointermove", move, { passive: true }); node.addEventListener("pointerup", up, { passive: true }); node.addEventListener("pointercancel", cancel); node.addEventListener("lostpointercapture", lost); node.addEventListener("click", click, true);
    window.addEventListener("blur", cancel); window.addEventListener("resize", cancel); window.addEventListener("scroll", cancel, { passive: true, capture: true }); window.addEventListener("scholar:motion-boundary", boundary); document.addEventListener("visibilitychange", hidden);
    return () => {
      cancel(); abort.current = null; cancelAnimationFrame(frame); clearPaint(); preferences.disconnect();
      node.removeEventListener("pointerdown", down); node.removeEventListener("pointermove", move); node.removeEventListener("pointerup", up); node.removeEventListener("pointercancel", cancel); node.removeEventListener("lostpointercapture", lost); node.removeEventListener("click", click, true);
      window.removeEventListener("blur", cancel); window.removeEventListener("resize", cancel); window.removeEventListener("scroll", cancel, true); window.removeEventListener("scholar:motion-boundary", boundary); document.removeEventListener("visibilitychange", hidden);
    };
  }, [root, control]);
  useEffect(() => { abort.current?.(); }, [active, reduced]);
}
