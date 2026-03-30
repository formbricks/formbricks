import { TSurveyElementChoice } from "@formbricks/types/surveys/elements";

/**
 * Match a value against element choices by ID first, then by label
 * This enables both option ID-based and label-based prefilling
 *
 * @param choices - Array of choice objects with id and label
 * @param value - Value from URL parameter (either choice ID or label text)
 * @param languageCode - Current language code for label matching
 * @returns Matched choice or null if no match found
 */
export const matchOptionByIdOrLabel = (
  choices: TSurveyElementChoice[],
  value: string,
  languageCode: string
): TSurveyElementChoice | null => {
  const matchById = choices.find((choice) => choice.id === value);
  if (matchById) return matchById;

  const matchByLabel = choices.find((choice) => choice.label[languageCode] === value);
  if (matchByLabel) return matchByLabel;

  return null;
};

/**
 * Match multiple values against choices
 * Used for multi-select and ranking elements
 *
 * @param choices - Array of choice objects
 * @param values - Array of values from URL parameter
 * @param languageCode - Current language code
 * @returns Array of matched choices (preserves order)
 */
export const matchMultipleOptionsByIdOrLabel = (
  choices: TSurveyElementChoice[],
  values: string[],
  languageCode: string
): TSurveyElementChoice[] =>
  values
    .map((value) => matchOptionByIdOrLabel(choices, value, languageCode))
    .filter((match) => match !== null);
