// Wire contract: these string values travel from the server (via
// InvalidInputError.message) to the client untouched. Renaming a code is a
// breaking change — keep the constant and its value in sync on both ends.
export const AI_CHART_PROMPT_ERROR_CODE = "AI_CHART_PROMPT_COULD_NOT_BE_CONVERTED";

// Must stay in sync with AI_ERROR_CODES.QUOTA_EXCEEDED in @/lib/ai/service —
// that module is server-only, so the value is duplicated for the client bundle.
export const AI_QUOTA_EXCEEDED_ERROR_CODE = "ai_quota_exceeded";

type Translate = (key: string) => string;

export const getTranslatedAIChartError = (errorCode: string, t: Translate): string => {
  if (errorCode === AI_CHART_PROMPT_ERROR_CODE) {
    return t("workspace.analysis.charts.ai_prompt_could_not_be_converted");
  }

  if (errorCode === AI_QUOTA_EXCEEDED_ERROR_CODE) {
    return t("workspace.analysis.charts.ai_quota_exceeded");
  }

  return errorCode;
};
