import { V3ApiError } from "@/modules/api/lib/v3-client";

type TranslateFn = (key: string) => string;

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
  switch (code) {
    case "ai_features_not_enabled":
      return t("workspace.surveys.ai_create.ai_not_in_plan");
    case "ai_smart_tools_disabled":
      return t("workspace.surveys.ai_create.ai_not_enabled");
    case "ai_instance_not_configured":
      return t("workspace.surveys.ai_create.ai_instance_not_configured");
    case "ai_generated_payload_invalid":
      return t("workspace.surveys.ai_create.generated_payload_invalid");
    case "ai_output_too_long":
      return t("workspace.surveys.ai_create.ai_output_too_long");
    case "ai_quota_exceeded":
      return t("workspace.surveys.ai_create.ai_rate_limited");
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
  return (error instanceof V3ApiError ? error.code : undefined) ?? "ai_unknown";
}
