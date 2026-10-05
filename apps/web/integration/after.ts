/**
 * Integration-harness stand-in for Next's `after()`, which throws outside a request scope (ENG-3639).
 *
 * `integration/setup.ts` mocks `next/server` so every `after(callback)` starts the callback straight away
 * and parks its promise here. A test that drives code which defers work past its response awaits
 * `flushAfter()` before asserting on that work — exactly what Next does once the response is sent.
 */
const pending: Promise<unknown>[] = [];

export const runAfter = (callback: () => unknown): void => {
  pending.push(Promise.resolve().then(callback));
};

/** Wait for everything scheduled with `after()` so far, including work it scheduled in turn. */
export const flushAfter = async (): Promise<void> => {
  while (pending.length > 0) {
    await Promise.all(pending.splice(0));
  }
};
