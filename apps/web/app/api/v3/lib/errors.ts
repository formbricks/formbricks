import "server-only";
import type { logger } from "@formbricks/logger";
import {
  AuthorizationError,
  DatabaseError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { problemForbidden, problemInternalError, problemTooManyRequests } from "@/app/api/v3/lib/response";

/**
 * The one place that turns an unexpected throw into a v3 problem response.
 *
 * This tail — missing resource, database failure, anything else — used to be written out at every v3
 * error boundary, nine times, with the branches in different orders and the log fields under different
 * keys. Duplicating it meant each surface separately re-decided what a thrown error may disclose, which
 * is the decision least safe to re-make by hand.
 *
 * Callers own the branches above this one. A surface that can distinguish its own domain failures maps
 * those first and delegates the tail here — see `mapV3SurveyCreateError` and
 * `mapV3SurveyGenerateError`. A surface with nothing to add calls this directly.
 */

/**
 * The part of the request-bound logger this mapper uses. Narrower than the logger itself on purpose: it
 * only ever writes one line, so callers are not asked for a whole pino instance and a test can supply a
 * plain pair of spies without casting.
 */
type TV3ErrorLogger = Pick<ReturnType<typeof logger.withContext>, "warn" | "error">;

type TV3ErrorContext = {
  log: TV3ErrorLogger;
  requestId: string;
  instance: string;
  /**
   * Dotted operation label ("surveys.archive"), for tracing which operation failed.
   *
   * A structured log field rather than part of the message, so the messages here stay a small closed set
   * that can be grouped and alerted on. It replaces the six bespoke message strings the copies used
   * ("V3 surveys list unexpected error", "V3 survey get unexpected error", …), which could not be
   * queried as one thing.
   */
  operation?: string;
  /**
   * Extra log fields, for context an operation only resolves partway through and so cannot put on its
   * request-bound logger — the survey patch path's `workspaceId` is the one case today.
   *
   * Merged into the log entry, never into the response body.
   */
  logFields?: Record<string, unknown>;
};

/**
 * Map an unexpected throw to a controlled v3 problem response, logging it exactly once.
 *
 * Two rules hold across every branch. A 5xx never echoes the error's message: `DatabaseError` wraps the
 * raw Prisma text by codebase convention, which carries table, column and constraint names. And a 4xx
 * only ever carries a fixed string — an `AuthorizationError`'s or `OperationNotAllowedError`'s message
 * is written for a developer, and `@/lib/ai/service` even throws the latter with a machine code as its
 * message.
 *
 * The thrown value is logged under the key `err`, not `error`: `@formbricks/logger` registers
 * pino's `stdSerializers.err` for that key only, so any other key logs the enumerable own properties
 * and silently drops `message` and `stack` — which is most of what a 500's log is for.
 *
 * `ValidationError` and `InvalidInputError` are deliberately absent. Both are 400-ish by `statusCode`,
 * but neither is safe to map centrally: `createSurvey` throws `ValidationError` from work it does
 * *after* its transaction commits, where a 4xx would wrongly tell the caller nothing was written
 * (ENG-2587), and `InvalidInputError` is only the caller's fault where the operation has established
 * that the input is theirs. Both stay with the surfaces that can tell the difference, above this call.
 */
export function mapV3ThrownError(err: unknown, ctx: TV3ErrorContext): Response {
  const { log, requestId, instance, operation, logFields } = ctx;
  const context = { ...logFields, ...(operation ? { operation } : {}) };

  /**
   * 403, not 404: a resource the caller cannot see must not be distinguishable from one that does not
   * exist, or the response becomes an existence oracle. The id is left out of the body for the same
   * reason — it is in the log, correlated by `requestId`.
   */
  if (err instanceof ResourceNotFoundError) {
    log.warn({ ...context, statusCode: 403, errorCode: err.name }, "V3 resource not found");
    return problemForbidden(requestId, undefined, instance);
  }

  if (err instanceof AuthorizationError || err instanceof OperationNotAllowedError) {
    log.warn({ ...context, statusCode: 403, errorCode: err.name }, "V3 operation not permitted");
    return problemForbidden(requestId, undefined, instance);
  }

  // Raised by a dependency the operation called, not by this API's own rate limiter (which answers in
  // `withV3ApiWrapper` before the handler runs). Passing `retryAfter` through is what stops an agent
  // retry-looping blind.
  if (err instanceof TooManyRequestsError) {
    log.warn({ ...context, statusCode: 429, errorCode: err.name }, "V3 upstream rate limit");
    return problemTooManyRequests(
      requestId,
      "The service is rate limiting requests. Try again shortly.",
      err.retryAfter,
      instance
    );
  }

  if (err instanceof DatabaseError) {
    log.error({ ...context, err, statusCode: 500 }, "V3 database error");
    return problemInternalError(requestId, undefined, instance);
  }

  log.error({ ...context, err, statusCode: 500 }, "V3 unexpected error");
  return problemInternalError(requestId, undefined, instance);
}
