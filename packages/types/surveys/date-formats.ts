/**
 * Single source of truth for survey date storage formats.
 * Values are stored in response data as hyphen-separated strings: year, month, day
 * in the order defined by each format (e.g. y-M-d = YYYY-MM-DD).
 *
 * To add a new format: add the id to the tuple and one descriptor (parseOrder + label) to DATE_STORAGE_FORMATS.
 */

/** Supported date storage format ids. Extend this tuple to add new formats. */
export const DATE_STORAGE_FORMAT_IDS = ["M-d-y", "d-M-y", "y-M-d"] as const;

export type TSurveyDateStorageFormat = (typeof DATE_STORAGE_FORMAT_IDS)[number];

/** Default format (ISO-style). Used when element has no format set. */
export const DEFAULT_DATE_STORAGE_FORMAT: TSurveyDateStorageFormat = "y-M-d";

/** Indices into the split("-") array for [year, month, day]. parts[yearIdx]=year, etc. */
export interface DateParseOrder {
  yearIdx: number;
  monthIdx: number;
  dayIdx: number;
}

/** Descriptor for one date storage format. outputOrder is derived from parseOrder. */
export interface DateFormatDescriptor {
  parseOrder: DateParseOrder;
  /** Default display label (e.g. "YYYY-MM-DD"). Apps can override with i18n. */
  label: string;
}

/** Output order derived from parse order: which of [year, month, day] goes in each string position. */
export function getOutputOrder(parseOrder: DateParseOrder): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  out[parseOrder.yearIdx] = 0;
  out[parseOrder.monthIdx] = 1;
  out[parseOrder.dayIdx] = 2;
  return out;
}

/** One struct per format; single place to add or change a format. */
export const DATE_STORAGE_FORMATS: Record<TSurveyDateStorageFormat, DateFormatDescriptor> = {
  "y-M-d": {
    parseOrder: { yearIdx: 0, monthIdx: 1, dayIdx: 2 },
    label: "YYYY-MM-DD",
  },
  "d-M-y": {
    parseOrder: { yearIdx: 2, monthIdx: 1, dayIdx: 0 },
    label: "DD-MM-YYYY",
  },
  "M-d-y": {
    parseOrder: { yearIdx: 2, monthIdx: 0, dayIdx: 1 },
    label: "MM-DD-YYYY",
  },
};

/**
 * All format ids as an array (for iteration, e.g. dropdowns or try-parse).
 * When used for try-parse without format metadata, the first matching format wins;
 * order is M-d-y, d-M-y, y-M-d (see parseDateWithFormats in @formbricks/surveys).
 */
export const DATE_STORAGE_FORMATS_LIST: TSurveyDateStorageFormat[] = [...DATE_STORAGE_FORMAT_IDS];
