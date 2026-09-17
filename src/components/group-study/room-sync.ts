/** A single-flight queue: foreground/mutation/manual refreshes cannot overlap. */
export function singleFlight<T>(task: (force: boolean) => Promise<T>) {
  let current: Promise<T> | null = null;
  let forced: Promise<T> | null = null;
  return (force = false): Promise<T> => {
    if (current) {
      if (!force) return current;
      // Exactly one fresh read after an in-flight read, not one per caller.
      if (!forced)
        forced = current
          .catch(() => undefined)
          .then(() => {
            forced = null;
            return run(true);
          });
      return forced;
    }
    return run(force);
  };
  function run(force: boolean): Promise<T> {
    const result = task(force);
    current = result;
    void result
      .finally(() => {
        if (current === result) current = null;
      })
      .catch(() => undefined);
    return result;
  }
}

export function pollDelay(hidden: boolean, failures: number) {
  return hidden
    ? 30_000
    : failures
      ? Math.min(30_000, 3_000 * 2 ** Math.min(failures, 3))
      : 3_000;
}
