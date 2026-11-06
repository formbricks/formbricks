import type { TI18nString } from "../i18n";

/**
 * Answers name single and multi select, ranking and matrix options by their label in the language
 * the respondent answered in, and a language switch mid-survey changes that language (ENG-6938:
 * copied options and option show-if work "in every language"). These read an answer back to its
 * option whatever language it was given in.
 *
 * Shared by the renderer (`packages/surveys`) and the server logic engine that quotas use
 * (`apps/web/lib/surveyLogic`, ENG-6943), so the two read a stored answer the same way.
 */

/** An item's label in `languageId`, or its `default` label when that one is missing or blank. */
export const getLabelInLanguage = (value: TI18nString | undefined, languageId: string): string => {
  const localized = value?.[languageId];
  if (typeof localized === "string" && localized.trim() !== "") return localized;
  return typeof value?.default === "string" ? value.default : "";
};

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
  items.find((item) => getLabelInLanguage(item.label, languageId) === value) ??
  items.find((item) => getAllLocalizedLabels(item.label).includes(value));

/**
 * The key a matrix answer stores a row under: the row's label in `languageId` first, then in any
 * other language (a language switch after the matrix was answered keeps its keys in the language it
 * was answered in). `undefined` when the answer has no entry for the row.
 */
export const findMatrixRowKey = (
  rowLabel: TI18nString | undefined,
  answer: Record<string, unknown>,
  languageId: string
): string | undefined =>
  [getLabelInLanguage(rowLabel, languageId), ...getAllLocalizedLabels(rowLabel)].find(
    (label) => label in answer
  );
