import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { formatDateWithOrdinal, isValidDateString } from "@formbricks/lib/utils/datetime";
import { extractFallbackValue, extractId, extractRecallInfo } from "@formbricks/lib/utils/recall";
import { TResponseData } from "@formbricks/types/responses";
import { TSurveyQuestion, TSurveyVariables } from "@formbricks/types/surveys/types";

export const replaceRecallInfo = (
  text: string,
  responseData: TResponseData,
  variables: TSurveyVariables
): string => {
  let modifiedText = text;

  while (modifiedText.includes("recall:")) {
    const recallInfo = extractRecallInfo(modifiedText);
    if (!recallInfo) break; // Exit the loop if no recall info is found

    const recallItemId = extractId(recallInfo);
    if (!recallItemId) return modifiedText; // Return the text if no ID could be extracted

    const fallback = extractFallbackValue(recallInfo).replaceAll("nbsp", " ");
    let value: string | null = null;

    // Fetching value from variables based on recallItemId
    if (variables.length) {
      const variable = variables.find((variable) => variable.id === recallItemId);
      value = variable?.value?.toString() ?? fallback;
    }

    // Fetching value from responseData or attributes based on recallItemId
    if (responseData[recallItemId]) {
      value = (responseData[recallItemId] as string) ?? fallback;
    }

    // Additional value formatting if it exists
    if (value) {
      if (isValidDateString(value)) {
        value = formatDateWithOrdinal(new Date(value));
      } else if (Array.isArray(value)) {
        value = value.filter((item) => item).join(", "); // Filters out empty values and joins with a comma
      }
    }

    // Replace the recallInfo in the text with the obtained or fallback value
    modifiedText = modifiedText.replace(recallInfo, value || fallback);
  }

  return modifiedText;
};

export const parseRecallInformation = (
  question: TSurveyQuestion,
  languageCode: string,
  responseData: TResponseData,
  variables: TSurveyVariables
) => {
  const modifiedQuestion = structuredClone(question);
  if (question.headline && question.headline[languageCode]?.includes("recall:")) {
    modifiedQuestion.headline[languageCode] = replaceRecallInfo(
      getLocalizedValue(modifiedQuestion.headline, languageCode),
      responseData,
      variables
    );
  }
  if (
    question.subheader &&
    question.subheader[languageCode]?.includes("recall:") &&
    modifiedQuestion.subheader
  ) {
    modifiedQuestion.subheader[languageCode] = replaceRecallInfo(
      getLocalizedValue(modifiedQuestion.subheader, languageCode),
      responseData,
      variables
    );
  }
  return modifiedQuestion;
};
