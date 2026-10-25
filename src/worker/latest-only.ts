type LatestOnlyScheduler<T> = {
  enqueue: (value: T) => void;
};

/**
 * Coalesces work that has been queued but has not started. JavaScript cannot
 * preempt a synchronous analysis safely, so the scheduler deliberately
 * cancels only pending work and always runs the newest pending value.
 */
export function createLatestOnlyScheduler<T>(
  run: (value: T) => void,
  schedule: (flush: () => void) => void = (flush) => setTimeout(flush, 0),
): LatestOnlyScheduler<T> {
  let latest: T | undefined;
  let scheduled = false;

  const flush = (): void => {
    scheduled = false;
    const value = latest;
    latest = undefined;
    if (value !== undefined) run(value);
    if (latest !== undefined) enqueue(latest);
  };

  const enqueue = (value: T): void => {
    latest = value;
    if (scheduled) return;
    scheduled = true;
    schedule(flush);
  };

  return { enqueue };
}
