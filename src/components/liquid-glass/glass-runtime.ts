/**
 * Scholar Liquid Glass — shared pointer runtime.
 *
 * Design rule: ONE pointer system for the whole product.
 *
 * The reference implementation (`liquid-glass-react`) attaches a `mousemove`
 * listener plus a `resize` listener to *every* glass instance and stores the
 * pointer position in React state, which re-renders the component on every
 * pointer event. Scholar has hundreds of possible glass surfaces, so instead:
 *
 *   one pointer listener → one requestAnimationFrame loop → direct CSS custom
 *   property writes on registered Tier 1 surfaces (no React renders per frame)
 *
 * The loop stops itself when the pointer has been still for a few frames, and
 * every listener is removed as soon as the last surface unregisters.
 */

export interface GlassPointerOptions {
  /** Cursor attraction, 0 = rigid. Matches the material token. */
  elasticity: number;
  /** Distance in px from the surface edge where attraction fades in. */
  reach?: number;
  /** Whether the specular angle should follow the cursor. */
  trackAngle?: boolean;
}

interface Entry {
  el: HTMLElement;
  opts: Required<GlassPointerOptions>;
  rect: DOMRect | null;
  rectDirty: boolean;
  active: boolean;
}

const entries = new Map<HTMLElement, Entry>();

let frameHandle = 0;
let loopRunning = false;
let listenersBound = false;
let pointerX = Number.NaN;
let pointerY = Number.NaN;
let motionAllowed = true;

const MAX_PULL_PX = 9;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Runtime gate. Touch-only and reduced-motion environments never run the loop. */
export function setGlassPointerMotionAllowed(allowed: boolean): void {
  motionAllowed = allowed;
  if (!allowed) {
    stopLoop();
    entries.forEach(resetEntry);
  }
}

export function isGlassPointerMotionAllowed(): boolean {
  return motionAllowed;
}

function resetEntry(entry: Entry): void {
  if (!entry.active) return;
  entry.active = false;
  const style = entry.el.style;
  style.setProperty("--sg-pull-x", "0px");
  style.setProperty("--sg-pull-y", "0px");
  style.setProperty("--sg-edge", "");
  style.setProperty("--sg-angle", "");
  style.setProperty("--sg-mx", "0.5");
  style.setProperty("--sg-my", "0.5");
}

function markRectDirty(): void {
  entries.forEach((entry) => {
    entry.rectDirty = true;
  });
}

function onPointerMove(event: PointerEvent): void {
  pointerX = event.clientX;
  pointerY = event.clientY;
  startLoop();
}

function onScrollOrResize(): void {
  markRectDirty();
  if (!Number.isNaN(pointerX)) startLoop();
}

function onVisibilityChange(): void {
  if (document.hidden) {
    stopLoop();
    entries.forEach(resetEntry);
  }
}

function bindListeners(): void {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
}

function unbindListeners(): void {
  if (!listenersBound || typeof window === "undefined") return;
  listenersBound = false;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("scroll", onScrollOrResize, { capture: true } as EventListenerOptions);
  window.removeEventListener("resize", onScrollOrResize);
  document.removeEventListener("visibilitychange", onVisibilityChange);
}

function startLoop(): void {
  if (!motionAllowed || loopRunning || typeof window === "undefined") return;
  if (document.hidden) return;
  loopRunning = true;
  frameHandle = window.requestAnimationFrame(runFrame);
}

function stopLoop(): void {
  loopRunning = false;
  if (frameHandle && typeof window !== "undefined") window.cancelAnimationFrame(frameHandle);
  frameHandle = 0;
}

function rectFor(entry: Entry): DOMRect | null {
  if (!entry.rect || entry.rectDirty) {
    entry.rect = entry.el.getBoundingClientRect();
    entry.rectDirty = false;
  }
  return entry.rect;
}

function runFrame(): void {
  frameHandle = 0;
  if (!loopRunning) return;
  if (entries.size === 0) {
    stopLoop();
    return;
  }

  // Complete geometry reads before any custom-property writes. Otherwise a
  // newly dirty surface can force layout after the preceding surface's writes.
  const measured = [...entries.values()].map(entry => ({ entry, rect: rectFor(entry) }));
  measured.forEach(({ entry, rect }) => {
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = pointerX - centerX;
    const deltaY = pointerY - centerY;

    const edgeDistance = Math.hypot(
      Math.max(0, Math.abs(deltaX) - rect.width / 2),
      Math.max(0, Math.abs(deltaY) - rect.height / 2),
    );

    const reach = entry.opts.reach;
    // Keep the effect alive while the cursor is inside the surface bounds.
    const inside = edgeDistance === 0;
    const fade = inside ? 1 : edgeDistance > reach ? 0 : 1 - edgeDistance / reach;

    if (fade <= 0) {
      resetEntry(entry);
      return;
    }

    entry.active = true;

    const style = entry.el.style;
    const pullX = clamp(deltaX * entry.opts.elasticity * 0.12 * fade, -MAX_PULL_PX, MAX_PULL_PX);
    const pullY = clamp(deltaY * entry.opts.elasticity * 0.12 * fade, -MAX_PULL_PX, MAX_PULL_PX);
    style.setProperty("--sg-pull-x", `${pullX.toFixed(2)}px`);
    style.setProperty("--sg-pull-y", `${pullY.toFixed(2)}px`);
    style.setProperty("--sg-edge", (0.35 + 0.65 * fade).toFixed(3));
    if (entry.opts.trackAngle) {
      style.setProperty("--sg-angle", `${(135 + clamp((deltaX / (rect.width || 1)) * 42, -38, 38)).toFixed(1)}deg`);
    }
    style.setProperty("--sg-mx", clamp((pointerX - rect.left) / rect.width, 0, 1).toFixed(3));
    style.setProperty("--sg-my", clamp((pointerY - rect.top) / rect.height, 0, 1).toFixed(3));
  });

  // Pointer events schedule the next frame. The visual interpolation itself is
  // handled by CSS transitions, so keeping an rAF alive while the pointer is
  // stationary only burns CPU and battery without changing any pixels.
  stopLoop();
}

/**
 * Registers a Tier 1 glass surface with the shared pointer loop.
 * Returns an unregister function; it always removes its own contribution and
 * tears the shared listeners down once nothing is registered.
 */
export function registerGlassSurface(
  el: HTMLElement,
  options: GlassPointerOptions,
): () => void {
  if (typeof window === "undefined") return () => {};

  entries.set(el, {
    el,
    opts: {
      elasticity: options.elasticity,
      reach: options.reach ?? 180,
      trackAngle: options.trackAngle ?? true,
    },
    rect: null,
    rectDirty: true,
    active: false,
  });

  bindListeners();

  return () => {
    const entry = entries.get(el);
    if (entry) resetEntry(entry);
    entries.delete(el);
    if (entries.size === 0) {
      stopLoop();
      unbindListeners();
    }
  };
}

/** Invalidate cached geometry, e.g. after a layout or panel resize. */
export function markGlassGeometryDirty(): void {
  markRectDirty();
}

/** Diagnostics for the performance audit (also surfaced in dev tooling). */
export function glassRuntimeStats(): { registered: number; running: boolean } {
  return { registered: entries.size, running: loopRunning };
}
