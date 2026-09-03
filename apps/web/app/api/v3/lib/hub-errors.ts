import "server-only";
import {
  type InvalidParam,
  problemBadGateway,
  problemBadRequest,
  problemConflict,
  problemNotFound,
  problemPayloadTooLarge,
  problemServiceUnavailable,
  problemTooManyRequests,
  problemUnprocessableContent,
} from "@/app/api/v3/lib/response";
import { type HubError, isHubNotConfigured } from "@/modules/hub/utils";

/**
 * The one place that turns a Hub (upstream) failure into a v3 problem response.
 *
 * Shared by every surface that calls the Hub — feedback records and taxonomy — because the two had
 * drifted into opposite gaps while implementing the same contract: the feedback-records mapper relayed
 * a Hub 400's field-level detail but never mapped a 404, and taxonomy's mapper mapped the 404 but threw
 * the actionable 400 away and collapsed a real upstream 503 into a 502 (ENG-2253). One implementation
 * cannot drift from itself.
 */

// Bounds on what a Hub 4xx may contribute to our response body (see `hubErrorToProblemResponse`).
const MAX_RELAYED_INVALID_PARAMS = 20;
const MAX_RELAYED_DETAIL_LENGTH = 512;

/**
 * What a 503 says when the caller has not named a cause. Deliberately vague: the Hub answers 503 for
 * several unrelated unconfigured subsystems, so naming one would be wrong for the rest — a plain Hub outage
 * on a list or a create must not tell an operator to configure embeddings, which has nothing to do with it.
 */
const GENERIC_SERVICE_UNAVAILABLE_DETAIL =
  "This feature depends on a part of the feedback service that is not configured on this deployment.";

/** A Hub that is switched off on this deployment, as opposed to one that is configured but failing. */
const HUB_NOT_CONFIGURED_DETAIL = "The Hub integration is not configured on this deployment.";

/** The 502 detail when the caller has not supplied one. */
const GENERIC_BAD_GATEWAY_DETAIL = "The feedback service is unavailable.";

/**
 * Hub statuses whose detail describes the *caller's own* request, and may therefore be echoed: a rejected
 * field value, a duplicate submission, an oversized record.
 *
 * Deliberately not "any 4xx". A Hub 401/403 means *our* Hub credentials were refused and a 404 can reveal
 * upstream addressing — neither is the caller's business, and both would be describing our infrastructure
 * rather than their request.
 */
const RELAYABLE_HUB_STATUSES = new Set([400, 409, 413, 422]);

/**
 * Translate the Hub's internal vocabulary into this API's, for any upstream text we relay.
 *
 * The Hub's tenant *is* our dataset — `serializeV3FeedbackRecord` already renames the field on the way out —
 * so a relayed message naming `tenant_id` contradicts the rest of the surface and points a caller at a
 * parameter that does not exist here. Reproduced with a duplicate create, whose Hub 409 reads "a feedback
 * record with this tenant_id, submission_id, and field_id already exists".
 *
 * Word-bounded so it renames the term and nothing else. Applied to every relayed string — detail and
 * `invalid_params` alike — because the Hub names fields in both.
 */
function toApiVocabulary(text: string): string {
  return text.replace(/\btenant_id\b/g, "dataset_id");
}

/**
 * The one place that decides what a Hub failure may say to a caller.
 *
 * The Hub owns content rules we deliberately don't duplicate (NULL bytes, its own length limits), so for
 * the relayable statuses its message is relayed — bounded, and in this API's vocabulary — because without it
 * an agent cannot correct its own request. Everything else is replaced by a fixed string. Used both for
 * whole-request problem responses and for the per-record failures of a batch write, so neither can drift
 * into leaking more than the other.
 */
export function relayableHubDetail(error: HubError | null, fallback: string): string {
  if (!error?.problemDetail || !RELAYABLE_HUB_STATUSES.has(error.status)) {
    return fallback;
  }
  // Rewritten before slicing, not after: `dataset_id` is a character longer than `tenant_id`, so a
  // slice-then-rewrite could push the result past the cap it is supposed to enforce.
  return toApiVocabulary(error.problemDetail).slice(0, MAX_RELAYED_DETAIL_LENGTH);
}

