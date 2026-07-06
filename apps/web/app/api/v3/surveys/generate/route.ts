import { logger } from "@formbricks/logger";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import {
  problemAIUnavailable,
  problemBadGateway,
  problemBadRequest,
  problemNotFound,
  problemTooManyRequests,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { AI_ERROR_CODES, type TAIErrorCode } from "@/lib/ai/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getSessionUserId } from "../lib/operations";
import { ZV3SurveyGenerateBody } from "./schemas";
import {
  V3SurveyGeneratePromptError,
  V3SurveyGeneratedPayloadValidationError,
  generateV3SurveyCreatePayloadFromPrompt,
} from "./service";

const AI_UNAVAILABLE_DETAILS: Record<TAIErrorCode, string> = {
  [AI_ERROR_CODES.FEATURES_NOT_ENABLED]: "AI smart tools are not available for this organization.",
  [AI_ERROR_CODES.SMART_TOOLS_DISABLED]: "AI smart tools are disabled for this organization.",
  [AI_ERROR_CODES.INSTANCE_NOT_CONFIGURED]: "AI is not configured for this Formbricks instance.",
  // Quota exhaustion is surfaced as a 429 (see the TooManyRequestsError branch below), not as an
  // AI-unavailable 503 — this entry only keeps the code map exhaustive.
  [AI_ERROR_CODES.QUOTA_EXCEEDED]: "The AI provider is temporarily rate-limited. Try again shortly.",
};

function isAIErrorCode(value: string): value is TAIErrorCode {
  return Object.values(AI_ERROR_CODES).includes(value as TAIErrorCode);
}

export const POST = withV3ApiWrapper({
  auth: "both",
  customRateLimitConfig: rateLimitConfigs.api.v3SurveyGenerate,
  schemas: {
    body: ZV3SurveyGenerateBody,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) => {
    const { body } = parsedInput;
    const workspaceAccess = await requireV3WorkspaceAccess(
      authentication,
      body.workspaceId,
      "readWrite",
      requestId,
      instance
    );

    if (workspaceAccess instanceof Response) {
      return workspaceAccess;
    }

    try {
      const result = await generateV3SurveyCreatePayloadFromPrompt({
        organizationId: workspaceAccess.organizationId,
        input: body,
      });

      const userId = getSessionUserId(authentication);
      if (userId) {
        capturePostHogEvent(
          userId,
          "ai_survey_generated",
          { prompt_length: body.prompt.length },
          { organizationId: workspaceAccess.organizationId, workspaceId: workspaceAccess.workspaceId }
        );
      }

      return successResponse(result, { requestId });
    } catch (error) {
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

      if (error instanceof OperationNotAllowedError && isAIErrorCode(error.message)) {
        return problemAIUnavailable(
          requestId,
          AI_UNAVAILABLE_DETAILS[error.message],
          error.message,
          instance
        );
      }

      if (error instanceof V3SurveyGeneratedPayloadValidationError) {
        return problemUnprocessableContent(requestId, error.message, {
          instance,
          code: "ai_generated_payload_invalid",
          invalid_params: error.invalidParams,
        });
      }

      if (error instanceof ResourceNotFoundError) {
        return problemNotFound(requestId, "Organization", workspaceAccess.organizationId, instance);
      }

      logger.error(
        {
          err: error,
          requestId,
          workspaceId: body.workspaceId,
          organizationId: workspaceAccess.organizationId,
        },
        "Failed to generate v3 survey create payload"
      );

      return problemBadGateway(
        requestId,
        "The AI provider could not generate a valid survey draft. Try again or add more detail.",
        instance
      );
    }
  },
});
