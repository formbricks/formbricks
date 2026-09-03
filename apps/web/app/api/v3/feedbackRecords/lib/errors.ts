import "server-only";
import type { z } from "zod";
import type { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { type InvalidParam, problemForbidden, problemInternalError } from "@/app/api/v3/lib/response";

/**
 * Error mapping for the feedback-records surface: the detail strings only this surface can explain, and
 * unexpected throws → controlled v3 problem responses. Split out of `operations.ts` so the operations
 * read as a dispatcher and the mapping rules — the part with the disclosure risk — can be tested on
 * their own.
 *
 * The Hub → problem mapping itself now lives in `@/app/api/v3/lib/hub-errors`, shared with the taxonomy
 * surface; it is re-exported here so this module stays the single import site for the operations.
 */

export { hubErrorToProblemResponse, relayableHubDetail } from "@/app/api/v3/lib/hub-errors";

/**
 * Semantic search and similarity need embeddings, which are optional in the Hub. Our own static message,
 * not the upstream body: it names the setting to change, on both processes that need it.
 *
 * Passed explicitly by the two search operations rather than being the 503 default, because those are the
 * only ones for which it is true — every other operation gets a message that names no subsystem.
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
