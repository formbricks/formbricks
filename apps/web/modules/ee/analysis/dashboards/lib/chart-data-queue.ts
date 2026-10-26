/**
 * How many widgets' data a dashboard asks for at once. Over HTTP/2 a browser would send every widget's
 * request together; the server runs at most 20 chart queries at once per user, so a large dashboard would
 * meet 429s and spend its per-minute budget on them. Eight leaves room for another tab, the builder's
 * preview and an agent on the same account.
 */
export const MAX_CHART_DATA_IN_FLIGHT = 8;

let running = 0;
const waiting: (() => void)[] = [];

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The operation was aborted.", "AbortError");

/**
 * Run `request` once fewer than `MAX_CHART_DATA_IN_FLIGHT` others are running, in the order asked. A
 * request whose `signal` aborts while it waits leaves the queue without running, so a widget scrolled
 * away or a query cancelled by TanStack never holds up the rest.
 */
export const takeChartDataTurn = async <T>(signal: AbortSignal | undefined, request: () => Promise<T>) => {
  if (running >= MAX_CHART_DATA_IN_FLIGHT) {
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortReason(signal));
        return;
      }
      const start = () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        const index = waiting.indexOf(start);
        if (index >= 0) waiting.splice(index, 1);
        reject(abortReason(signal as AbortSignal));
      };
      waiting.push(start);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  running++;
  try {
    return await request();
  } finally {
    running--;
    waiting.shift()?.();
  }
};
