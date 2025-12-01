import type { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import type { TResponseData } from "@formbricks/types/responses";
import {
  TSurveyElement,
  TSurveyElementChoice,
  TSurveyElementTypeEnum,
  TSurveyPictureChoice,
} from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";

/**
 * Parse URL query parameters and return prefill data for the survey
 * Supports option IDs and labels for choice-based questions
 * Multi-value fields use comma-separated syntax
 */
export function parsePrefillFromURL(
  survey: TJsEnvironmentStateSurvey,
  languageCode: string
): TResponseData | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const prefillData: TResponseData = {};

  // Get all elements from all blocks
  const allElements: TSurveyElement[] = [];
  survey.blocks.forEach((block) => {
    allElements.push(...block.elements);
  });

  // For each element, check if URL has a matching parameter
  allElements.forEach((element) => {
    const urlValue = searchParams.get(element.id);

    if (urlValue !== null && urlValue !== "") {
      // Resolve the value based on element type
      const resolvedValue = resolveChoiceValue(element, urlValue, languageCode);

      if (resolvedValue !== undefined) {
        prefillData[element.id] = resolvedValue;
      }
    }
  });

  // Return undefined if no prefill data found
  return Object.keys(prefillData).length > 0 ? prefillData : undefined;
}

/**
 * Resolve a URL parameter value to the correct format for an element
 * For choice-based questions, tries to match option ID first, then label
 * Handles comma-separated values for multi-value fields
 */
function resolveChoiceValue(
  element: TSurveyElement,
  value: string,
  languageCode: string
): string | string[] | undefined {
  // Handle choice-based questions
  if (
    element.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
    element.type === TSurveyElementTypeEnum.MultipleChoiceMulti ||
    element.type === TSurveyElementTypeEnum.Ranking ||
    element.type === TSurveyElementTypeEnum.PictureSelection
  ) {
    // Check if this is a multi-value field
    const isMultiValue =
      element.type === TSurveyElementTypeEnum.MultipleChoiceMulti ||
      element.type === TSurveyElementTypeEnum.Ranking;

    if (isMultiValue) {
      // Split by comma and resolve each value
      const values = value.split(",").map((v) => v.trim());
      const resolvedValues: string[] = [];

      for (const v of values) {
        const resolved = matchChoice(element.choices, v, languageCode);
        if (resolved !== undefined) {
          resolvedValues.push(resolved);
        }
      }

      return resolvedValues.length > 0 ? resolvedValues : undefined;
    } else {
      // Single choice - return as string
      return matchChoice(element.choices, value, languageCode);
    }
  }

  // For non-choice elements, return value as-is
  // (text, number, date, etc.)
  return value || undefined;
}

/**
 * Match a value against choices (either by ID or label)
 * First tries exact ID match, then tries label match for backward compatibility
 */
function matchChoice(
  choices: (TSurveyElementChoice | TSurveyPictureChoice)[],
  value: string,
  languageCode: string
): string | undefined {
  // 1. Try exact ID match
  const byId = choices.find((choice) => choice.id === value);
  if (byId) {
    // For regular choices, return the localized label
    if ("label" in byId) {
      return getLocalizedValue(byId.label, languageCode);
    }
    // For picture choices, return the ID (they don't have labels)
    return byId.id;
  }

  // 2. Try label match (backward compatibility) - only for regular choices
  const byLabel = choices.find(
    (choice) => "label" in choice && getLocalizedValue(choice.label, languageCode) === value
  );
  if (byLabel) {
    return value;
  }

  // No match found
  return undefined;
}
