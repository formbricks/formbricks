/**
 * Date storage format for survey date elements.
 * Values are stored in response data in this order: y = year, M = month, d = day.
 */
export type TSurveyDateStorageFormat = "M-d-y" | "d-M-y" | "y-M-d";

const ISO_FIRST_CHARS = /^\d{4}/;

/**
 * Parse a date string stored in response data using the element's storage format.
 * Pure function, synchronous, no I/O.
 *
 * Backward compatibility: if the value starts with 4 digits (YYYY), it is treated
 * as ISO (y-M-d) regardless of format, so legacy YYYY-MM-DD values parse correctly.
 *
 * @param value - The stored date string (e.g. "2024-03-13", "13-03-2024", "03-13-2024")
 * @param format - The format used when the value was stored; defaults to "y-M-d" (ISO)
 * @returns Parsed Date in local time, or null if invalid
 */
export function parseDateByFormat(value: string, format: TSurveyDateStorageFormat = "y-M-d"): Date | null {
  const trimmed = value?.trim();
  if (!trimmed || typeof trimmed !== "string") {
    return null;
  }

  const parts = trimmed.split("-");
  if (parts.length !== 3) {
    return null;
  }

  // Backward compat: value starts with 4 digits (year) => treat as ISO
  const useIso = ISO_FIRST_CHARS.test(trimmed);
  const effectiveFormat = useIso ? "y-M-d" : format;

  let year: number;
  let month: number;
  let day: number;

  switch (effectiveFormat) {
    case "y-M-d": {
      const [y, m, d] = parts.map((p) => parseInt(p, 10));
      if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
      year = y;
      month = m;
      day = d;
      break;
    }
    case "d-M-y": {
      const [d, m, y] = parts.map((p) => parseInt(p, 10));
      if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
      year = y;
      month = m;
      day = d;
      break;
    }
    case "M-d-y": {
      const [m, d, y] = parts.map((p) => parseInt(p, 10));
      if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
      year = y;
      month = m;
      day = d;
      break;
    }
    default:
      return null;
  }

  // Month 1-12, day 1-31; Date constructor uses 0-indexed month
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}