/** Only name/reason cross over: the Hub's `code` vocabulary is its own, not the v3 InvalidParamCode set. */
function relayableInvalidParams(error: HubError | null): InvalidParam[] | undefined {
  // Bounded on both axes — the Hub is a remote service, so we don't let it size our response body.
  return error?.invalidParams?.slice(0, MAX_RELAYED_INVALID_PARAMS).map(({ name, reason }) => ({
    name: toApiVocabulary(name).slice(0, MAX_RELAYED_DETAIL_LENGTH),
    reason: toApiVocabulary(reason).slice(0, MAX_RELAYED_DETAIL_LENGTH),
  }));
}

export type THubProblemOptions = {
  /**
   * What a Hub 503 means for this operation. Worth passing from any caller that can actually receive one;
   * the rest get a message that names no subsystem.
   */
  serviceUnavailableDetail?: string;
  /**
   * The 502 detail, naming the operation that failed ("Failed to load taxonomy run"). Static text only —
   * never the Hub's own message, which the SDK folds the whole RFC 9457 problem body into.
   */
  badGatewayDetail?: string;
  /**
   * When set, a Hub 404 maps to a 404 for this resource. Omit it on creates, where "not found" says
   * nothing useful about the request.
   *
   * Only safe when the caller has already proven the resource's tenancy — every taxonomy caller checks
   * directory access first and scopes the Hub call by `tenant_id`, so a 404 there only ever means "not in
   * *your* directory" and is no existence oracle (ENG-1886). Without it a 404 stays a 502.
   */
  notFound?: { resourceType: string; resourceId: string };
};

/**
 * Map a Hub service error to a controlled v3 problem response.
 *
 * A Hub 400/422 describes the *caller's own* input, so its field-level detail is relayed: the Hub owns
 * the content rules we deliberately don't duplicate here (NULL bytes, its own length limits), and
 * without them an agent can't correct its request. Everything else — unconfigured/unreachable Hub, our
 * own Hub credentials being rejected, upstream 5xx — collapses to a generic 502 and is only ever logged,
 * never echoed. The full error is already logged in `@/modules/hub/service`; correlate on `requestId`.
 */
export function hubErrorToProblemResponse(
  error: HubError | null,
  requestId: string,
  instance: string,
  options?: THubProblemOptions
): Response {
  // Checked before the status switch: the sentinel's status is 0, which is also what the SDK reports for a
  // dead socket, so only the message tells "switched off here" (503, no retry helps) from "unreachable"
  // (502). Distinguished by `isHubNotConfigured`.
  if (error && isHubNotConfigured(error)) {
    return problemServiceUnavailable(requestId, HUB_NOT_CONFIGURED_DETAIL, instance);
  }

  const status = error?.status ?? 0;

  // A benign "gone, or never existed" — a stale run id, a node someone else just removed. Answering 502
  // both misreads to the caller as a server crash and counts a normal outcome towards the 5xx rate.
  if (status === 404 && options?.notFound) {
    return problemNotFound(requestId, options.notFound.resourceType, options.notFound.resourceId, instance);
  }

  if (status === 429) {
    return problemTooManyRequests(
      requestId,
      "The feedback service is rate limiting requests.",
      undefined,
      instance
    );
  }

  // A duplicate (submission_id, field_id) or an in-progress tenant purge — the caller's request, not an
  // outage, and retryable in the purge case. Reported as 409 so an agent doesn't retry-loop on a 502.
  if (status === 409) {
    return problemConflict(
      requestId,
      relayableHubDetail(error, "The feedback service reported a conflict."),
      instance
    );
  }

  // The Hub's body cap is lower than ours, so this is reachable with a large (but locally valid) payload.
  if (status === 413) {
    return problemPayloadTooLarge(
      requestId,
      relayableHubDetail(error, "The feedback record is too large."),
      instance
    );
  }

  // A deployment-level "not enabled", not an outage — so it must not collapse into the generic 502 below,
  // which would read as "retry later" for something no retry can fix. What is unconfigured depends on the
  // operation, so the wording comes from the caller.
  if (status === 503) {
    return problemServiceUnavailable(
      requestId,
      options?.serviceUnavailableDetail ?? GENERIC_SERVICE_UNAVAILABLE_DETAIL,
      instance
    );
  }

  if (status === 400 || status === 422) {
    const invalidParams = relayableInvalidParams(error);
    const detail = relayableHubDetail(error, "The feedback service rejected the request.");

    return status === 400
      ? problemBadRequest(requestId, detail, { instance, invalid_params: invalidParams })
      : problemUnprocessableContent(requestId, detail, { instance, invalid_params: invalidParams });
  }

  return problemBadGateway(requestId, options?.badGatewayDetail ?? GENERIC_BAD_GATEWAY_DETAIL, instance);
}
