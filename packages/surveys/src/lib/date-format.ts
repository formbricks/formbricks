import {
  DATE_FORMAT_PARSE_ORDER,
  DATE_STORAGE_FORMATS_LIST,
  DEFAULT_DATE_STORAGE_FORMAT,
} from "@formbricks/types/surveys/date-formats";

export type { TSurveyDateStorageFormat } from "@formbricks/types/surveys/date-formats";

const ISO_FIRST_CHARS = /^\d{4}/;

/**
 * Parse a date string stored in response data using the element's storage format.
 * Uses the format registry from @formbricks/types for data-driven parsing.
 *
 * Backward compatibility: if the value starts with 4 digits (YYYY), it is treated
 * as ISO (y-M-d) regardless of format, so legacy YYYY-MM-DD values parse correctly.
 *
 * @param value - The stored date string (e.g. "2024-03-13", "13-03-2024", "03-13-2024")
 * @param format - The format used when the value was stored; defaults to "y-M-d" (ISO)
 * @returns Parsed Date in local time, or null if invalid
 */
export function parseDateByFormat(
  value: string,
  format: TSurveyDateStorageFormat = DEFAULT_DATE_STORAGE_FORMAT
): Date | null {
  const trimmed = value?.trim();
  if (!trimmed || typeof trimmed !== "string") {
    return null;
  }

  const parts = trimmed.split("-");
  if (parts.length !== 3) {
    return null;
  }

  const useIso = ISO_FIRST_CHARS.test(trimmed);
  const effectiveFormat = useIso ? DEFAULT_DATE_STORAGE_FORMAT : format;

  const order = DATE_FORMAT_PARSE_ORDER[effectiveFormat];
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some(Number.isNaN)) return null;
  const year = nums[order.yearIdx];
  const month = nums[order.monthIdx];
  const day = nums[order.dayIdx];

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

/**
 * Try to parse a date string using each known storage format in order.
 * Use when the storage format is unknown (e.g. recall placeholders).
 *
 * @param value - Stored date string
 * @returns Parsed Date or null if no format matched
 */
export function parseDateWithFormats(value: string): Date | null {
  for (const format of DATE_STORAGE_FORMATS_LIST) {
    const parsed = parseDateByFormat(value, format);
    if (parsed !== null) return parsed;
  }
  return null;
}
