import "server-only";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";
import { hasStaleAuthzedRevocation } from "./outbox-repository";

/**
 * How long one staleness answer is reused across authorization checks.
 *
 * React's `cache()` was here and did almost nothing: the Route Handler runtime carries no cache
 * dispatcher, so `cache` falls through to a plain call there — and nine of the eleven rollout targets
 * are Route-Handler-only. Every authorization check therefore paid its own PostgreSQL round trip, and
 * a request makes many checks: three for workspace navigation, one per access item in the action
 * client, one per directory in the feedback-directory fan-out.
 *
 * A short process-wide memo dedupes across all of them, including the surfaces that open no
 * authorization context at all and the shadow comparisons that run after the response. The cost is
 * bounded and explicit: the guard can arm up to this much later than the sixty-second window it
 * enforces.
 */
export const AUTHZED_FRESHNESS_MEMO_TTL_MS = 1_000;

// Monotonic on purpose. `Date.now()` steps backwards on an NTP correction, a VM resume, or a host
// booting from a bad RTC, and a negative elapsed time is always under the TTL — which would freeze
// this answer, in whichever direction it happened to hold, for the entire duration of the step. That
// is the one way the bound below could be exceeded without limit, on every process sharing the clock.
let memoizedAt = Number.NEGATIVE_INFINITY;
let memoizedValue = false;
let inFlight: Promise<boolean> | null = null;

const readStaleness = (): Promise<boolean> => {
  if (performance.now() - memoizedAt < AUTHZED_FRESHNESS_MEMO_TTL_MS) return Promise.resolve(memoizedValue);

  // Concurrent checks share one read. A value-only memo would not collapse a fan-out, because every
  // check in it starts before any of them has finished.
  inFlight ??= hasStaleAuthzedRevocation()
    .then((stale) => {
      memoizedValue = stale;
      memoizedAt = performance.now();
      return stale;
    })
    // Deliberately not memoized on rejection: a failed read must keep denying, not be cached as an
    // answer. Clearing the slot here also lets the next check retry rather than reuse the rejection.
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/**
 * Refuse to authorize from a graph that may still contain access revoked in PostgreSQL.
 *
 * This is deliberately called only by the SpiceDB evaluator. The bridge release keeps the legacy
 * evaluator authoritative while the durable queue is populated and drained; direct authority fails
 * closed once a revocation is older than the bounded delivery window or has entered dead letter.
 */
export const assertAuthzedProjectionFreshness = async (): Promise<void> => {
  if (!(await readStaleness())) return;

  throw new AuthzedError({
    attempts: 0,
    code: AUTHZED_ERROR_CODES.PROJECTION_STALE,
    operation: "authorization_projection_freshness",
    retryable: false,
  });
};
