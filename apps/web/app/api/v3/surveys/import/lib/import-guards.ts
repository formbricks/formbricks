import "server-only";
import { TooManyRequestsError } from "@formbricks/types/errors";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { problemConflictWithRetry, problemTooManyRequests } from "@/app/api/v3/lib/response";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { ImportInProgressError } from "@/modules/survey/import/lib/ai-inflight-guard";

/**
 * The per-workspace import budget (200/hour across convert, stream and import). Returns the 429 to
 * send, or null when the request may proceed.
 */
export async function guardImportWorkspaceBudget(
  workspaceId: string,
  requestId: string
): Promise<Response | null> {
  try {
    await applyRateLimit(rateLimitConfigs.api.v3SurveyImportPerWorkspace, workspaceId);
    return null;
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      return problemTooManyRequests(
        requestId,
        "This workspace has reached its hourly import limit. Try again later.",
        error.retryAfter
      );
    }
    throw error;
  }
}

/** The 409 for a third concurrent AI conversion. */
export function problemImportInProgress(
  requestId: string,
  error: ImportInProgressError,
  instance: string
): Response {
  return problemConflictWithRetry(requestId, error.message, {
    instance,
    code: "import_in_progress",
    retryAfter: error.retryAfter,
  });
}

const MAX_LOGGED_REASON_CHARS = 80;

/** Log-safe copy of `invalid_params`: reasons can echo document text, so they are cut at 80 chars. */
export function redactInvalidParams(params: readonly InvalidParam[]): InvalidParam[] {
  return params.map((param) => ({
    ...param,
    reason:
      param.reason.length > MAX_LOGGED_REASON_CHARS
        ? `${param.reason.slice(0, MAX_LOGGED_REASON_CHARS)}…`
        : param.reason,
  }));
}
