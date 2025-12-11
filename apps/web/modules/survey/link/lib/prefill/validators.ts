import {
  TSurveyCTAElement,
  TSurveyConsentElement,
  TSurveyElement,
  TSurveyElementTypeEnum,
  TSurveyMultipleChoiceElement,
  TSurveyRankingElement,
  TSurveyRatingElement,
} from "@formbricks/types/surveys/elements";
import { matchMultipleOptionsByIdOrLabel, matchOptionByIdOrLabel } from "./matchers";
import { parseCommaSeparated, parseNumber } from "./parsers";

export const validateOpenText = (): boolean => {
  return true;
};

export const validateMultipleChoiceSingle = (
  element: TSurveyMultipleChoiceElement,
  answer: string,
  language: string
): boolean => {
  if (element.type !== TSurveyElementTypeEnum.MultipleChoiceSingle) return false;
  if (!element.choices || !Array.isArray(element.choices)) return false;

  const choices = element.choices;
  const hasOther = choices.length > 0 && choices[choices.length - 1]?.id === "other";

  // Try matching by ID or label (new: supports both)
  const matchedChoice = matchOptionByIdOrLabel(choices, answer, language);
  if (matchedChoice) {
    return true;
  }

  // If no match and has "other" option, accept any non-empty text as "other" value
  if (hasOther) {
    const trimmedAnswer = answer.trim();
    return trimmedAnswer !== "";
  }

  return false;
};

export const validateMultipleChoiceMulti = (
  element: TSurveyElement,
  answer: string,
  language: string
): boolean => {
  if (element.type !== TSurveyElementTypeEnum.MultipleChoiceMulti) return false;

  const elementWithChoices = element as TSurveyElement & {
    choices: Array<{ id: string; label: Record<string, string> }>;
  };

  if (!elementWithChoices.choices || !Array.isArray(elementWithChoices.choices)) return false;

  const choices = elementWithChoices.choices;
  const hasOther = choices.length > 0 && choices[choices.length - 1]?.id === "other";
  const lastChoiceLabel = hasOther && choices[choices.length - 1]?.label?.[language];

  const answerChoices = parseCommaSeparated(answer);

  if (answerChoices.length === 0) {
    return false;
  }

  if (!hasOther) {
    // All answers must match a choice (by ID or label)
    return answerChoices.every((ans: string) => matchOptionByIdOrLabel(choices, ans, language) !== null);
  }

  // With "other" option, count how many values don't match any choice
  let freeTextOtherCount = 0;
  for (const ans of answerChoices) {
    const matchesChoice = matchOptionByIdOrLabel(choices, ans, language) !== null;

    if (matchesChoice) {
      continue;
    }

    // Check if it's the "Other" label itself
    if (ans === lastChoiceLabel) {
      continue;
    }

    // It's a free-text "other" value
    freeTextOtherCount++;
    if (freeTextOtherCount > 1) {
      return false; // Only one free-text "other" value allowed
    }
  }

  return true;
};

export const validateNPS = (answer: string): boolean => {
  const answerNumber = parseNumber(answer);
  return answerNumber !== null && answerNumber >= 0 && answerNumber <= 10;
};

export const validateCTA = (element: TSurveyCTAElement, answer: string): boolean => {
  if (element.required && answer === "dismissed") return false;
  return answer === "clicked" || answer === "dismissed";
};

export const validateConsent = (element: TSurveyConsentElement, answer: string): boolean => {
  if (element.required && answer === "dismissed") return false;
  return answer === "accepted" || answer === "dismissed";
};

export const validateRating = (element: TSurveyRatingElement, answer: string): boolean => {
  if (element.type !== TSurveyElementTypeEnum.Rating) return false;
  const answerNumber = parseNumber(answer);
  return answerNumber !== null && answerNumber >= 1 && answerNumber <= (element.range ?? 5);
};

export const validatePictureSelection = (element: TSurveyElement, answer: string): boolean => {
  if (element.type !== TSurveyElementTypeEnum.PictureSelection) return false;
  if (!element.choices || !Array.isArray(element.choices)) return false;

  const answerChoices = parseCommaSeparated(answer);

  // All values must be valid numbers (1-based indices) and within range
  return answerChoices.every((ans: string) => {
    const num = Number(ans);
    return !isNaN(num) && num >= 1 && num <= element.choices.length;
  });
};

export const validateRanking = (
  element: TSurveyRankingElement,
  answer: string,
  language: string
): boolean => {
  if (element.type !== TSurveyElementTypeEnum.Ranking) return false;
  if (!element.choices || !Array.isArray(element.choices)) return false;

  const values = parseCommaSeparated(answer);

  if (values.length === 0) {
    return false;
  }

  // Try to match all values by ID or label
  const matchedChoices = matchMultipleOptionsByIdOrLabel(element.choices, values, language);

  // If required, must match all choices
  if (element.required) {
    return matchedChoices.length === element.choices.length;
  }

  // If not required, at least some values must match (and no duplicates)
  const uniqueMatches = new Set(matchedChoices.map((c) => c.id));
  return matchedChoices.length > 0 && uniqueMatches.size === matchedChoices.length;
};

/**
 * Main validation dispatcher
 * Routes to appropriate validator based on element type
 */
export const validateElement = (element: TSurveyElement, answer: string, language: string): boolean => {
  // Empty required fields are invalid
  if (element.required && (!answer || answer === "")) return false;

  const validators: Partial<
    Record<TSurveyElementTypeEnum, (q: TSurveyElement, a: string, l: string) => boolean>
  > = {
    [TSurveyElementTypeEnum.OpenText]: () => validateOpenText(),
    [TSurveyElementTypeEnum.MultipleChoiceSingle]: (q, a, l) =>
      validateMultipleChoiceSingle(q as TSurveyMultipleChoiceElement, a, l),
    [TSurveyElementTypeEnum.MultipleChoiceMulti]: (q, a, l) => validateMultipleChoiceMulti(q, a, l),
    [TSurveyElementTypeEnum.NPS]: (_, a) => validateNPS(a),
    [TSurveyElementTypeEnum.CTA]: (q, a) => validateCTA(q as TSurveyCTAElement, a),
    [TSurveyElementTypeEnum.Consent]: (q, a) => validateConsent(q as TSurveyConsentElement, a),
    [TSurveyElementTypeEnum.Rating]: (q, a) => validateRating(q as TSurveyRatingElement, a),
    [TSurveyElementTypeEnum.PictureSelection]: (q, a) => validatePictureSelection(q, a),
    [TSurveyElementTypeEnum.Ranking]: (q, a, l) => validateRanking(q as TSurveyRankingElement, a, l),
  };

  const validator = validators[element.type];
  if (!validator) return false;

  try {
    return validator(element, answer, language);
  } catch {
    return false;
  }
};
