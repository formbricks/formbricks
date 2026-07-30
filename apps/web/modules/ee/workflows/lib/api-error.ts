import { V3ApiError } from "@/modules/api/lib/v3-client";

/**
 * Deliberately stricter than the shared `getV3ApiErrorMessage`, which returns `error.message` for
 * any Error and so surfaces raw browser strings to users — "NetworkError when attempting to fetch
 * resource." (Firefox), "Failed to fetch" (Chrome), "The operation timed out." from the mutation
 * AbortSignal.timeout. Those read as a broken app rather than a lost connection.
 *
 * Only a V3ApiError carries a `detail` we authored (RFC 9457, already user-facing); anything else
 * never got an answer from the API and has nothing worth showing, so it collapses to the caller's
 * copy. The shared helper is left alone — it has callers across the app whose behaviour is pinned by
 * its own tests.
 */
export const getWorkflowApiErrorMessage = (error: unknown, fallbackMessage: string): string =>
  // `.trim()` guards the empty-detail case: parseV3ApiError falls back to `response.statusText`,
  // which is always "" over HTTP/2, and `??` doesn't catch that — without this a non-JSON error
  // response would render an empty toast.
  error instanceof V3ApiError && error.detail.trim() ? error.detail : fallbackMessage;

/**
 * Whether a failed save can be worth retrying on reconnect. V3ApiError is only ever constructed from
 * a real HTTP response (see parseV3ApiError), so by construction anything else never reached the
 * API — offline, DNS failure, or the mutation timeout.
 */
export const classifyWorkflowSaveError = (error: unknown): "unreachable" | "rejected" =>
  error instanceof V3ApiError ? "rejected" : "unreachable";
