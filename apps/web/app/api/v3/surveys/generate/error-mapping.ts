import { AIOutputTokenLimitError } from "@formbricks/ai";
import { logger } from "@formbricks/logger";
import { mapV3AIError } from "@/app/api/v3/lib/ai-errors";
import { problemBadGateway, problemBadRequest, problemUnprocessableContent } from "@/app/api/v3/lib/response";
import { V3SurveyGeneratePromptError, V3SurveyGeneratedPayloadValidationError } from "./service";

interface TGenerateErrorContext {
  requestId: string;
  instance: string;
  workspaceId: string;
  organizationId: string;
}

/**
 * Map an error thrown while generating a survey draft to its problem+json Response. Extracted from
 * the route handler to keep that handler's cognitive complexity within bounds.
 *
 * Errors any AI-backed operation can raise (the AI gate, quota, provider credentials) go through the
 * shared `mapV3AIError`; this maps only what is specific to generating a draft from a prompt.
 */
export function mapV3SurveyGenerateError(error: unknown, context: TGenerateErrorContext): Response {
  const { requestId, instance, workspaceId, organizationId } = context;

  if (error instanceof V3SurveyGeneratePromptError) {
    return problemBadRequest(requestId, error.message, {
      instance,
      invalid_params: error.invalidParams,
    });
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

  const aiResponse = mapV3AIError(error, { ...context, operation: "surveys.generate" });
  if (aiResponse) {
    return aiResponse;
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
