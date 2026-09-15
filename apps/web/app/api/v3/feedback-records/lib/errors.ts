import "server-only";
import type { z } from "zod";
import type { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  type InvalidParam,
  problemBadGateway,
  problemBadRequest,
  problemConflict,
  problemForbidden,
  problemInternalError,
  problemPayloadTooLarge,
  problemServiceUnavailable,
  problemTooManyRequests,
  problemUnprocessableContent,
} from "@/app/api/v3/lib/response";
import type { HubError } from "@/modules/hub/utils";

/**
 * Error mapping for the feedback-records surface: Hub failures and unexpected throws → controlled v3
 * problem responses. Split out of `operations.ts` so the operations read as a dispatcher and the mapping
 * rules — the part with the disclosure risk — can be tested on their own.
 */

// Bounds on what a Hub 4xx may contribute to our response body (see `hubErrorToProblemResponse`).
const MAX_RELAYED_INVALID_PARAMS = 20;
const MAX_RELAYED_DETAIL_LENGTH = 512;

/**
 * Semantic search and similarity need embeddings, which are optional in the Hub. Our own static message,
 * not the upstream body: it names the setting to change, on both processes that need it.
 *
 * Passed explicitly by the two search operations rather than being the 503 default, because those are the
 * only ones for which it is true — see `GENERIC_SERVICE_UNAVAILABLE_DETAIL`.
 */
export const EMBEDDINGS_UNAVAILABLE_DETAIL =
  "Semantic search is not available: the feedback service has no embedding model configured. A self-hosting administrator can enable it by setting EMBEDDING_PROVIDER and EMBEDDING_MODEL on both the Hub API and the Hub worker.";

/**
 * A record that exists and belongs to the caller, yet has no embedding — the only thing a Hub 404 can
 * mean once ownership is proven. Reported as 409, not 404, because the record *is* there; the message
 * distinguishes the two causes, because only one of them is worth retrying (a fresh record is still being
 * embedded, whereas a record with no text has no embedding to wait for).
 */
export const EMBEDDING_PENDING_DETAIL =
  "This feedback record has no embedding, so similar records cannot be found. If it was just created, embeddings are generated in the background — retry in a moment. If it has no text, or its text was cleared by an update, it has no embedding at all and retrying will not help.";

/**
 * What a 503 says when the caller has not named a cause. Deliberately vague: the Hub answers 503 for
 * several unrelated unconfigured subsystems, so naming one would be wrong for the rest — a plain Hub outage
 * on a list or a create must not tell an operator to configure embeddings, which has nothing to do with it.
 */
const GENERIC_SERVICE_UNAVAILABLE_DETAIL =
  "This feature depends on a part of the feedback service that is not configured on this deployment.";

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

/**
 * Map a Hub service error to a controlled v3 problem response.
 *
 * A Hub 400/422 describes the *caller's own* input, so its field-level detail is relayed: the Hub owns
 * the content rules we deliberately don't duplicate here (NULL bytes, its own length limits), and
 * without them an agent can't correct its request. Everything else —
 * unconfigured/unreachable Hub, our own Hub credentials being rejected, upstream 5xx — collapses to a
 * generic 502 and is only ever logged, never echoed.
 */
export function hubErrorToProblemResponse(
  error: HubError | null,
  requestId: string,
  instance: string,
  options?: {
    /**
     * What a Hub 503 means for this operation. Worth passing from any caller that can actually receive one;
     * the rest get a message that names no subsystem.
     */
    serviceUnavailableDetail?: string;
  }
): Response {
  const status = error?.status ?? 0;
  if (status === 429) {
    return problemTooManyRequests(requestId, "The feedback service is rate limiting requests.");
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
    // Only name/reason cross over: the Hub's `code` vocabulary is its own, not the v3 InvalidParamCode set.
    // Bounded on both axes — the Hub is a remote service, so we don't let it size our response body.
    const invalidParams: InvalidParam[] | undefined = error?.invalidParams
      ?.slice(0, MAX_RELAYED_INVALID_PARAMS)
      .map(({ name, reason }) => ({
        name: toApiVocabulary(name).slice(0, MAX_RELAYED_DETAIL_LENGTH),
        reason: toApiVocabulary(reason).slice(0, MAX_RELAYED_DETAIL_LENGTH),
      }));
    const detail = relayableHubDetail(error, "The feedback service rejected the request.");

    return status === 400
      ? problemBadRequest(requestId, detail, { instance, invalid_params: invalidParams })
      : problemUnprocessableContent(requestId, detail, { instance, invalid_params: invalidParams });
  }

  return problemBadGateway(requestId, "The feedback service is unavailable.", instance);
}

export function handleUnexpectedError(
  err: unknown,
  log: ReturnType<typeof logger.withContext>,
  requestId: string,
  instance: string
): Response {
  if (err instanceof ResourceNotFoundError) {
    log.warn({ statusCode: 403, errorCode: err.name }, "Resource not found");
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }
  if (err instanceof DatabaseError) {
    log.error({ error: err, statusCode: 500 }, "Database error");
    return problemInternalError(requestId, "An unexpected error occurred.", instance);
  }
  log.error({ error: err, statusCode: 500 }, "Unexpected error");
  return problemInternalError(requestId, "An unexpected error occurred.", instance);
}

export const toInvalidParams = (error: z.ZodError): InvalidParam[] =>
  error.issues.map((issue) => ({ name: issue.path.join("."), reason: issue.message }));
