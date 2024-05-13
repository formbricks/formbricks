import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { formatDateWithOrdinal, isValidDateString } from "@formbricks/lib/utils/datetime";
import { extractFallbackValue, extractId, extractRecallInfo } from "@formbricks/lib/utils/recall";
import { TResponseData } from "@formbricks/types/responses";
import { TSurveyQuestion } from "@formbricks/types/surveys";

export const replaceRecallInfo = (text: string, responseData: TResponseData): string => {
  while (text.includes("recall:")) {
    const recallInfo = extractRecallInfo(text);
    if (recallInfo) {
      const questionId = extractId(recallInfo);
      const fallback = extractFallbackValue(recallInfo).replaceAll("nbsp", " ");
      let value = questionId && responseData[questionId] ? (responseData[questionId] as string) : fallback;

      if (isValidDateString(value)) {
        value = formatDateWithOrdinal(new Date(value));
      }
      if (Array.isArray(value)) {
        value = value.filter((item) => item !== null && item !== undefined && item !== "").join(", ");
      }
      text = text.replace(recallInfo, value);
    }
  }
  return text;
};

export const parseRecallInformation = (
  question: TSurveyQuestion,
  languageCode: string,
  responseData: TResponseData
) => {
  const modifiedQuestion = structuredClone(question);
  if (question.headline && question.headline[languageCode]?.includes("recall:")) {
    modifiedQuestion.headline[languageCode] = replaceRecallInfo(
      getLocalizedValue(modifiedQuestion.headline, languageCode),
      responseData
    );
  }
  if (
    question.subheader &&
    question.subheader[languageCode]?.includes("recall:") &&
    modifiedQuestion.subheader
  ) {
    modifiedQuestion.subheader[languageCode] = replaceRecallInfo(
      getLocalizedValue(modifiedQuestion.subheader, languageCode),
      responseData
    );
  }
  return modifiedQuestion;
};
