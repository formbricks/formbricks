import "server-only";
import type { z } from "zod";
import type { logger } from "@formbricks/logger";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import {
  hubErrorToProblemResponse as sharedHubErrorToProblemResponse,
  relayableHubDetail as sharedRelayableHubDetail,
  type THubProblemOptions,
} from "@/app/api/v3/lib/hub-errors";
import type { InvalidParam } from "@/app/api/v3/lib/response";

/**
 * Error mapping for the feedback-records surface: the detail strings only this surface can explain, and
 * unexpected throws → controlled v3 problem responses. Split out of `operations.ts` so the operations
 * read as a dispatcher and the mapping rules — the part with the disclosure risk — can be tested on
 * their own.
 *
 * The Hub → problem mapping itself now lives in `@/app/api/v3/lib/hub-errors`, shared with the taxonomy
 * surface; it is re-exported here so this module stays the single import site for the operations.
 */

/**
 * The shared Hub mapper, bound to this surface's vocabulary.
 *
 * The Hub calls the tenant `tenant_id`; this surface renames it to `dataset_id` on the way out
 * (`serializeV3FeedbackRecord`), so a relayed message naming `tenant_id` would point a caller at a
 * parameter that does not exist here. That rename is opt-in in the shared mapper rather than automatic,
 * because it is *this* surface's vocabulary: taxonomy shares the same mapper and its outward identifier
 * is `directoryId`, so renaming there would relay a field name belonging to neither side. Binding it
 * once here keeps every operation calling the mapper the same way it always did.
 */
export function hubErrorToProblemResponse(
  error: Parameters<typeof sharedHubErrorToProblemResponse>[0],
  requestId: string,
  instance: string,
  options?: THubProblemOptions
): Response {
  return sharedHubErrorToProblemResponse(error, requestId, instance, {
    ...options,
    renameTenantId: true,
  });
}

export function relayableHubDetail(
  error: Parameters<typeof sharedRelayableHubDetail>[0],
  fallback: string
): string {
  return sharedRelayableHubDetail(error, fallback, true);
}

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

/**
 * Positional wrapper over the shared mapper, kept because every feedback-records operation already calls
 * it this way; the mapping itself lives in `@/app/api/v3/lib/errors`.
 *
 * `operation` is not optional: these operations are reached through MCP as well as HTTP, and every MCP
 * tool passes the same `instance` (`/api/mcp`), so the label is the only thing that says which of the
 * ten failed.
 */
export function handleUnexpectedError(
  err: unknown,
  log: ReturnType<typeof logger.withContext>,
  requestId: string,
  instance: string,
  operation: string
): Response {
  return mapV3ThrownError(err, { log, requestId, instance, operation });
}

export const toInvalidParams = (error: z.ZodError): InvalidParam[] =>
  error.issues.map((issue) => ({ name: issue.path.join("."), reason: issue.message }));
