import { getAIUnavailableMessageForErrorCode } from "@/lib/ai/availability";
import { V3ApiError } from "@/modules/api/lib/v3-client";

/**
 * Raised by the chart generator when the model cannot turn a prompt into a chart. Server-side only: the
 * route answers it as 422 `ai_generated_payload_invalid` on `prompt`, which is what the dialog reads.
 */
export const AI_CHART_PROMPT_ERROR_CODE = "AI_CHART_PROMPT_COULD_NOT_BE_CONVERTED";

type Translate = (key: string) => string;

/** The sentence the AI chart dialog shows for a failed generation. */
export const getAIChartErrorMessage = (error: unknown, t: Translate): string => {
  if (!(error instanceof V3ApiError)) return t("common.something_went_wrong_please_try_again");

  // The gates every AI feature shares read the same sentence everywhere.
  const unavailable = getAIUnavailableMessageForErrorCode(error.code, t);
  if (unavailable) return unavailable;

  if (error.code === "ai_generated_payload_invalid") {
    return t("workspace.analysis.charts.ai_prompt_could_not_be_converted");
  }
  // The provider's quota and the one-generation-a-minute limit both mean "try again shortly".
  if (error.status === 429) return t("workspace.analysis.charts.ai_quota_exceeded");

  return error.detail || t("common.something_went_wrong_please_try_again");
};
