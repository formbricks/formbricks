import { getAIUnavailableMessageForErrorCode } from "@/lib/ai/availability";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { AI_TRANSLATION_FIELD_TOO_LONG } from "./translation-batches";

type TTranslate = (key: string) => string;

/**
 * The sentence for an AI translation error code: AI turned off, out of plan or unconfigured reads the same
 * as every other AI gate; the provider's quota is "try again shortly"; a batch too large for one answer says
 * to translate in parts; a field over the length cap says so. Anything else is the generic failure rather
 * than a raw code.
 */
export const getAITranslationErrorCodeMessage = (code: string | undefined, t: TTranslate): string => {
  const aiUnavailableMessage = getAIUnavailableMessageForErrorCode(code, t);
  if (aiUnavailableMessage) return aiUnavailableMessage;

  if (code === "ai_quota_exceeded") return t("workspace.surveys.edit.ai_translation_quota_exceeded");
  if (code === "ai_output_too_long") return t("workspace.surveys.edit.ai_translation_output_too_long");
  if (code === AI_TRANSLATION_FIELD_TOO_LONG)
    return t("workspace.surveys.edit.ai_translation_field_too_long");

  return t("workspace.surveys.edit.ai_translation_failed");
};

/**
 * The sentence a failed AI translation request shows. Any 429 — the provider's quota or the route's own
 * request budget — is "try again shortly"; otherwise the problem's code picks it. A dropped connection or
 * anything that is not a problem response is the generic failure.
 */
export const getAITranslationErrorMessage = (error: unknown, t: TTranslate): string => {
  if (!(error instanceof V3ApiError)) return t("workspace.surveys.edit.ai_translation_failed");
  if (error.status === 429) return t("workspace.surveys.edit.ai_translation_quota_exceeded");
  return getAITranslationErrorCodeMessage(error.code, t);
};
