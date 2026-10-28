import { getAIUnavailableMessageForErrorCode } from "@/lib/ai/availability";
import { V3ApiError } from "@/modules/api/lib/v3-client";

type TTranslate = (key: string) => string;

/**
 * The sentence a failed AI translation shows. AI turned off, out of plan or unconfigured reads the same as
 * every other AI gate; any 429 — the provider's quota or the route's own request budget — is "try again
 * shortly"; a batch too large for one answer says to translate in parts. Anything else, including a
 * dropped connection, is the generic failure rather than a raw code.
 */
export const getAITranslationErrorMessage = (error: unknown, t: TTranslate): string => {
  if (!(error instanceof V3ApiError)) return t("workspace.surveys.edit.ai_translation_failed");

  const aiUnavailableMessage = getAIUnavailableMessageForErrorCode(error.code, t);
  if (aiUnavailableMessage) return aiUnavailableMessage;

  if (error.status === 429) return t("workspace.surveys.edit.ai_translation_quota_exceeded");
  if (error.code === "ai_output_too_long") return t("workspace.surveys.edit.ai_translation_output_too_long");

  return t("workspace.surveys.edit.ai_translation_failed");
};
