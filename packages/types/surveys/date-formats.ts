/**
 * Single source of truth for survey date storage formats.
 * Values are stored in response data as hyphen-separated strings: year, month, day
 * in the order defined by each format (e.g. y-M-d = YYYY-MM-DD).
 *
 * To add a new format: add the id to the tuple, add parse order and output order
 * entries, then implement parsing/formatting in packages that consume this (surveys, survey-ui).
 */

/** Supported date storage format ids. Extend this tuple to add new formats. */
export const DATE_STORAGE_FORMAT_IDS = ["M-d-y", "d-M-y", "y-M-d"] as const;

export type TSurveyDateStorageFormat = (typeof DATE_STORAGE_FORMAT_IDS)[number];

/** Default format (ISO-style). Used when element has no format set. */
export const DEFAULT_DATE_STORAGE_FORMAT: TSurveyDateStorageFormat = "y-M-d";

/**
 * For each format, indices into the split("-") array for [year, month, day].
 * parts[yearIdx]=year, parts[monthIdx]=month, parts[dayIdx]=day.
 */
export const DATE_FORMAT_PARSE_ORDER: Record<
  TSurveyDateStorageFormat,
  { yearIdx: number; monthIdx: number; dayIdx: number }
> = {
  "y-M-d": { yearIdx: 0, monthIdx: 1, dayIdx: 2 },
  "d-M-y": { yearIdx: 2, monthIdx: 1, dayIdx: 0 },
  "M-d-y": { yearIdx: 2, monthIdx: 0, dayIdx: 1 },
};

/**
 * For each format, indices into [year, month, day] for output order.
 * Output = [year, month, day][out[0]] + "-" + [year, month, day][out[1]] + "-" + [year, month, day][out[2]]
 */
export const DATE_FORMAT_OUTPUT_ORDER: Record<TSurveyDateStorageFormat, [number, number, number]> = {
  "y-M-d": [0, 1, 2],
  "d-M-y": [2, 1, 0],
  "M-d-y": [1, 2, 0],
};

/** All format ids as an array (for iteration, e.g. try-parse or dropdowns). */
export const DATE_STORAGE_FORMATS_LIST: TSurveyDateStorageFormat[] = [...DATE_STORAGE_FORMAT_IDS];

/** Default display labels for UI (e.g. editor dropdown). Apps can override with i18n. */
export const DATE_STORAGE_FORMAT_LABELS: Record<TSurveyDateStorageFormat, string> = {
  "M-d-y": "MM-DD-YYYY",
  "d-M-y": "DD-MM-YYYY",
  "y-M-d": "YYYY-MM-DD",
};
