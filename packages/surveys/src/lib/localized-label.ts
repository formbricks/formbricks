import { type TI18nString } from "@formbricks/types/i18n";
import { getLocalizedValue } from "@/lib/i18n";

/**
 * Answers name single and multi select, ranking and matrix options by their label in the language
 * the respondent answered in, and a language switch mid-survey changes that language (ENG-6938:
 * copied options and option show-if work "in every language"). These read an answer back to its
 * option whatever language it was given in.
 */

/** Every label an item has, in every language of the survey (empty ones left out). */
export const getAllLocalizedLabels = (value: TI18nString | undefined): string[] =>
  Object.values(value ?? {}).filter(
    (label): label is string => typeof label === "string" && label.trim() !== ""
  );

/** The item an answer names by its label: the label in `languageId` wins, then one in any other language. */
export const findByLocalizedLabel = <TItem extends { label?: TI18nString }>(
  items: readonly TItem[],
  value: string,
  languageId: string
): TItem | undefined =>
  items.find((item) => getLocalizedValue(item.label, languageId) === value) ??
  items.find((item) => getAllLocalizedLabels(item.label).includes(value));
