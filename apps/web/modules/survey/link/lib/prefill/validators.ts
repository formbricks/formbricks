import {
  TSurveyConsentElement,
  TSurveyElement,
  TSurveyElementTypeEnum,
  TSurveyMultipleChoiceElement,
  TSurveyPictureSelectionElement,
  TSurveyRatingElement,
} from "@formbricks/types/surveys/elements";
import { matchOptionByIdOrLabel } from "./matchers";
import { parseCommaSeparated, parseNumber } from "./parsers";
import { TValidationResult } from "./types";

const invalid = (type?: TSurveyElementTypeEnum): TValidationResult => ({ isValid: false, type });

export const validateOpenText = (): TValidationResult => {
  return { isValid: true, type: TSurveyElementTypeEnum.OpenText };
};

export const validateMultipleChoiceSingle = (
  element: TSurveyMultipleChoiceElement,
  answer: string,
  language: string
): TValidationResult => {
  if (element.type !== TSurveyElementTypeEnum.MultipleChoiceSingle) {
    return invalid(TSurveyElementTypeEnum.MultipleChoiceSingle);
  }
  if (!element.choices || !Array.isArray(element.choices) || element.choices.length === 0) {
    return invalid(TSurveyElementTypeEnum.MultipleChoiceSingle);
  }

  const hasOther = element.choices.at(-1)?.id === "other";

  // Try matching by ID or label (new: supports both)
  const matchedChoice = matchOptionByIdOrLabel(element.choices, answer, language);
  if (matchedChoice) {
    return {
      isValid: true,
      type: TSurveyElementTypeEnum.MultipleChoiceSingle,
      matchedChoice,
    };
  }

  // If no match and has "other" option, accept any non-empty text as "other" value
  if (hasOther) {
    const trimmedAnswer = answer.trim();
    if (trimmedAnswer !== "") {
      return {
        isValid: true,
        type: TSurveyElementTypeEnum.MultipleChoiceSingle,
        matchedChoice: null, // null indicates "other" value
      };
    }
  }

  return invalid(TSurveyElementTypeEnum.MultipleChoiceSingle);
};

export const validateMultipleChoiceMulti = (
  element: TSurveyMultipleChoiceElement,
  answer: string,
  language: string
): TValidationResult => {
  if (element.type !== TSurveyElementTypeEnum.MultipleChoiceMulti) {
    return invalid(TSurveyElementTypeEnum.MultipleChoiceMulti);
  }

  if (!element.choices || !Array.isArray(element.choices) || element.choices.length === 0) {
    return invalid(TSurveyElementTypeEnum.MultipleChoiceMulti);
  }

  const hasOther = element.choices.at(-1)?.id === "other";
  const lastChoiceLabel = hasOther ? element.choices.at(-1)?.label?.[language] : undefined;

  const answerChoices = parseCommaSeparated(answer);

  if (answerChoices.length === 0) {
    return invalid(TSurveyElementTypeEnum.MultipleChoiceMulti);
  }

  // Process all answers and collect results
  const matched: string[] = [];
  const others: string[] = [];
  let freeTextOtherCount = 0;

  for (const ans of answerChoices) {
    const matchedChoice = matchOptionByIdOrLabel(element.choices, ans, language);

    if (matchedChoice) {
      const label = matchedChoice.label[language];
      if (label) {
        matched.push(label);
      }
      continue;
    }

    // Check if it's the "Other" label itself
    if (ans === lastChoiceLabel) {
      continue;
    }

    // It's a free-text "other" value
    if (hasOther) {
      freeTextOtherCount++;
      if (freeTextOtherCount > 1) {
        return invalid(TSurveyElementTypeEnum.MultipleChoiceMulti); // Only one free-text "other" value allowed
      }
      others.push(ans);
    } else {
      // No "other" option and doesn't match any choice
      return invalid(TSurveyElementTypeEnum.MultipleChoiceMulti);
    }
  }

  return {
    isValid: true,
    type: TSurveyElementTypeEnum.MultipleChoiceMulti,
    matched,
    others,
  };
};

