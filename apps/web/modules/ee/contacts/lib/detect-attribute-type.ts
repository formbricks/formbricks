import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

/**
 * Detects the data type of an attribute value from SDK input.
 * This is STRICT and does NOT parse string contents:
 * - JS number → number type
 * - JS Date object → date type (should be converted to ISO string by SDK)
 * - ISO 8601 string → date type
 * - Any other string → string type (even if it looks like a number!)
 *
 * @param value - The attribute value from SDK (string or number, Date is converted to ISO by SDK)
 * @returns The detected data type
 */
export const detectSDKAttributeDataType = (value: string | number): TContactAttributeDataType => {
  // JS number → number type
  if (typeof value === "number") {
    return "number";
  }

  // String value - only check for ISO date format, NOT numeric strings
  const stringValue = value.trim();

  // Check for ISO 8601 date format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
  // This is what Date.toISOString() produces
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(stringValue)) {
    const parsedDate = new Date(stringValue);
    if (!Number.isNaN(parsedDate.getTime())) {
      return "date";
    }
  }

  // Everything else is a string
  return "string";
};

/**
 * Parses a date string in DD-MM-YYYY or MM-DD-YYYY format.
 * Uses heuristics to disambiguate between formats.
 */
export const parseDateFromParts = (part1: number, part2: number, part3: number): Date | null => {
  // Heuristic: If first part > 12, it's likely DD-MM-YYYY
  if (part1 > 12) {
    return new Date(part3, part2 - 1, part1);
  }

  // If second part > 12, it's definitely MM-DD-YYYY
  if (part2 > 12) {
    return new Date(part3, part1 - 1, part2);
  }

  // Check for YYYY-MM-DD format
  if (part1 > 999) {
    return new Date(part1, part2 - 1, part3);
  }

  // Default to MM-DD-YYYY
  return new Date(part3, part1 - 1, part2);
};

export const tryParseDate = (stringValue: string): Date | null => {
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
 * - YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ
 * - DD-MM-YYYY or DD/MM/YYYY
 * - MM-DD-YYYY or MM/DD/YYYY
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
