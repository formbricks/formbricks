import { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Pre-populate question initial values from contact attributes
 *
 * @param survey - The survey with attributeMapping configuration
 * @param contactAttributes - Map of contact attribute key names to values
 * @returns Map of question/element IDs to initial values
 */
export const prePopulateFromContactAttributes = (
  survey: TSurvey,
  contactAttributes: Record<string, string>
): Record<string, string> => {
  const initialValues: Record<string, string> = {};

  if (!survey.attributeMapping || Object.keys(survey.attributeMapping).length === 0) {
    return initialValues;
  }

  // Map each question/element to its contact attribute value
  for (const [questionId, attributeKeyName] of Object.entries(survey.attributeMapping)) {
    const attributeValue = contactAttributes[attributeKeyName];
    if (attributeValue !== undefined && attributeValue !== null) {
      initialValues[questionId] = attributeValue;
    }
  }

  return initialValues;
};

/**
 * Get initial value for a specific question/element
 *
 * @param questionId - The question or element ID
 * @param initialValues - Pre-computed initial values map
 * @returns The initial value or undefined
 */
export const getInitialValue = (
  questionId: string,
  initialValues: Record<string, string>
): string | undefined => {
  return initialValues[questionId];
};
