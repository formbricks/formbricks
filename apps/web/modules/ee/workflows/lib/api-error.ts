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
  isRefusal(error) && error.detail.trim() ? error.detail : fallbackMessage;

/**
 * A response in which the API deliberately refused this request, as opposed to one that never got an
 * answer worth reading. 5xx is the latter: a 502/503/504 from a proxy or a restarting server says
 * nothing about the request, and its `detail` is whatever the gateway happened to emit — not copy we
 * authored. Anything that isn't a V3ApiError never reached the API at all, since parseV3ApiError is
 * the only thing that constructs one (offline, DNS failure, the mutation timeout).
 */
const isRefusal = (error: unknown): error is V3ApiError => error instanceof V3ApiError && error.status < 500;

/**
 * Whether a failed save is worth retrying by itself once the connection is back. Only a deliberate
 * refusal is not: re-sending an identical draft the API already rejected would just fail again.
 */
export const classifyWorkflowSaveError = (error: unknown): "unreachable" | "rejected" =>
  isRefusal(error) ? "rejected" : "unreachable";

/**
 * The server's enable/test pre-flight refused the trigger survey because it is restricted (ENG-3283).
 * `packages/workflows` reports that as an `invalid_params` entry on the trigger's survey id; its
 * reason is the only thing telling it apart from "the survey does not exist", so match its wording.
 */
const TRIGGER_SURVEY_FIELD = "definition.trigger.config.surveyId";
const NOT_WORKSPACE_VISIBLE_REASON = "not visible to the whole workspace";

export const isTriggerSurveyRestrictedRefusal = (error: unknown): boolean =>
  isRefusal(error) &&
  (error.invalid_params ?? []).some(
    (param) => param.name === TRIGGER_SURVEY_FIELD && param.reason.includes(NOT_WORKSPACE_VISIBLE_REASON)
  );
