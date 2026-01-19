import { format } from "date-fns";
import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

/**
 * Formats an attribute value for display based on its data type.
 *
 * @param value - The raw attribute value (string representation from DB)
 * @param dataType - The data type of the attribute
 * @returns Formatted string for display
 */
export const formatAttributeValue = (
  value: string | number | Date | null | undefined,
  dataType: TContactAttributeDataType
): string => {
  // Handle null/undefined
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  switch (dataType) {
    case "date": {
      try {
        const date = value instanceof Date ? value : new Date(value);
        // Format as "Jan 15, 2024" for better readability
        return format(date, "MMM d, yyyy");
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
      // Use toLocaleString for proper formatting with commas
      return num.toLocaleString();
    }

    case "string":
    default:
      return String(value);
  }
};
