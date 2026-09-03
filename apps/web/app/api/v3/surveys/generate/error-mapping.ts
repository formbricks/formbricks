import { AIOutputTokenLimitError } from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import {
  problemAIUnavailable,
  problemBadGateway,
  problemBadRequest,
  problemNotFound,
  problemTooManyRequests,
  problemUnprocessableContent,
} from "@/app/api/v3/lib/response";
import { AI_ERROR_CODES, type TAIErrorCode } from "@/lib/ai/service";
import { V3SurveyGeneratePromptError, V3SurveyGeneratedPayloadValidationError } from "./service";

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

interface TGenerateErrorContext {
  requestId: string;
  instance: string;
  workspaceId: string;
  organizationId: string;
}

/**
 * Map an error thrown while generating a survey draft to its problem+json Response. Extracted from
 * the route handler to keep that handler's cognitive complexity within bounds.
 */
export function mapV3SurveyGenerateError(
  error: unknown,
  { requestId, instance, workspaceId, organizationId }: TGenerateErrorContext
): Response {
  if (error instanceof V3SurveyGeneratePromptError) {
    return problemBadRequest(requestId, error.message, {
      instance,
      invalid_params: error.invalidParams,
    });
  }

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

  if (error instanceof V3SurveyGeneratedPayloadValidationError) {
    return problemUnprocessableContent(requestId, error.message, {
      instance,
      code: "ai_generated_payload_invalid",
      invalid_params: error.invalidParams,
    });
  }

  if (error instanceof AIOutputTokenLimitError) {
    return problemUnprocessableContent(
      requestId,
      "The generated survey exceeded the AI output token limit. Simplify the prompt or split it into smaller surveys.",
      {
        instance,
        code: "ai_output_too_long",
      }
    );
  }

  if (error instanceof ResourceNotFoundError) {
    return problemNotFound(requestId, "Organization", organizationId, instance);
  }

  logger.error(
    {
      err: error,
      requestId,
      workspaceId,
      organizationId,
    },
    "Failed to generate v3 survey create payload"
  );

  return problemBadGateway(
    requestId,
    "The AI provider could not generate a valid survey draft. Try again or add more detail.",
    instance
  );
}
