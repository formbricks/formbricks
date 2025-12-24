import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

/**
 * Detects the data type of an attribute value based on its format
 * @param value - The attribute value to detect the type of
 * @returns The detected data type (text, number, or date)
 */
export const detectAttributeDataType = (value: string): TContactAttributeDataType => {
  // Check if valid ISO 8601 date format
  // Must match YYYY-MM-DD at minimum (with optional time component)
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    // Verify it's a valid date and not "Invalid Date"
    if (!isNaN(date.getTime())) {
      return "date";
    }
  }

  // Check if numeric (integer or decimal)
  // Trim whitespace and check if it's a valid number
  const trimmedValue = value.trim();
  if (trimmedValue !== "" && !isNaN(Number(trimmedValue))) {
    return "number";
  }

  // Default to text for everything else
  return "text";
};
