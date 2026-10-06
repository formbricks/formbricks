/** The reason a `createRequestAbort` signal carries when its deadline, not the client, ended the work. */
export class RequestDeadlineExceededError extends Error {
  readonly deadlineMs: number;

  constructor(deadlineMs: number) {
    super(`The request did not finish within ${deadlineMs} ms`);
    this.name = "RequestDeadlineExceededError";
    this.deadlineMs = deadlineMs;
  }
}

export interface TRequestAbort {
  /** Aborts when the client disconnects, when `abort()` is called, or when the deadline passes. */
  readonly signal: AbortSignal;
  /** Abort the work now, e.g. from a stream's `cancel`, which can fire before the request signal does. */
  abort: () => void;
  /** True when the deadline, not the client, aborted the work. */
  deadlineExceeded: () => boolean;
  /** Detach from the request and clear the deadline. Call once the work has settled. */
  dispose: () => void;
}

/**
 * One abort signal for work a request started: the provider call behind a stream, say.
 *
 * Chained to `req.signal`, which Next aborts when the client disconnects, so pressing Stop stops the
 * spend rather than just detaching the reader. An abort that already happened is never replayed to a
 * listener added afterwards, so a request whose client left while earlier guards ran is aborted at
 * once instead of running in full for nobody.
 *
 * Built on the incoming request's own signal on purpose: a signal taken from a `Request` built or
 * cloned in application code can be garbage-collected along with that object and stop firing.
 */
export function createRequestAbort(
  req: Request,
  { deadlineMs }: { deadlineMs?: number } = {}
): TRequestAbort {
  if (deadlineMs !== undefined && (!Number.isSafeInteger(deadlineMs) || deadlineMs <= 0)) {
    throw new Error(`createRequestAbort: deadlineMs must be a positive integer, got ${deadlineMs}`);
  }

  const controller = new AbortController();
  const abortWith = (reason?: unknown) => {
    if (!controller.signal.aborted) controller.abort(reason);
  };
  const onRequestAbort = () => abortWith(req.signal.reason);

  if (req.signal.aborted) onRequestAbort();
  else req.signal.addEventListener("abort", onRequestAbort, { once: true });

  const deadlineTimer =
    deadlineMs === undefined
      ? undefined
      : setTimeout(() => abortWith(new RequestDeadlineExceededError(deadlineMs)), deadlineMs);

  return {
    signal: controller.signal,
    abort: () => abortWith(),
    deadlineExceeded: () => controller.signal.reason instanceof RequestDeadlineExceededError,
    dispose: () => {
      req.signal.removeEventListener("abort", onRequestAbort);
      clearTimeout(deadlineTimer);
    },
  };
}
