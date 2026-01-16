import { z } from "zod";
import { TResponseData, TResponseDataValue } from "@formbricks/types/responses";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

// Supported expansion keys
export const ZResponseExpand = z.enum(["choiceIds", "questionHeadlines"]);

export type TResponseExpand = z.infer<typeof ZResponseExpand>;

// Schema for the expand query parameter (comma-separated list)
export const ZExpandParam = z
  .string()
  .optional()
  .transform((val) => {
    if (!val) return [];
    return val.split(",").map((s) => s.trim());
  })
  .pipe(z.array(ZResponseExpand));

export type TExpandParam = z.infer<typeof ZExpandParam>;

// Expanded response data structure for a single answer
export type TExpandedValue = {
  value: TResponseDataValue;
  choiceIds?: string[];
};

// Expanded response data structure
export type TExpandedResponseData = {
  [questionId: string]: TExpandedValue;
};

// Additional expansions that are added as separate fields
export type TResponseExpansions = {
  questionHeadlines?: Record<string, string>;
};

// Choice element types that support choiceIds expansion
const CHOICE_ELEMENT_TYPES = ["multipleChoiceMulti", "multipleChoiceSingle", "ranking", "pictureSelection"];

/**
 * Check if an element type supports choice ID expansion
 */
export const isChoiceElement = (element: TSurveyElement): boolean => {
  return CHOICE_ELEMENT_TYPES.includes(element.type);
};

/**
 * Type guard to check if element has choices property
 */
const hasChoices = (
  element: TSurveyElement
): element is TSurveyElement & { choices: Array<{ id: string; label: Record<string, string> }> } => {
  return "choices" in element && Array.isArray(element.choices);
};

/**
 * Type guard to check if element has headline property
 */
const hasHeadline = (
  element: TSurveyElement
): element is TSurveyElement & { headline: Record<string, string> } => {
  return "headline" in element && typeof element.headline === "object";
};

/**
 * Extracts choice IDs from a response value for choice-based questions
 * @param responseValue - The response value (string for single choice, array for multi choice)
 * @param element - The survey element containing choices
 * @param language - The language to match against (defaults to "default")
 * @returns Array of choice IDs
 */
export const extractChoiceIdsFromResponse = (
  responseValue: TResponseDataValue,
  element: TSurveyElement,
  language: string = "default"
): string[] => {
  if (!isChoiceElement(element) || !responseValue) {
    return [];
  }

  // Picture selection already stores IDs directly
  if (element.type === "pictureSelection") {
    if (Array.isArray(responseValue)) {
      return responseValue.filter((id): id is string => typeof id === "string");
    }
    return typeof responseValue === "string" ? [responseValue] : [];
  }

  // For other choice types, we need to map labels to IDs
  if (!hasChoices(element)) {
    return [];
  }

  const findChoiceByLabel = (label: string): string => {
    const choice = element.choices.find((c) => {
      // Try exact language match first
      if (c.label[language] === label) {
        return true;
      }
      // Fall back to checking all language values
      return Object.values(c.label).includes(label);
    });
    return choice?.id ?? "other";
  };

  if (Array.isArray(responseValue)) {
    return responseValue.filter((v): v is string => typeof v === "string" && v !== "").map(findChoiceByLabel);
  }

  if (typeof responseValue === "string") {
    return [findChoiceByLabel(responseValue)];
  }

  return [];
};

/**
 * Expand response data with choice IDs
 * @param data - The response data object
 * @param survey - The survey definition
 * @param language - The language code for label matching
 * @returns Expanded response data with choice IDs
 */
export const expandWithChoiceIds = (
  data: TResponseData,
  survey: TSurvey,
  language: string = "default"
): TExpandedResponseData => {
  const elements = getElementsFromBlocks(survey.blocks);
  const expandedData: TExpandedResponseData = {};

  for (const [questionId, value] of Object.entries(data)) {
    const element = elements.find((e) => e.id === questionId);

    if (element && isChoiceElement(element)) {
      const choiceIds = extractChoiceIdsFromResponse(value, element, language);
      expandedData[questionId] = {
        value,
        ...(choiceIds.length > 0 && { choiceIds }),
      };
    } else {
      expandedData[questionId] = { value };
    }
  }

  return expandedData;
};

/**
 * Generate question headlines map
 * @param data - The response data object
 * @param survey - The survey definition
 * @param language - The language code for localization
 * @returns Record mapping question IDs to their headlines
 */
export const getQuestionHeadlines = (
  data: TResponseData,
  survey: TSurvey,
  language: string = "default"
): Record<string, string> => {
  const elements = getElementsFromBlocks(survey.blocks);
  const headlines: Record<string, string> = {};

  for (const questionId of Object.keys(data)) {
    const element = elements.find((e) => e.id === questionId);
    if (element && hasHeadline(element)) {
      headlines[questionId] = getLocalizedValue(element.headline, language);
    }
  }

  return headlines;
};
