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
 */
export const EMBEDDINGS_UNAVAILABLE_DETAIL =
  "Semantic search is not available: the feedback service has no embedding model configured. A self-hosting administrator can enable it by setting EMBEDDING_PROVIDER and EMBEDDING_MODEL on both the Hub API and the Hub worker.";

/**
 * A record that exists and belongs to the caller, yet has no embedding — the only thing a Hub 404 can
 * mean once ownership is proven. Reported as 409 (retryable state), not 404: the record is there.
 */
export const EMBEDDING_PENDING_DETAIL =
  "This feedback record has no embedding yet, so similar records cannot be found. Embeddings are generated in the background shortly after a record is created; retry in a moment. Records without text are never embedded.";

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
  instance: string
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
      error?.problemDetail?.slice(0, MAX_RELAYED_DETAIL_LENGTH) ??
        "The feedback service reported a conflict.",
      instance
    );
  }

  // The Hub's body cap is lower than ours, so this is reachable with a large (but locally valid) payload.
  if (status === 413) {
    return problemPayloadTooLarge(requestId, "The feedback record is too large.", instance);
  }

  // Embeddings are optional in the Hub, and the search endpoints are the only ones that need them. A
  // deployment-level "not enabled", not an outage — so it must not collapse into the generic 502 below,
  // which would read as "retry later" for something no retry can fix.
  if (status === 503) {
    return problemServiceUnavailable(requestId, EMBEDDINGS_UNAVAILABLE_DETAIL, instance);
  }

  if (status === 400 || status === 422) {
    // Only name/reason cross over: the Hub's `code` vocabulary is its own, not the v3 InvalidParamCode set.
    // Bounded on both axes — the Hub is a remote service, so we don't let it size our response body.
    const invalidParams: InvalidParam[] | undefined = error?.invalidParams
      ?.slice(0, MAX_RELAYED_INVALID_PARAMS)
      .map(({ name, reason }) => ({
        name: name.slice(0, MAX_RELAYED_DETAIL_LENGTH),
        reason: reason.slice(0, MAX_RELAYED_DETAIL_LENGTH),
      }));
    const detail =
      error?.problemDetail?.slice(0, MAX_RELAYED_DETAIL_LENGTH) ??
      "The feedback service rejected the request.";

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
