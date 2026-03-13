import type { TSurveyDateStorageFormat } from "@formbricks/surveys/date-format";
import { parseDateByFormat } from "@formbricks/surveys/date-format";
import { formatDateWithOrdinal } from "./datetime";

/**
 * Parses a stored date string with the given format and returns a display string.
 * If parsing fails, returns the provided fallback (e.g. raw value or "Invalid date(value)").
 */
export function formatStoredDateForDisplay(
  value: string,
  format: TSurveyDateStorageFormat,
  fallback: string
): string {
  const parsed = parseDateByFormat(value, format);
  if (parsed === null) return fallback;
  return formatDateWithOrdinal(parsed);
}
