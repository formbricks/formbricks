import "server-only";
import { TValidationErrorMap } from "@formbricks/types/surveys/validation-rules";

/**
 * Converts validation error map to API error response format as Record<string, string>
 * Used by both v1 and v2 client APIs for consistent error formatting
 *
 * @param errorMap - Validation error map from validateResponseData
 * @returns API error details as Record<string, string> where keys are field paths and values are combined error messages
 */
export const formatValidationErrors = (errorMap: TValidationErrorMap): Record<string, string> => {
  const details: Record<string, string> = {};

  for (const [elementId, errors] of Object.entries(errorMap)) {
    // Combine all error messages for each element
    const errorMessages = errors.map((error) => error.message).join("; ");
    details[`response.data.${elementId}`] = errorMessages;
  }

  return details;
};
