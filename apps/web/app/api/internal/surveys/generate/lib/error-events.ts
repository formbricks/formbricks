import { classifyAIStreamFailure } from "@/app/api/internal/lib/ai-stream-errors";
import { V3SurveyGeneratedPayloadValidationError } from "@/app/api/v3/surveys/generate/service";
import { SURVEY_GENERATION_STREAM_ERROR_CODES, type TSurveyGenerationStreamEvent } from "./events";

/**
 * Fixed detail strings, one per code.
 *
 * Never interpolate the caught error's message: an in-band error event is rendered to the user, and
 * provider errors routinely echo fragments of the prompt back in their message.
 */
const STREAM_ERROR_DETAILS = {
  [SURVEY_GENERATION_STREAM_ERROR_CODES.QUOTA_EXCEEDED]:
    "The AI provider is temporarily rate-limited. Try again shortly.",
  // An operator problem, not a prompt problem: "add more detail" would send the user rewriting a
  // prompt that was never the cause.
  [SURVEY_GENERATION_STREAM_ERROR_CODES.AUTH_FAILED]:
    "The AI provider rejected this instance's credentials. Ask your administrator to check the AI provider configuration.",
  [SURVEY_GENERATION_STREAM_ERROR_CODES.OUTPUT_TOO_LONG]:
    "The generated survey exceeded the AI output token limit. Simplify the prompt or split it into smaller surveys.",
  [SURVEY_GENERATION_STREAM_ERROR_CODES.PAYLOAD_INVALID]:
    "The generated survey draft could not be validated.",
  [SURVEY_GENERATION_STREAM_ERROR_CODES.GENERATION_FAILED]:
    "The AI provider could not finish the survey draft. Try again or add more detail.",
} as const;

/**
 * Map a mid-generation failure to the in-band event the client renders.
 *
 * Only failures that can happen *after* the response body has opened belong here — entitlement,
 * auth, rate limiting and body validation are all guarded before the first byte and answer with a
 * proper RFC 9457 problem response instead.
 */
export function toStreamErrorEvent(error: unknown): Extract<TSurveyGenerationStreamEvent, { type: "error" }> {
  const aiFailure = classifyAIStreamFailure(error);
  if (aiFailure) {
    return { type: "error", ...aiFailure, detail: STREAM_ERROR_DETAILS[aiFailure.code] };
  }

  if (error instanceof V3SurveyGeneratedPayloadValidationError) {
    return {
      type: "error",
      code: SURVEY_GENERATION_STREAM_ERROR_CODES.PAYLOAD_INVALID,
      detail: STREAM_ERROR_DETAILS[SURVEY_GENERATION_STREAM_ERROR_CODES.PAYLOAD_INVALID],
      invalid_params: error.invalidParams,
    };
  }

  return {
    type: "error",
    code: SURVEY_GENERATION_STREAM_ERROR_CODES.GENERATION_FAILED,
    detail: STREAM_ERROR_DETAILS[SURVEY_GENERATION_STREAM_ERROR_CODES.GENERATION_FAILED],
  };
}
