import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import { TI18nString, TSurvey, TSurveyQuestion, TSurveyRecallItem } from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "../i18n/utils";
import { structuredClone } from "../pollyfills/structuredClone";
import { formatDateWithOrdinal, isValidDateString } from "./datetime";

export interface fallbacks {
  [id: string]: string;
}

// Extracts the ID of recall question from a string containing the "recall" pattern.
export const extractId = (text: string): string | null => {
  const pattern = /#recall:([A-Za-z0-9_-]+)/;
  const match = text.match(pattern);
  if (match && match[1]) {
    return match[1];
  } else {
    return null;
  }
};

// If there are multiple recall infos in a string extracts all recall question IDs from that string and construct an array out of it.
export const extractIds = (text: string): string[] => {
  const pattern = /#recall:([A-Za-z0-9_-]+)/g;
  const matches = Array.from(text.matchAll(pattern));
  return matches.map((match) => match[1]).filter((id) => id !== null);
};

// Extracts the fallback value from a string containing the "fallback" pattern.
export const extractFallbackValue = (text: string): string => {
  const pattern = /fallback:(\S*)#/;
  const match = text.match(pattern);
  if (match && match[1]) {
    return match[1];
  } else {
    return "";
  }
};

// Extracts the complete recall information (ID and fallback) from a headline string.
export const extractRecallInfo = (headline: string, id?: string): string | null => {
  const idPattern = id ? id : "[A-Za-z0-9_-]+";
  const pattern = new RegExp(`#recall:(${idPattern})\\/fallback:(\\S*)#`);
  const match = headline.match(pattern);
  return match ? match[0] : null;
};

// Finds the recall information by a specific recall question ID within a text.
export const findRecallInfoById = (text: string, id: string): string | null => {
  const pattern = new RegExp(`#recall:${id}\\/fallback:(\\S*)#`, "g");
  const match = text.match(pattern);
  return match ? match[0] : null;
};

const getRecallItemLabel = <T extends TSurvey>(
  recallItemId: string,
  survey: T,
  languageCode: string
): string | undefined => {
  const isHiddenField = survey.hiddenFields.fieldIds?.includes(recallItemId);
  if (isHiddenField) return recallItemId;

  const surveyQuestion = survey.questions.find((question) => question.id === recallItemId);
  if (surveyQuestion) return surveyQuestion.headline[languageCode];

  const variable = survey.variables?.find((variable) => variable.id === recallItemId);
  if (variable) return variable.name;
};

// Converts recall information in a headline to a corresponding recall question headline, with or without a slash.
export const recallToHeadline = <T extends TSurvey>(
  headline: TI18nString,
  survey: T,
  withSlash: boolean,
  languageCode: string
): TI18nString => {
  let newHeadline = structuredClone(headline);
  const localizedHeadline = newHeadline[languageCode];

  if (!localizedHeadline?.includes("#recall:")) return headline;

  const replaceNestedRecalls = (text: string): string => {
    while (text.includes("#recall:")) {
      const recallInfo = extractRecallInfo(text);
      if (!recallInfo) break;

      const recallItemId = extractId(recallInfo);
      if (!recallItemId) break;

      let recallItemLabel = getRecallItemLabel(recallItemId, survey, languageCode) || recallItemId;

      while (recallItemLabel.includes("#recall:")) {
        const nestedRecallInfo = extractRecallInfo(recallItemLabel);
        if (nestedRecallInfo) {
          recallItemLabel = recallItemLabel.replace(nestedRecallInfo, "___");
        }
      }

      const replacement = withSlash ? `/${recallItemLabel}\\` : `@${recallItemLabel}`;
      text = text.replace(recallInfo, replacement);
    }
    return text;
  };

  newHeadline[languageCode] = replaceNestedRecalls(localizedHeadline);
  return newHeadline;
};

// Replaces recall information in a survey question's headline with an ___.
export const replaceRecallInfoWithUnderline = (label: string): string => {
  let newLabel = label;
  while (newLabel.includes("#recall:")) {
    const recallInfo = extractRecallInfo(newLabel);
    if (recallInfo) {
      newLabel = newLabel.replace(recallInfo, "___");
    }
  }
  return newLabel;
};

