import { classifyAIProviderError } from "@formbricks/ai";
import { TooManyRequestsError } from "@formbricks/types/errors";

/**
 * The retry policy of the import's plan calls (ENG-3654). The calls are sent with the AI SDK's own
 * retries off (`maxRetries: 0`) and retried here, because the SDK's policy cannot be told apart from a
 * timeout: a 429 whose `Retry-After` it waited out past the call's timeout came back as the backoff
 * delay's `AbortError`, read as a timeout, and the chunk was split when the user should have been told
 * the provider was rate-limiting them. Here every failed attempt is classified first:
 *
 * - a 429 is waited out when its `Retry-After` (from the response headers, never the message) leaves
 *   time in the call for another attempt, and otherwise propagates unwrapped, for the route to map to
 *   `ai_quota_exceeded` with its `retryAfter`;
 * - a 5xx or a network failure is retried with exponential backoff and jitter while the call has time
 *   left; once it has not, the call has timed out, and its chunk is split like any other that did;
 * - anything else is not retried.
 *
 * At most `QSF_MAX_CALL_RETRIES` retries a call, the SDK's own default, and every attempt counts
 * against the import's call cap and budgets like a call of its own.
 */

/** Retries per call after the first attempt: the AI SDK's default `maxRetries`. */
export const QSF_MAX_CALL_RETRIES = 2;
/** The first retry's backoff, doubled for each one after: the AI SDK's own defaults. */
const INITIAL_BACKOFF_MS = 2_000;
const BACKOFF_FACTOR = 2;

/** What to do after a failed attempt. */
export type TQsfRetryDecision =
  /** Wait `delayMs`, then send the call again. */
  | { kind: "retry"; delayMs: number }
  /** A retryable failure with no time left in the call for another attempt: the call timed out. */
  | { kind: "timed_out" }
  /** Not ours to retry, or out of retries: the error goes on as it is. */
  | { kind: "propagate" };

/**
 * The 429 in a failed attempt, with its `Retry-After` in seconds when the provider sent one. The
 * organization's service has already turned it into a `TooManyRequestsError`; a call made without it
 * (the eval script) still holds the provider's error.
 */
function quotaOf(error: unknown): { retryAfterSeconds?: number } | null {
  if (error instanceof TooManyRequestsError) return { retryAfterSeconds: error.retryAfter };
  const info = classifyAIProviderError(error);
  return info?.isQuotaExhausted ? { retryAfterSeconds: info.retryAfterSeconds } : null;
}

/** The `attempt`-th backoff (0 for the first retry), half of it random so parallel calls spread out. */
const backoffMs = (attempt: number, random: () => number): number => {
  const ceiling = INITIAL_BACKOFF_MS * BACKOFF_FACTOR ** attempt;
  return Math.round(ceiling / 2 + (random() * ceiling) / 2);
};

/**
 * What to do after attempt number `attempt` (0 for the first) failed with `error`, with `remainingMs`
 * left in the call and `minAttemptMs` the least time an attempt is worth sending with.
 */
export function decideQsfRetry(params: {
  error: unknown;
  attempt: number;
  remainingMs: number;
  minAttemptMs: number;
  random?: () => number;
}): TQsfRetryDecision {
  const { error, attempt, remainingMs, minAttemptMs, random = Math.random } = params;
  const fits = (delayMs: number) => delayMs + minAttemptMs <= remainingMs;

  const quota = quotaOf(error);
  if (quota) {
    if (attempt >= QSF_MAX_CALL_RETRIES) return { kind: "propagate" };
    const delayMs =
      quota.retryAfterSeconds === undefined ? backoffMs(attempt, random) : quota.retryAfterSeconds * 1_000;
    // Past the call's time the user is told about the quota, not that the import took too long.
    return fits(delayMs) ? { kind: "retry", delayMs } : { kind: "propagate" };
  }

  const info = classifyAIProviderError(error);
  if (!info?.isRetryable || info.isAuthFailure) return { kind: "propagate" };
  if (attempt >= QSF_MAX_CALL_RETRIES) return { kind: "propagate" };
  const delayMs =
    info.retryAfterSeconds === undefined ? backoffMs(attempt, random) : info.retryAfterSeconds * 1_000;
  return fits(delayMs) ? { kind: "retry", delayMs } : { kind: "timed_out" };
}

/** Wait `ms`, or reject with the signal's reason the moment it aborts. */
export function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      try {
        signal.throwIfAborted();
      } catch (reason) {
        reject(reason as Error);
      }
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}
