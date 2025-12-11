import {
  TSurveyElement,
  TSurveyElementTypeEnum,
  TSurveyRankingElement,
} from "@formbricks/types/surveys/elements";
import { matchMultipleOptionsByIdOrLabel, matchOptionByIdOrLabel } from "./matchers";
import { parseCommaSeparated, parseNumber } from "./parsers";

export const transformOpenText = (answer: string): string => {
  return answer;
};

export const transformMultipleChoiceSingle = (
  element: TSurveyElement,
  answer: string,
  language: string
): string => {
  if (element.type !== TSurveyElementTypeEnum.MultipleChoiceSingle) return answer;
  if (!element.choices || !Array.isArray(element.choices)) return answer;

  // Try to match by ID or label
  const matchedChoice = matchOptionByIdOrLabel(element.choices, answer, language);
  if (matchedChoice) {
    // Return the label text (element expects labels, not IDs)
    return matchedChoice.label[language] || answer;
  }

  // If no match, return the original (could be "other" text)
  return answer;
};

export const transformMultipleChoiceMulti = (
  element: TSurveyElement,
  answer: string,
  language: string
): string[] => {
  if (element.type !== TSurveyElementTypeEnum.MultipleChoiceMulti) return [];
  if (!element.choices || !Array.isArray(element.choices)) return [];

  const answerChoices = parseCommaSeparated(answer);
  const hasOthers = element.choices.length > 0 && element.choices[element.choices.length - 1]?.id === "other";

  // Separate matched choices from "other" values
  const matched: string[] = [];
  const others: string[] = [];

  for (const ans of answerChoices) {
    // Check if it matches by label or ID
    const matchedChoice = matchOptionByIdOrLabel(element.choices, ans, language);
    if (matchedChoice) {
      // Return the label text (element expects labels, not IDs)
      const label = matchedChoice.label[language];
      if (label) {
        matched.push(label);
      }
    } else if (hasOthers) {
      // It's a free-text "other" value
      others.push(ans);
    }
  }

  // Return matched choices + joined "other" values as single string
  if (others.length > 0) {
    matched.push(others.join(","));
  }

  return matched;
};

export const transformNPS = (answer: string): number => {
  const num = parseNumber(answer);
  return num ?? 0;
};

export const transformRating = (answer: string): number => {
  const num = parseNumber(answer);
  return num ?? 0;
};

export const transformCTA = (answer: string): string => {
  if (answer === "dismissed") return "";
  return answer;
};

export const transformConsent = (answer: string): string => {
  if (answer === "dismissed") return "";
  return answer;
};

export const transformPictureSelection = (element: TSurveyElement, answer: string): string[] => {
  if (element.type !== TSurveyElementTypeEnum.PictureSelection) return [];
  if (!element.choices || !Array.isArray(element.choices)) return [];

  const answerChoicesIdx = parseCommaSeparated(answer);
  const answerArr: string[] = [];

  answerChoicesIdx.forEach((ansIdx) => {
    const index = Number(ansIdx) - 1;
    if (index >= 0 && index < element.choices.length) {
      const choice = element.choices[index];
      if (choice && choice.id) {
        answerArr.push(choice.id);
      }
    }
  });

  if (element.allowMulti) return answerArr;
  return answerArr.slice(0, 1);
};

export const transformRanking = (
  element: TSurveyRankingElement,
  answer: string,
  language: string
): string[] => {
  if (element.type !== TSurveyElementTypeEnum.Ranking) return [];
  if (!element.choices || !Array.isArray(element.choices)) return [];

  const values = parseCommaSeparated(answer);

  // Match all values by ID or label
  const matchedChoices = matchMultipleOptionsByIdOrLabel(element.choices, values, language);

  // Return the labels in the order they were provided
  return matchedChoices
    .map((choice) => {
      const label = choice.label?.[language];
      return label || "";
    })
    .filter((label) => label !== "");
};

/**
 * Main transformation dispatcher
 * Routes to appropriate transformer based on element type
 */
export const transformElement = (
  element: TSurveyElement,
  answer: string,
  language: string
): string | number | string[] => {
  switch (element.type) {
    case TSurveyElementTypeEnum.OpenText:
      return transformOpenText(answer);
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
      return transformMultipleChoiceSingle(element, answer, language);
    case TSurveyElementTypeEnum.Consent:
      return transformConsent(answer);
    case TSurveyElementTypeEnum.CTA:
      return transformCTA(answer);
    case TSurveyElementTypeEnum.Rating:
      return transformRating(answer);
    case TSurveyElementTypeEnum.NPS:
      return transformNPS(answer);
    case TSurveyElementTypeEnum.PictureSelection:
      return transformPictureSelection(element, answer);
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
      return transformMultipleChoiceMulti(element, answer, language);
    case TSurveyElementTypeEnum.Ranking:
      return transformRanking(element as TSurveyRankingElement, answer, language);
    default:
      return "";
  }
};