// Checks for survey questions with a "recall" pattern but no fallback value.
export const checkForEmptyFallBackValue = (survey: TSurvey, language: string): TSurveyQuestion | null => {
  const findRecalls = (text: string) => {
    const recalls = text.match(/#recall:[^ ]+/g);
    return recalls && recalls.some((recall) => !extractFallbackValue(recall));
  };
  for (const question of survey.questions) {
    if (
      findRecalls(getLocalizedValue(question.headline, language)) ||
      (question.subheader && findRecalls(getLocalizedValue(question.subheader, language)))
    ) {
      return question;
    }
  }
  return null;
};

// Processes each question in a survey to ensure headlines are formatted correctly for recall and return the modified survey.
export const replaceHeadlineRecall = <T extends TSurvey>(survey: T, language: string): T => {
  const modifiedSurvey = structuredClone(survey);
  modifiedSurvey.questions.forEach((question) => {
    question.headline = recallToHeadline(question.headline, modifiedSurvey, false, language);
  });
  return modifiedSurvey;
};

// Retrieves an array of survey questions referenced in a text containing recall information.
export const getRecallItems = (text: string, survey: TSurvey, languageCode: string): TSurveyRecallItem[] => {
  if (!text.includes("#recall:")) return [];

  const ids = extractIds(text);
  let recallItems: TSurveyRecallItem[] = [];
  ids.forEach((recallItemId) => {
    const isHiddenField = survey.hiddenFields.fieldIds?.includes(recallItemId);
    const isSurveyQuestion = survey.questions.find((question) => question.id === recallItemId);
    const isVariable = survey.variables.find((variable) => variable.id === recallItemId);

    const recallItemLabel = getRecallItemLabel(recallItemId, survey, languageCode);

    const getRecallItemType = () => {
      if (isHiddenField) return "hiddenField";
      if (isSurveyQuestion) return "question";
      if (isVariable) return "variable";
    };

    if (recallItemLabel) {
      let recallItemLabelTemp = recallItemLabel;
      recallItemLabelTemp = replaceRecallInfoWithUnderline(recallItemLabelTemp);
      const recallItemType = getRecallItemType();
      if (recallItemType) {
        recallItems.push({
          id: recallItemId,
          label: recallItemLabelTemp,
          type: recallItemType,
        });
      }
    }
  });
  return recallItems;
};

// Constructs a fallbacks object from a text containing multiple recall and fallback patterns.
export const getFallbackValues = (text: string): fallbacks => {
  if (!text.includes("#recall:")) return {};
  const pattern = /#recall:([A-Za-z0-9_-]+)\/fallback:([\S*]+)#/g;
  let match;
  const fallbacks: fallbacks = {};

  while ((match = pattern.exec(text)) !== null) {
    const id = match[1];
    const fallbackValue = match[2];
    fallbacks[id] = fallbackValue;
  }
  return fallbacks;
};

// Transforms headlines in a text to their corresponding recall information.
export const headlineToRecall = (
  text: string,
  recallItems: TSurveyRecallItem[],
  fallbacks: fallbacks
): string => {
  recallItems.forEach((recallItem) => {
    const recallInfo = `#recall:${recallItem.id}/fallback:${fallbacks[recallItem.id]}#`;
    text = text.replace(`@${recallItem.label}`, recallInfo);
  });
  return text;
};

export const parseRecallInfo = (
  text: string,
  responseData?: TResponseData,
  variables?: TResponseVariables,
  withSlash: boolean = false
) => {
  let modifiedText = text;
  const questionIds = responseData ? Object.keys(responseData) : [];
  const variableIds = variables ? Object.keys(variables) : [];

  // Process all recall patterns regardless of whether we have matching data
  while (modifiedText.includes("#recall:")) {
    const recallInfo = extractRecallInfo(modifiedText);
    if (!recallInfo) break; // Exit the loop if no recall info is found

    const recallItemId = extractId(recallInfo);
    if (!recallItemId) {
      // If no ID could be extracted, just remove the recall tag
      modifiedText = modifiedText.replace(recallInfo, "");
      continue;
    }

    const fallback = extractFallbackValue(recallInfo).replaceAll("nbsp", " ");
    let value;

    // First check if it matches a variable
    if (variables && variableIds.includes(recallItemId)) {
      value = variables[recallItemId];
    }
    // Then check if it matches response data
    else if (responseData && questionIds.includes(recallItemId)) {
      value = responseData[recallItemId];

      // Apply formatting for special value types
      if (value) {
        if (isValidDateString(value as string)) {
          value = formatDateWithOrdinal(new Date(value as string));
        } else if (Array.isArray(value)) {
          value = value.filter((item) => item).join(", ");
        }
      }
    }

    // If no value was found, use the fallback
    if (value === undefined || value === null || value === "") {
      value = fallback;
    }

    // Replace the recall tag with the value
    if (withSlash) {
      modifiedText = modifiedText.replace(recallInfo, "#/" + value + "\\#");
    } else {
      modifiedText = modifiedText.replace(recallInfo, value as string);
    }
  }

  return modifiedText;
};
