/**
 * Simple parsing helpers for URL parameter values
 */

/**
 * Parse comma-separated values from URL parameter
 * Used for multi-select and ranking elements
 * Handles whitespace trimming and empty values
 */
export const parseCommaSeparated = (value: string): string[] => {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
};

/**
 * Parse number from URL parameter
 * Used for NPS and Rating elements
 * Returns null if parsing fails
 */
export const parseNumber = (value: string): number | null => {
  try {
    // Handle `&` being used instead of `;` in some cases
    const cleanedValue = value.replaceAll("&", ";");
    const num = Number(JSON.parse(cleanedValue));
    return Number.isNaN(num) ? null : num;
  } catch {
    return null;
  }
};
