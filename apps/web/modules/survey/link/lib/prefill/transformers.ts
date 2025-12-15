import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { parseNumber } from "./parsers";
import {
  TValidationResult,
  isMultiChoiceResult,
  isPictureSelectionResult,
  isSingleChoiceResult,
} from "./types";

export const transformOpenText = (answer: string): string => {
  return answer;
};

export const transformMultipleChoiceSingle = (
  validationResult: TValidationResult,
  answer: string,
  language: string
): string => {
  if (!isSingleChoiceResult(validationResult)) return answer;

  const { matchedChoice } = validationResult;

  // If we have a matched choice, return its label
  if (matchedChoice) {
    return matchedChoice.label[language] || answer;
  }

  // If no matched choice (null), it's an "other" value - return original
  return answer;
};

export const transformMultipleChoiceMulti = (validationResult: TValidationResult): string[] => {
  if (!isMultiChoiceResult(validationResult)) return [];

  const { matched, others } = validationResult;

  // Return matched choices + joined "other" values as single string
  if (others.length > 0) {
    return [...matched, others.join(",")];
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

export const transformConsent = (answer: string): string => {
  if (answer === "dismissed") return "";
  return answer;
};

export const transformPictureSelection = (validationResult: TValidationResult): string[] => {
  if (!isPictureSelectionResult(validationResult)) return [];

  return validationResult.selectedIds;
};

/**
 * Main transformation dispatcher
 * Routes to appropriate transformer based on element type
 * Uses pre-matched data from validation result to avoid duplicate matching
 */
export const transformElement = (
  validationResult: TValidationResult,
  answer: string,
  language: string
): string | number | string[] => {
  if (!validationResult.isValid) return "";

  try {
    switch (validationResult.type) {
      case TSurveyElementTypeEnum.OpenText:
        return transformOpenText(answer);
      case TSurveyElementTypeEnum.MultipleChoiceSingle:
        return transformMultipleChoiceSingle(validationResult, answer, language);
      case TSurveyElementTypeEnum.Consent:
        return transformConsent(answer);
      case TSurveyElementTypeEnum.Rating:
        return transformRating(answer);
      case TSurveyElementTypeEnum.NPS:
        return transformNPS(answer);
      case TSurveyElementTypeEnum.PictureSelection:
        return transformPictureSelection(validationResult);
      case TSurveyElementTypeEnum.MultipleChoiceMulti:
        return transformMultipleChoiceMulti(validationResult);
      default:
        return "";
    }
  } catch {
    return "";
  }
};