export const validateNPS = (answer: string): TValidationResult => {
  const answerNumber = parseNumber(answer);
  if (answerNumber === null || answerNumber < 0 || answerNumber > 10) {
    return invalid(TSurveyElementTypeEnum.NPS);
  }
  return { isValid: true, type: TSurveyElementTypeEnum.NPS };
};

export const validateConsent = (element: TSurveyConsentElement, answer: string): TValidationResult => {
  if (element.type !== TSurveyElementTypeEnum.Consent) {
    return invalid(TSurveyElementTypeEnum.Consent);
  }
  if (element.required && answer === "dismissed") {
    return invalid(TSurveyElementTypeEnum.Consent);
  }
  if (answer !== "accepted" && answer !== "dismissed") {
    return invalid(TSurveyElementTypeEnum.Consent);
  }
  return { isValid: true, type: TSurveyElementTypeEnum.Consent };
};

export const validateRating = (element: TSurveyRatingElement, answer: string): TValidationResult => {
  if (element.type !== TSurveyElementTypeEnum.Rating) {
    return invalid(TSurveyElementTypeEnum.Rating);
  }
  const answerNumber = parseNumber(answer);
  if (answerNumber === null || answerNumber < 1 || answerNumber > (element.range ?? 5)) {
    return invalid(TSurveyElementTypeEnum.Rating);
  }
  return { isValid: true, type: TSurveyElementTypeEnum.Rating };
};

export const validatePictureSelection = (
  element: TSurveyPictureSelectionElement,
  answer: string
): TValidationResult => {
  if (element.type !== TSurveyElementTypeEnum.PictureSelection) {
    return invalid(TSurveyElementTypeEnum.PictureSelection);
  }
  if (!element.choices || !Array.isArray(element.choices) || element.choices.length === 0) {
    return invalid(TSurveyElementTypeEnum.PictureSelection);
  }

  const answerChoices = parseCommaSeparated(answer);
  const selectedIds: string[] = [];

  // Validate all indices and collect selected IDs
  for (const ans of answerChoices) {
    const num = parseNumber(ans);
    if (num === null || num < 1 || num > element.choices.length) {
      return invalid(TSurveyElementTypeEnum.PictureSelection);
    }
    const index = num - 1;
    const choice = element.choices[index];
    if (choice?.id) {
      selectedIds.push(choice.id);
    }
  }

  // Apply allowMulti constraint
  const finalIds = element.allowMulti ? selectedIds : selectedIds.slice(0, 1);

  return {
    isValid: true,
    type: TSurveyElementTypeEnum.PictureSelection,
    selectedIds: finalIds,
  };
};

/**
 * Main validation dispatcher
 * Routes to appropriate validator based on element type
 * Returns validation result with match data for transformers
 */
export const validateElement = (
  element: TSurveyElement,
  answer: string,
  language: string
): TValidationResult => {
  // Empty required fields are invalid
  if (element.required && (!answer || answer === "")) {
    return invalid(element.type);
  }

  try {
    switch (element.type) {
      case TSurveyElementTypeEnum.OpenText:
        return validateOpenText();
      case TSurveyElementTypeEnum.MultipleChoiceSingle:
        return validateMultipleChoiceSingle(element, answer, language);
      case TSurveyElementTypeEnum.MultipleChoiceMulti:
        return validateMultipleChoiceMulti(element, answer, language);
      case TSurveyElementTypeEnum.NPS:
        return validateNPS(answer);
      case TSurveyElementTypeEnum.Consent:
        return validateConsent(element, answer);
      case TSurveyElementTypeEnum.Rating:
        return validateRating(element, answer);
      case TSurveyElementTypeEnum.PictureSelection:
        return validatePictureSelection(element, answer);
      default:
        return invalid();
    }
  } catch {
    return invalid(element.type);
  }
};
