import { TResponseData } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { FORBIDDEN_IDS } from "@formbricks/types/surveys/validation";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { transformElement } from "./transformers";
import { validateElement } from "./validators";

/**
 * Extract prefilled values from URL search parameters
 *
 * Supports prefilling for all survey element types with the following features:
 * - Option ID or label matching for choice-based elements (single/multi-select, ranking, picture selection)
 * - Comma-separated values for multi-select and ranking
 * - Backward compatibility with label-based prefilling
 *
 * @param survey - The survey object containing blocks and elements
 * @param searchParams - URL search parameters (e.g., from useSearchParams() or new URLSearchParams())
 * @param languageId - Current language code for label matching
 * @returns Object with element IDs as keys and prefilled values, or undefined if no valid prefills
 *
 * @example
 * // Single select with option ID
 * ?questionId=option-abc123
 *
 * // Multi-select with labels (backward compatible)
 * ?questionId=Option1,Option2,Option3
 *
 * // Ranking with option IDs
 * ?rankingId=choice-3,choice-1,choice-2
 *
 * // NPS question
 * ?npsId=9
 *
 * // Multiple questions
 * ?q1=answer1&q2=10&q3=option-xyz
 */
export const getPrefillValue = (
  survey: TSurvey,
  searchParams: URLSearchParams,
  languageId: string
): TResponseData | undefined => {
  const prefillData: TResponseData = {};
  const elements = getElementsFromBlocks(survey.blocks);

  searchParams.forEach((value, key) => {
    try {
      // Skip reserved parameter names
      if (FORBIDDEN_IDS.includes(key)) {
        return;
      }

      // Find matching element
      const element = elements.find((el) => el.id === key);
      if (!element) {
        return;
      }

      // Validate the value for this element type (returns match data)
      const validationResult = validateElement(element, value, languageId);
      if (!validationResult.isValid) {
        return;
      }

      // Transform the value using pre-matched data from validation
      const transformedValue = transformElement(validationResult, value, languageId);
      prefillData[element.id] = transformedValue;
    } catch (error) {
      // Catch any errors to prevent one bad prefill from breaking all prefills
      console.error(`[Prefill] Error processing prefill for ${key}:`, error);
    }
  });
  return Object.keys(prefillData).length > 0 ? prefillData : undefined;
};
