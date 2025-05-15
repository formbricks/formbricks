import { formatDateWithOrdinal, isValidDateString } from "@/lib/date-time";
import { getLocalizedValue } from "@/lib/i18n";
import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TSurveyQuestion } from "@formbricks/types/surveys/types";

// Extracts the ID of recall question from a string containing the "recall" pattern.
const extractId = (text: string): string | null => {
  const pattern = /#recall:([A-Za-z0-9_-]+)/;
  const match = text.match(pattern);
  return match?.[1] ?? null;
};

// Extracts the fallback value from a string containing the "fallback" pattern.
const extractFallbackValue = (text: string): string => {
  const pattern = /fallback:(\S*)#/;
  const match = text.match(pattern);
  return match?.[1] ?? "";
};

// Extracts the complete recall information (ID and fallback) from a headline string.
const extractRecallInfo = (headline: string, id?: string): string | null => {
  const idPattern = id ?? "[A-Za-z0-9_-]+";
  const pattern = new RegExp(`#recall:(${idPattern})\\/fallback:(\\S*)#`);
  const match = headline.match(pattern);
  return match ? match[0] : null;
};

export const replaceRecallInfo = (
  text: string,
  responseData: TResponseData,
  variables: TResponseVariables
): string => {
  let modifiedText = text;

  while (modifiedText.includes("recall:")) {
    const recallInfo = extractRecallInfo(modifiedText);
    if (!recallInfo) break; // Exit the loop if no recall info is found

    const recallItemId = extractId(recallInfo);
    if (!recallItemId) return modifiedText; // Return the text if no ID could be extracted

    const fallback = extractFallbackValue(recallInfo).replace(/nbsp/g, " ").trim();
    let value: string | null = null;

    // Fetching value from variables based on recallItemId
    if (variables[recallItemId] !== undefined) {
      value = String(variables[recallItemId]) ?? fallback;
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
  variables: TResponseVariables
) => {
  const modifiedQuestion = JSON.parse(JSON.stringify(question));
  if (question.headline[languageCode].includes("recall:")) {
    modifiedQuestion.headline[languageCode] = replaceRecallInfo(
      getLocalizedValue(modifiedQuestion.headline, languageCode),
      responseData,
      variables
    );
  }
  if (
    question.subheader &&
    question.subheader[languageCode].includes("recall:") &&
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
