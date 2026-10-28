import { TResponseData } from "@formbricks/types/responses";
import { findElementByIdOrCode } from "@formbricks/types/surveys/element-lookup";
import { TSurvey } from "@formbricks/types/surveys/types";
import { FORBIDDEN_IDS, LINK_SURVEY_SYSTEM_PARAM_KEYS } from "@formbricks/types/surveys/validation";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { transformElement } from "./transformers";
import { validateElement } from "./validators";

/**
 * Extract prefilled values from URL search parameters
 *
 * Supports prefilling for all survey element types with the following features:
 * - Single and multi-select values are an option ID, the option label or the answer code, looked up in
 *   that order (see `matchOption`), so ID and label links keep their meaning
 * - Comma-separated values for multi-select
 * - Picture selection takes 1-based image indices
 *
 * @param survey - The survey object containing blocks and elements
 * @param searchParams - URL search parameters (e.g., from useSearchParams() or new URLSearchParams())
 * @param languageId - Current language code for label matching
 * Each parameter name is a Question ID or, failing that, a question code (`?age=34`).
 *
 * @returns Object with element IDs as keys and prefilled values, or undefined if no valid prefills
 *
 * @example
 * // Single select with option ID
 * ?questionId=option-abc123
 *
 * // Single select with the answer code of an option, on a question coded `hello`
 * ?hello=2
 *
 * // Multi-select with labels
 * ?questionId=Option1,Option2,Option3
 *
 * // Multi-select with answer codes
 * ?questionId=1,2
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
  // Elements filled through their Question ID param: a question-code param for the same question must
  // not overwrite them, whatever the order of the query string.
  const filledById = new Set<string>();

  searchParams.forEach((value, key) => {
    try {
      // Skip reserved parameter names
      if (FORBIDDEN_IDS.includes(key)) {
        return;
      }

      // Find matching element
      // The name is a Question ID first, then a question code (ADR 0016). A code never captures a
      // link system param such as `?lang=`.
      const isId = elements.some((el) => el.id === key);
      if (!isId && LINK_SURVEY_SYSTEM_PARAM_KEYS.has(key)) {
        return;
      }
      const element = findElementByIdOrCode(elements, key);
      if (!element) {
        return;
      }
      if (!isId && filledById.has(element.id)) {
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
      if (isId) {
        filledById.add(element.id);
      }
    } catch (error) {
      // Catch any errors to prevent one bad prefill from breaking all prefills
      console.error(`[Prefill] Error processing prefill for ${key}:`, error);
    }
  });
  return Object.keys(prefillData).length > 0 ? prefillData : undefined;
};
