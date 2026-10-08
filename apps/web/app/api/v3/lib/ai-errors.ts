import { classifyAIProviderError } from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { loggableError } from "@/app/api/v3/lib/loggable-error";
import { problemAIUnavailable, problemBadGateway, problemTooManyRequests } from "@/app/api/v3/lib/response";
import { AI_ERROR_CODES, type TAIErrorCode } from "@/lib/ai/service";

/**
 * The AI error codes that describe a capability the caller cannot use, and so map to an AI-unavailable
 * problem response.
 *
 * Quota exhaustion is deliberately not one of them: `@/lib/ai/service` raises it as a
 * `TooManyRequestsError` (never an `OperationNotAllowedError`), so it is answered as a 429 by the branch
 * below. Excluding it here is what keeps every code this mapper can emit inside `V3_PROBLEM_CODES` —
 * `ai_quota_exceeded` is not a published problem code.
 */
type TAIUnavailableCode = Exclude<TAIErrorCode, typeof AI_ERROR_CODES.QUOTA_EXCEEDED>;

const AI_UNAVAILABLE_DETAILS: Record<TAIUnavailableCode, string> = {
  [AI_ERROR_CODES.FEATURES_NOT_ENABLED]: "AI smart tools are not available for this organization.",
  [AI_ERROR_CODES.SMART_TOOLS_DISABLED]: "AI smart tools are disabled for this organization.",
  [AI_ERROR_CODES.INSTANCE_NOT_CONFIGURED]: "AI is not configured for this Formbricks instance.",
};

function isAIUnavailableCode(value: string): value is TAIUnavailableCode {
  return Object.hasOwn(AI_UNAVAILABLE_DETAILS, value);
}

export interface TV3AIErrorContext {
  requestId: string;
  instance: string;
  workspaceId: string;
  organizationId: string;
  /** Names the operation in the log line of a mapped `ResourceNotFoundError`, e.g. `surveys.generate`. */
  operation: string;
}

/**
 * Map the errors every AI-backed operation can raise to their problem responses, or return null so the
 * caller maps what is specific to it.
 *
 * Shared by Create with AI and the Qualtrics import, so the same gate failure reads the same everywhere —
 * one code per reason, which is what lets a dialog show Create with AI's message for it (ENG-3603):
 *
 * - provider or Formbricks quota exhausted → 429 with `Retry-After`
 * - not in the plan (`ai_features_not_enabled`) or switched off for the organization
 *   (`ai_smart_tools_disabled`) → 403; no AI provider on the instance
 *   (`ai_instance_not_configured`) → 503
 * - the workspace's organization is gone → 403, the same as every other v3 surface
 * - the provider rejected this instance's credentials → 502 `ai_provider_auth_failed`, with an
 *   operator-facing message instead of advice the user cannot act on
 */
export function mapV3AIError(
  error: unknown,
  { requestId, instance, workspaceId, organizationId, operation }: TV3AIErrorContext
): Response | null {
  if (error instanceof TooManyRequestsError) {
    return problemTooManyRequests(
      requestId,
      "The AI provider is temporarily rate-limited. Try again shortly.",
      error.retryAfter
    );
  }

  if (error instanceof OperationNotAllowedError && isAIUnavailableCode(error.message)) {
    return problemAIUnavailable(requestId, AI_UNAVAILABLE_DETAILS[error.message], error.message, instance);
  }

  /**
   * The organization behind a workspace the caller already has access to. A 404 here both contradicts
   * `problemNotFound`'s own contract — its body carries `resource_type` and `resource_id`, which must not
   * go to a caller who may not know the resource exists — and reports a server-derived id back as though
   * the caller had asked for it. 403 matches every other v3 surface.
   */
  if (error instanceof ResourceNotFoundError) {
    return mapV3ThrownError(error, {
      log: logger.withContext({ requestId, workspaceId, organizationId }),
      requestId,
      instance,
      operation,
    });
  }

  // Logged with its status by handleAIError already; the caller gets an operator-facing message
  // instead of advice about its own input, which cannot fix a credentials problem.
  if (classifyAIProviderError(error)?.isAuthFailure) {
    return problemBadGateway(
      requestId,
      "The AI provider rejected this instance's credentials. Ask your administrator to check the AI provider configuration.",
      instance,
      "ai_provider_auth_failed"
    );
  }

  return null;
}

/**
 * What an AI failure may put in the log: `loggableError`'s name and frames, plus the provider's
 * status. Never a message: the AI SDK's errors keep the prompt or the model's output in their message
 * and fields (`NoObjectGeneratedError.text`, `TypeValidationError.value`), and pino's error serializer
 * would log all of it.
 */
export function loggableAIError(error: unknown): Record<string, unknown> {
  const providerStatusCode = error instanceof Error ? classifyAIProviderError(error)?.statusCode : undefined;
  return {
    ...loggableError(error),
    ...(providerStatusCode === undefined ? {} : { providerStatusCode }),
  };
}
