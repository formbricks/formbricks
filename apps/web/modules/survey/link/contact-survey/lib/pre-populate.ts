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
