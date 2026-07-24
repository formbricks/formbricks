import { ResourceNotFoundError, isExpectedError } from "@formbricks/types/errors";
import { responses } from "@/app/lib/api/response";

/**
 * Fixed, client-facing message returned for any unexpected or server-side (5xx) error.
 * Intentionally generic so we never leak internal details (e.g. a `DatabaseError` wrapping a raw
 * Prisma message with schema/column/constraint info). Matches the string used by the v2 routes.
 */
export const GENERIC_API_ERROR_MESSAGE = "Something went wrong. Please try again.";

/** The `{ response, error? }` result shape v1 route handlers return to `withV1ApiWrapper`. */
export interface ApiErrorResult {
  response: Response;
  /** The real caught error, threaded back so the wrapper's `reportApiError` logs/reports it (5xx path). */
  error?: unknown;
}

interface HandleApiErrorOptions {
  /** Pass `true` for public/client routes so the error response carries CORS headers. */
  cors?: boolean;
}

/**
 * Shared error boundary for v1 API handlers. Maps a caught error to the
 * `{ response, error? }` result shape expected by `withV1ApiWrapper`.
 *
 * - Expected business errors with a **4xx** status surface their (domain-authored, safe) message
 *   at the correct status.
 * - Everything else — `DatabaseError`, `QueryExecutionError`, `UnknownError`, any other 5xx, or a
 *   non-domain `Error` — returns the fixed {@link GENERIC_API_ERROR_MESSAGE} and threads the real
 *   `error` back so the wrapper's `reportApiError` logs it (and reports it to Sentry on 5xx). This
 *   guarantees no raw `error.message` is ever echoed on the unexpected/5xx path.
 *
 * Rate-limit (429) and payload-too-large (413) errors are handled at their own boundaries (the
 * wrapper's rate limiter and `parseJsonBodyWithLimit` respectively) and never reach here, so they
 * are not mapped explicitly.
 *
 * @param error - The caught error (unknown).
 * @param options.cors - Whether the response should include CORS headers (public/client routes).
 */
export const handleApiError = (
  error: unknown,
  { cors = false }: HandleApiErrorOptions = {}
): ApiErrorResult => {
  if (error instanceof Error && isExpectedError(error)) {
    // `isExpectedError` also matches business errors that are technically 5xx (e.g.
    // QueryExecutionError), so gate on the status: only 4xx messages are safe to surface.
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    if (statusCode < 500) {
      switch (statusCode) {
        case 400:
          return { response: responses.badRequestResponse(error.message, undefined, cors) };
        case 401:
          return { response: responses.notAuthenticatedResponse(cors) };
        case 403:
          return { response: responses.forbiddenResponse(error.message, cors) };
        case 404:
          return {
            response:
              error instanceof ResourceNotFoundError
                ? responses.notFoundResponse(error.resourceType, error.resourceId, cors)
                : responses.notFoundResponse("Resource", null, cors),
          };
        case 409:
          return { response: responses.conflictResponse(error.message, undefined, cors) };
      }
    }
  }

  // Unexpected / 5xx: generic message to the client, real error threaded back for server-side
  // reporting via the wrapper's reportApiError.
  return {
    response: responses.internalServerErrorResponse(GENERIC_API_ERROR_MESSAGE, cors),
    error,
  };
};
