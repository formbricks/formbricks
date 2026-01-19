import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

/**
 * Parses a date string in DD-MM-YYYY or MM-DD-YYYY format.
 * Uses heuristics to disambiguate between formats.
 */
const parseDateFromParts = (part1: number, part2: number, part3: number): Date | null => {
  // Heuristic: If first part > 12, it's likely DD-MM-YYYY
  if (part1 > 12) {
    return new Date(part3, part2 - 1, part1);
  }

  // If second part > 12, it's definitely MM-DD-YYYY
  if (part2 > 12) {
    return new Date(part3, part1 - 1, part2);
  }

  // Ambiguous - use additional heuristics
  if (part1 > 31 || part3 < 100) {
    // Likely YYYY-MM-DD format
    return new Date(part1, part2 - 1, part3);
  }

  // Default to American format MM-DD-YYYY
  return new Date(part3, part1 - 1, part2);
};

/**
 * Attempts to parse a string as a date in various formats.
 */
const tryParseDate = (stringValue: string): Date | null => {
  // Try ISO format first (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(stringValue)) {
    return new Date(stringValue);
  }

  // For DD-MM-YYYY or MM-DD-YYYY formats, parse manually
  const parts = stringValue.split(/[-/]/);
  if (parts.length < 3) {
    return null;
  }

  const [part1, part2, part3] = parts.map((p) => Number.parseInt(p, 10));
  return parseDateFromParts(part1, part2, part3);
};

/**
 * Detects the data type of an attribute value based on its format.
 * Used for first-time attribute creation to infer the dataType.
 *
 * Supported date formats:
 * - ISO 8601: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ
 * - European: DD-MM-YYYY or DD/MM/YYYY
 * - American: MM-DD-YYYY or MM/DD/YYYY
 *
 * @param value - The attribute value to detect the type of (string, number, or Date)
 * @returns The detected data type (string, number, or date)
 */
export const detectAttributeDataType = (value: string | number | Date): TContactAttributeDataType => {
  // Handle Date objects directly
  if (value instanceof Date) {
    return "date";
  }

  // Handle numbers directly
  if (typeof value === "number") {
    return "number";
  }

  // For string values, try to detect the actual type
  const stringValue = value.trim();

  // Check if it matches common date formats
  const datePattern = /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/;
  if (datePattern.test(stringValue)) {
    const parsedDate = tryParseDate(stringValue);

    // Verify it's a valid date
    if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
      return "date";
    }
  }

  // Check if numeric (integer or decimal)
  if (stringValue !== "" && !Number.isNaN(Number(stringValue))) {
    return "number";
  }

  // Default to string for everything else
  return "string";
};
