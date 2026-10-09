import { setImmediate as yieldToEventLoop } from "node:timers/promises";

/**
 * How long the import's synchronous work may hold the event loop before it yields. The route runs
 * the import on the web server's own thread, so every other request on the pod waits that long.
 */
export const QSF_SLICE_MS = 10;

/** Yield to the event loop now, then stop if `signal` aborted meanwhile. */
export async function yieldToOthers(signal?: AbortSignal): Promise<void> {
  await yieldToEventLoop();
  signal?.throwIfAborted();
}

/**
 * A slicer for a long loop: `await slice()` in each round yields once `QSF_SLICE_MS` have passed since
 * the last yield — by elapsed time, not by count, since one round can cost more than a hundred — and
 * stops when `signal` aborts.
 */
export function createSlicer(signal?: AbortSignal): () => Promise<void> {
  let sliceStart = performance.now();
  return async () => {
    if (performance.now() - sliceStart <= QSF_SLICE_MS) return;
    await yieldToOthers(signal);
    sliceStart = performance.now();
  };
}
