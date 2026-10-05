/**
 * Integration-harness stand-in for Next's `after()`, which throws outside a request scope (ENG-3639).
 *
 * Opt-in per suite, so suites that rely on the real outside-a-request behaviour (code that catches that
 * throw and runs the work inline, like `scheduleFeedbackSourceReconciliation`) keep it:
 *
 *   vi.mock("next/server", async (importOriginal) =>
 *     (await import("@/integration/after")).withAfterMock(await importOriginal()));
 *
 * Callbacks are queued, not started, until `flushAfter()` — the way Next holds them until the response
 * is sent — so a test can assert that nothing happened before it.
 */
const queued: (() => unknown)[] = [];

const runAfter = (callback: () => unknown): void => {
  queued.push(callback);
};

export const withAfterMock = <T extends object>(nextServer: T): T & { after: typeof runAfter } => ({
  ...nextServer,
  after: runAfter,
});

/** Run everything scheduled with `after()` so far, including work it scheduled in turn. */
export const flushAfter = async (): Promise<void> => {
  while (queued.length > 0) {
    for (const callback of queued.splice(0)) {
      await callback();
    }
  }
};
