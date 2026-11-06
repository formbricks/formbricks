import type { TFilterOptionsPage, TFilterProperty } from "./types";

/** Longest value looked up by searching for it: what a value list's search takes. */
export const MAX_LABEL_SEARCH_LENGTH = 255;

/**
 * The picked values whose label must be looked up: on a property whose listed values carry labels
 * (`labelledValues`), each distinct one that its fixed options do not already name.
 */
export const valuesToLabel = (property: TFilterProperty, values: readonly string[]): string[] => {
  if (!property.labelledValues || !property.loadOptions) return [];
  return [...new Set(values)].filter(
    (value) => value !== "" && !property.options?.some((option) => option.value === value)
  );
};

/**
 * Of `values`, those the first page of the list does not hold, to be looked up by searching for each: a
 * search finds a value by its own text. One too long to search for keeps its stored text.
 */
export const valuesToSearch = (
  values: readonly string[],
  firstPage: TFilterOptionsPage | undefined
): string[] =>
  firstPage
    ? values.filter(
        (value) =>
          value.length <= MAX_LABEL_SEARCH_LENGTH &&
          !firstPage.options.some((option) => option.value === value)
      )
    : [];

/** The labels the loaded pages give `values`, by value. A value no page lists has none. */
export const collectValueLabels = (
  values: readonly string[],
  pages: readonly (TFilterOptionsPage | undefined)[]
): Record<string, string> => {
  const wanted = new Set(values);
  const labels: Record<string, string> = {};
  for (const page of pages) {
    for (const option of page?.options ?? []) {
      if (wanted.has(option.value)) labels[option.value] ??= option.label;
    }
  }
  return labels;
};
