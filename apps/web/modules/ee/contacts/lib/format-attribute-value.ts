import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

/**
 * Formats an attribute value for display based on its data type.
 * Uses Intl APIs for proper locale-aware formatting.
 *
 * @param value - The raw attribute value (string representation from DB)
 * @param dataType - The data type of the attribute
 * @param locale - Optional locale string (defaults to browser locale)
 * @returns Formatted string for display
 */
export const formatAttributeValue = (
  value: string | number | Date | null | undefined,
  dataType: TContactAttributeDataType,
  locale?: string
): string => {
  // Handle null/undefined
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  switch (dataType) {
    case "date": {
      try {
        const dateResolved = typeof value === "number" ? value : String(value);
        const date = value instanceof Date ? value : new Date(dateResolved);
        if (Number.isNaN(date.getTime())) {
          return String(value);
        }
        // Use Intl.DateTimeFormat for locale-aware date formatting
        return new Intl.DateTimeFormat(locale, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(date);
      } catch {
        // If date parsing fails, return the raw value
        return String(value);
      }
    }

    case "number": {
      // Format numbers with proper localization
      const num = typeof value === "number" ? value : Number.parseFloat(String(value));
      if (Number.isNaN(num)) {
        return String(value);
      }
      return num.toLocaleString(locale);
    }

    case "string":
    default:
      return String(value);
  }
};
