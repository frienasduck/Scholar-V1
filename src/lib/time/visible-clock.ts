type ClockHost = {
  now: () => number; visible: () => boolean;
  everySecond: (tick: () => void) => () => void;
  onVisibility: (change: () => void) => () => void;
};

/** One display-only clock. Deadlines remain authoritative; media is untouched. */
export function createVisibleClock(host: ClockHost) {
  let now = 0;
  const listeners = new Set<() => void>();
  let stopTick: (() => void) | undefined, stopVisibility: (() => void) | undefined;
  const tick = () => { now = host.now(); listeners.forEach(listener => listener()); };
  const sync = () => {
    stopTick?.(); stopTick = undefined;
    if (listeners.size && host.visible()) { tick(); stopTick = host.everySecond(tick); }
  };
  return {
    getSnapshot: () => now,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) { stopVisibility = host.onVisibility(sync); sync(); }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) { stopTick?.(); stopVisibility?.(); stopTick = stopVisibility = undefined; }
      };
    },
  };
}

export const visibleClock = createVisibleClock({
  now: () => Date.now(), visible: () => !document.hidden,
  everySecond: tick => { const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer); },
  onVisibility: sync => { document.addEventListener("visibilitychange", sync); return () => document.removeEventListener("visibilitychange", sync); },
});
