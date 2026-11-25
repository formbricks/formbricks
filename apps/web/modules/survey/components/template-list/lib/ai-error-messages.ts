import { getAIUnavailableMessageForErrorCode } from "@/lib/ai/availability";
import { V3ApiError } from "@/modules/api/lib/v3-client";

type TranslateFn = (key: string) => string;

/**
 * A client-side code, not one the API sends: the generate endpoints answer a too-thin prompt with a
 * plain `bad_request` whose `invalid_params` name the prompt. Telling that apart from any other
 * rejected body lets the user read what to add instead of "try rephrasing it" (ENG-2187).
 *
 * Its copy, `workspace.surveys.ai_create.prompt_needs_more_detail`, is the translated form of the
 * reason `getPromptInvalidParams` sends (`app/api/v3/surveys/generate/service.ts`): reword both.
 * The schema's own prompt bounds also answer `bad_request` naming the prompt, but the dialog's
 * minimum and `maxLength` keep those from being sent.
 */
const AI_PROMPT_NEEDS_MORE_DETAIL = "ai_prompt_needs_more_detail";

/**
 * One place that turns an AI error code into the sentence the user reads.
 *
 * Deliberately shared between the two ways a generation can fail: an HTTP `problem+json` raised
 * before the stream opened, and an in-band `error` event raised after it did. Same codes, same
 * copy, one place to change it.
 *
 * Takes `t` rather than returning a bare key so the literals stay visible to the translation
 * scanner — and it is still testable by passing an identity function.
 */
export function getAiErrorMessage(code: string | undefined, t: TranslateFn): string {
  // The codes that mean "AI is unavailable" read the same sentence every other AI gate shows, so
  // the entitlement, organization-toggle and instance-config wording lives in one place.
  const aiUnavailableMessage = getAIUnavailableMessageForErrorCode(code, t);
  if (aiUnavailableMessage) {
    return aiUnavailableMessage;
  }

  switch (code) {
    case "ai_generated_payload_invalid":
      return t("workspace.surveys.ai_create.generated_payload_invalid");
    case "ai_output_too_long":
      return t("workspace.surveys.ai_create.ai_output_too_long");
    case "ai_quota_exceeded":
      return t("workspace.surveys.ai_create.ai_rate_limited");
    case "ai_provider_auth_failed":
      return t("workspace.surveys.ai_create.provider_auth_failed");
    case "ai_generation_failed":
      return t("workspace.surveys.ai_create.generation_failed");
    case "ai_nothing_generated":
      return t("workspace.surveys.ai_create.nothing_generated");
    // Raised by the API wrapper rather than by generation, so the codes are its own. Without these
    // the 10/min limit reads as "something went wrong", which tells the user nothing to do about it.
    case "too_many_requests":
      return t("workspace.surveys.ai_create.too_many_requests");
    case "bad_request":
      return t("workspace.surveys.ai_create.request_rejected");
    case AI_PROMPT_NEEDS_MORE_DETAIL:
      return t("workspace.surveys.ai_create.prompt_needs_more_detail");
    default:
      return t("common.something_went_wrong_please_try_again");
  }
}

/**
 * The code carried by a thrown error, for the pre-stream `problem+json` path.
 *
 * Falls back to a non-empty sentinel rather than null so an unrecognised failure — a dropped
 * connection, say — still renders the generic message instead of silently clearing the error.
 */
export function getAiErrorCode(error: unknown): string {
  if (!(error instanceof V3ApiError)) {
    return "ai_unknown";
  }

  if (error.code === "bad_request" && error.invalid_params?.some((param) => param.name === "prompt")) {
    return AI_PROMPT_NEEDS_MORE_DETAIL;
  }

  return error.code ?? "ai_unknown";
}
