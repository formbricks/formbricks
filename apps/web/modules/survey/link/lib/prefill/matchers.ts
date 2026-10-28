import { TSurveyElementChoice } from "@formbricks/types/surveys/elements";

/**
 * Match a value against element choices, in this order:
 * 1. the option ID
 * 2. the label in the current language
 * 3. the answer code (`choice.code`, ADR 0016)
 *
 * The first rule that finds an option wins, so an existing ID or label link never changes meaning:
 * a label that looks like another option's code is the label. The code is an exact, case-sensitive
 * match; a choice without a code (or an empty one) is never matched this way.
 *
 * @param choices - Array of choice objects with id, label and optional code
 * @param value - Value from URL parameter (a choice ID, label text or answer code)
 * @param languageCode - Current language code for label matching
 * @returns Matched choice or null if no match found
 */
export const matchOption = (
  choices: TSurveyElementChoice[],
  value: string,
  languageCode: string
): TSurveyElementChoice | null => {
  const matchById = choices.find((choice) => choice.id === value);
  if (matchById) return matchById;

  const matchByLabel = choices.find((choice) => choice.label[languageCode] === value);
  if (matchByLabel) return matchByLabel;

  if (value === "") return null;
  return choices.find((choice) => choice.code === value) ?? null;
};

/**
 * Match multiple values against choices with the same order as `matchOption`
 * Used for multi-select elements
 *
 * @param choices - Array of choice objects
 * @param values - Array of values from URL parameter
 * @param languageCode - Current language code
 * @returns Array of matched choices (preserves order)
 */
export const matchOptions = (
  choices: TSurveyElementChoice[],
  values: string[],
  languageCode: string
): TSurveyElementChoice[] =>
  values.map((value) => matchOption(choices, value, languageCode)).filter((match) => match !== null);
