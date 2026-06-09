// Wire contract: these string values travel from the server (via
// InvalidInputError.message) to the client untouched. Renaming a code is a
// breaking change — keep the constant and its value in sync on both ends.
export const AI_CHART_PROMPT_ERROR_CODE = "AI_CHART_PROMPT_COULD_NOT_BE_CONVERTED";

type Translate = (key: string) => string;

export const getTranslatedAIChartError = (errorCode: string, t: Translate): string => {
  if (errorCode === AI_CHART_PROMPT_ERROR_CODE) {
    return t("workspace.analysis.charts.ai_prompt_could_not_be_converted");
  }

  return errorCode;
};
