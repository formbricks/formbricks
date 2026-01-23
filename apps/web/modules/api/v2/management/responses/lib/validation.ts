import "server-only";
import { validateBlockResponses } from "@formbricks/surveys/validation";
import { TResponseData } from "@formbricks/types/responses";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import { TValidationErrorMap } from "@formbricks/types/surveys/validation-rules";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { ApiErrorDetails } from "@/modules/api/v2/types/api-error";

/**
 * Validates response data against survey validation rules
 *
 * @param blocks - Survey blocks containing elements with validation rules (preferred)
 * @param questions - Survey questions (legacy format, used as fallback if blocks are empty)
 * @param responseData - Response data to validate (keyed by element ID)
 * @param languageCode - Language code for error messages (defaults to "en")
 * @returns Validation error map keyed by element ID, or null if validation passes
 */
export const validateResponseData = (
  blocks: TSurveyBlock[] | undefined | null,
  responseData: TResponseData,
  languageCode: string = "en",
  questions?: TSurveyQuestion[] | undefined | null
): TValidationErrorMap | null => {
  // Use blocks if available, otherwise transform questions to blocks
  let blocksToUse: TSurveyBlock[] = [];

  if (blocks && blocks.length > 0) {
    blocksToUse = blocks;
  } else if (questions && questions.length > 0) {
    // Transform legacy questions format to blocks for validation
    blocksToUse = transformQuestionsToBlocks(questions, []);
  } else {
    // No blocks or questions to validate against
    return null;
  }

  // Extract elements from blocks
  const elements = getElementsFromBlocks(blocksToUse);

  // Validate all elements
  const errorMap = validateBlockResponses(elements, responseData, languageCode);

  // Return null if no errors (validation passed), otherwise return error map
  return Object.keys(errorMap).length === 0 ? null : errorMap;
};

/**
 * Converts validation error map to API error response format (V2)
 *
 * @param errorMap - Validation error map from validateResponseData
 * @returns API error response details
 */
export const formatValidationErrorsForApi = (errorMap: TValidationErrorMap) => {
  const details: ApiErrorDetails = [];

  for (const [elementId, errors] of Object.entries(errorMap)) {
    // Include all error messages for each element
    for (const error of errors) {
      details.push({
        field: `response.data.${elementId}`,
        issue: error.message,
        meta: {
          elementId,
          ruleId: error.ruleId,
          ruleType: error.ruleType,
        },
      });
    }
  }

  return details;
};
