import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { detectAttributeDataType } from "./detect-attribute-type";

/**
 * Storage columns for a contact attribute value
 */
export type TAttributeStorageColumns = {
  value: string;
  valueNumber: number | null;
  valueDate: Date | null;
};

/**
 * Prepares an attribute value for storage by routing to the appropriate column(s).
 * Used when creating a new attribute - detects type and prepares all columns.
 *
 * @param value - The raw value to store (string, number, or Date)
 * @returns Object with dataType and column values for storage
 */
export const prepareNewAttributeForStorage = (
  value: string | number | Date
): {
  dataType: TContactAttributeDataType;
  columns: TAttributeStorageColumns;
} => {
  const dataType = detectAttributeDataType(value);
  const columns = prepareAttributeColumnsForStorage(value, dataType);

  return { dataType, columns };
};

/**
 * Prepares attribute column values based on the data type.
 * Used when updating an existing attribute with a known data type.
 *
 * @param value - The raw value to store (string, number, or Date)
 * @param dataType - The data type of the attribute key
 * @returns Object with column values for storage
 */
export const prepareAttributeColumnsForStorage = (
  value: string | number | Date,
  dataType: TContactAttributeDataType
): TAttributeStorageColumns => {
  switch (dataType) {
    case "string": {
      // String type - only use value column
      let stringValue: string;

      if (value instanceof Date) {
        stringValue = value.toISOString();
      } else if (typeof value === "number") {
        stringValue = String(value);
      } else {
        stringValue = value;
      }

      return {
        value: stringValue,
        valueNumber: null,
        valueDate: null,
      };
    }

    case "number": {
      // Number type - use both value (for backwards compat) and valueNumber columns
      let numericValue: number;

      if (typeof value === "number") {
        numericValue = value;
      } else if (typeof value === "string") {
        numericValue = Number(value.trim());
      } else {
        // Date - shouldn't happen if validation passed, but handle gracefully
        numericValue = value.getTime();
      }

      return {
        value: String(numericValue),
        valueNumber: numericValue,
        valueDate: null,
      };
    }

    case "date": {
      // Date type - use both value (for backwards compat) and valueDate columns
      let dateValue: Date;

      if (value instanceof Date) {
        dateValue = value;
      } else if (typeof value === "string") {
        dateValue = new Date(value);
      } else {
        // Number - treat as timestamp
        dateValue = new Date(value);
      }

      return {
        value: dateValue.toISOString(),
        valueNumber: null,
        valueDate: dateValue,
      };
    }

    default: {
      // Unknown type - treat as string
      return {
        value: String(value),
        valueNumber: null,
        valueDate: null,
      };
    }
  }
};

/**
 * Reads an attribute value from the appropriate column based on data type.
 *
 * @param attribute - The attribute with all column values
 * @param dataType - The data type of the attribute key
 * @returns The value from the appropriate column
 */
export const readAttributeValue = (
  attribute: {
    value: string;
    valueNumber: number | null;
    valueDate: Date | null;
  },
  dataType: TContactAttributeDataType
): string => {
  // For now, always return from value column for backwards compatibility
  // The typed columns are primarily for query performance
  switch (dataType) {
    case "number":
      // Return from valueNumber if available, otherwise fallback to value
      if (attribute.valueNumber === null) {
        return attribute.value;
      }
      return String(attribute.valueNumber);

    case "date":
      // Return from valueDate if available, otherwise fallback to value
      if (attribute.valueDate === null) {
        return attribute.value;
      }
      return attribute.valueDate.toISOString();

    case "string":
    default:
      return attribute.value;
  }
};
