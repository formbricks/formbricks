import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TAttributes } from "@formbricks/types/attributes";
import { TResponseData } from "@formbricks/types/responses";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestion,
  TSurveyQuestionsObject,
  TSurveyRecallItem,
} from "@formbricks/types/surveys";

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
export const extractRecallInfo = (headline: string): string | null => {
  const pattern = /#recall:([A-Za-z0-9_-]+)\/fallback:(\S*)#/;
  const match = headline.match(pattern);
  return match ? match[0] : null;
};

// Finds the recall information by a specific recall question ID within a text.
export const findRecallInfoById = (text: string, id: string): string | null => {
  const pattern = new RegExp(`#recall:${id}\\/fallback:(\\S*)#`, "g");
  const match = text.match(pattern);
  return match ? match[0] : null;
};

// Converts recall information in a headline to a corresponding recall question headline, with or without a slash.
export const recallToHeadline = <T extends TSurveyQuestionsObject>(
  headline: TI18nString,
  survey: T,
  withSlash: boolean,
  language: string,
  attributeClasses: TAttributeClass[]
): TI18nString => {
  let newHeadline = structuredClone(headline);
  if (!newHeadline[language]?.includes("#recall:")) return headline;

  while (newHeadline[language].includes("#recall:")) {
    const recallInfo = extractRecallInfo(getLocalizedValue(newHeadline, language));
    if (recallInfo) {
      const recallItemId = extractId(recallInfo);
      if (recallItemId) {
        const isHiddenField = survey.hiddenFields.fieldIds?.includes(recallItemId);
        const isSurveyQuestion = survey.questions.find((question) => question.id === recallItemId);
        const isAttributeClass = attributeClasses.find(
          (attributeClass) => attributeClass.name.replaceAll(" ", "nbsp") === recallItemId
        );
        const getRecallItemLabel = () => {
          if (isHiddenField)
            return recallItemId; // For hidden field recallItem Id and recallItem label are equal
          else if (isSurveyQuestion)
            return survey.questions.find((question) => question.id === recallItemId)?.headline[language];
          else if (isAttributeClass)
            return attributeClasses.find(
              (attributeClass) => attributeClass.name.replaceAll(" ", "nbsp") === recallItemId
            )?.name;
        };
        let recallItemLabel = getRecallItemLabel();
        while (recallItemLabel?.includes("#recall:")) {
          const recallInfo = extractRecallInfo(recallItemLabel);
          if (recallInfo) {
            recallItemLabel = recallItemLabel.replaceAll(recallInfo, "___");
          }
        }
        if (withSlash) {
          newHeadline[language] = newHeadline[language].replace(recallInfo, `/${recallItemLabel}\\`);
        } else {
          newHeadline[language] = newHeadline[language].replace(recallInfo, `@${recallItemLabel}`);
        }
      }
    }
  }
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
export const checkForEmptyFallBackValue = (survey: TSurvey, langauge: string): TSurveyQuestion | null => {
  const findRecalls = (text: string) => {
    const recalls = text.match(/#recall:[^ ]+/g);
    return recalls && recalls.some((recall) => !extractFallbackValue(recall));
  };
  for (const question of survey.questions) {
    if (
      findRecalls(getLocalizedValue(question.headline, langauge)) ||
      (question.subheader && findRecalls(getLocalizedValue(question.subheader, langauge)))
    ) {
      return question;
    }
  }
  return null;
};

// Processes each question in a survey to ensure headlines are formatted correctly for recall and return the modified survey.
export const checkForRecallInHeadline = <T extends TSurveyQuestionsObject>(
  survey: T,
  langauge: string,
  attributeClasses: TAttributeClass[]
): T => {
  const modifiedSurvey = structuredClone(survey);
  modifiedSurvey.questions.forEach((question) => {
    question.headline = recallToHeadline(
      question.headline,
      modifiedSurvey,
      false,
      langauge,
      attributeClasses
    );
  });
  return modifiedSurvey;
};

// Retrieves an array of survey questions referenced in a text containing recall information.
export const getRecallItems = (
  text: string,
  survey: TSurvey,
  langauge: string,
  attributeClasses: TAttributeClass[]
): TSurveyRecallItem[] => {
  if (!text.includes("#recall:")) return [];

  const ids = extractIds(text);
  let recallItems: TSurveyRecallItem[] = [];
  ids.forEach((recallItemId) => {
    const isHiddenField = survey.hiddenFields.fieldIds?.includes(recallItemId);
    const isSurveyQuestion = survey.questions.find((question) => question.id === recallItemId);
    const isAttributeClass = attributeClasses.find(
      (attributeClass) => attributeClass.name.replaceAll(" ", "nbsp") === recallItemId
    );
    const getRecallItemLabel = () => {
      if (isHiddenField)
        return recallItemId; // For hidden field recallItem Id and recallItem label are equal
      else if (isSurveyQuestion)
        return survey.questions.find((question) => question.id === recallItemId)?.headline[langauge];
      else if (isAttributeClass)
        return attributeClasses.find(
          (attributeClass) => attributeClass.name.replaceAll(" ", "nbsp") === recallItemId
        )?.name;
    };
    const recallItemLabel = getRecallItemLabel();
    if (recallItemLabel) {
      let recallItemLabelTemp = recallItemLabel;
      recallItemLabelTemp = replaceRecallInfoWithUnderline(recallItemLabelTemp);
      recallItems.push({
        id: recallItemId,
        label: recallItemLabelTemp,
        type: isHiddenField ? "hiddenField" : isSurveyQuestion ? "question" : "attributeClass",
      });
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
  attributes?: TAttributes,
  responseData?: TResponseData,
  withSlash: boolean = false
) => {
  let modifiedText = text;
  const attributeKeys = attributes ? Object.keys(attributes) : [];
  const questionIds = responseData ? Object.keys(responseData) : [];
  if (attributes && attributeKeys.length > 0) {
    attributeKeys.forEach((attributeKey) => {
      const recallPattern = `#recall:${attributeKey}`;
      while (modifiedText.includes(recallPattern)) {
        const recallInfo = extractRecallInfo(modifiedText);
        if (!recallInfo) break; // Exit the loop if no recall info is found

        const recallItemId = extractId(recallInfo);
        if (!recallItemId) continue; // Skip to the next iteration if no ID could be extracted

        const fallback = extractFallbackValue(recallInfo).replaceAll("nbsp", " ");
        let value = attributes[recallItemId.replace("nbsp", " ")] || fallback;
        if (withSlash) {
          modifiedText = modifiedText.replace(recallInfo, "#/" + value + "\\#");
        } else {
          modifiedText = modifiedText.replace(recallInfo, value);
        }
      }
    });
  }
  if (responseData && questionIds.length > 0) {
    while (modifiedText.includes("recall:")) {
      const recallInfo = extractRecallInfo(modifiedText);
      if (!recallInfo) break; // Exit the loop if no recall info is found

      const recallItemId = extractId(recallInfo);
      if (!recallItemId) return modifiedText; // Return the text if no ID could be extracted

      const fallback = extractFallbackValue(recallInfo).replaceAll("nbsp", " ");
      let value;

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

      if (withSlash) {
        modifiedText = modifiedText.replace(recallInfo, "#/" + (value ?? fallback) + "\\#");
      } else {
        modifiedText = modifiedText.replace(recallInfo, value ?? fallback);
      }
    }
  }

  return modifiedText;
};
