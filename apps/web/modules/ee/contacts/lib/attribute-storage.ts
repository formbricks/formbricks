import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { detectAttributeDataType, detectSDKAttributeDataType, tryParseDate } from "./detect-attribute-type";

type TRawValue = string | number | Date;

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
 * Used when creating a new attribute from CSV upload - detects type flexibly.
 *
 * @param value - The raw value to store (string, number, or Date)
 * @returns Object with dataType and column values for storage
 */
export const prepareNewAttributeForStorage = (
  value: TRawValue
): {
  dataType: TContactAttributeDataType;
  columns: TAttributeStorageColumns;
} => {
  const dataType = detectAttributeDataType(value);
  const columns = prepareAttributeColumnsForStorage(value, dataType);

  return { dataType, columns };
};

/**
 * Prepares an attribute value for storage from SDK input.
 * Uses STRICT type detection:
 * - JS number → number type
 * - ISO 8601 string → date type
 * - Any other string → string type (even if it looks like a number!)
 *
 * @param value - The value from SDK (string or number)
 * @returns Object with dataType and column values for storage
 */
export const prepareNewSDKAttributeForStorage = (
  value: string | number
): {
  dataType: TContactAttributeDataType;
  columns: TAttributeStorageColumns;
} => {
  const dataType = detectSDKAttributeDataType(value);
  const columns = prepareAttributeColumnsForStorage(value, dataType);

  return { dataType, columns };
};

const handleStringType = (value: TRawValue): TAttributeStorageColumns => {
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
};

const handleNumberType = (value: TRawValue): TAttributeStorageColumns => {
  let numericValue: number | null = null;

  if (typeof value === "number") {
    numericValue = Number.isNaN(value) ? null : value;
  } else if (typeof value === "string") {
    const parsed = Number(value.trim());
    numericValue = Number.isNaN(parsed) ? null : parsed;
  } else {
    // Date - shouldn't happen if validation passed, but handle gracefully
    numericValue = value.getTime();
  }

  // If number parsing failed, store as string only (graceful degradation)
  if (numericValue === null) {
    return {
      value: String(value),
      valueNumber: null,
      valueDate: null,
    };
  }

  return {
    value: String(numericValue),
    valueNumber: numericValue,
    valueDate: null,
  };
};

const handleDateType = (value: TRawValue): TAttributeStorageColumns => {
  // Date type - use both value (for backwards compat) and valueDate columns
  let dateValue: Date | null = null;

  if (value instanceof Date) {
    dateValue = value;
  } else if (typeof value === "string") {
    const parsedDate = tryParseDate(value.trim());
    if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
      dateValue = parsedDate;
    } else {
      // Try standard Date parsing as fallback
      const standardDate = new Date(value);
      if (!Number.isNaN(standardDate.getTime())) {
        dateValue = standardDate;
      }
    }
  } else if (typeof value === "number") {
    dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) {
      dateValue = null;
    }
  }

  // If date parsing failed, store as string only (graceful degradation)
  if (!dateValue) {
    return {
      value: String(value),
      valueNumber: null,
      valueDate: null,
    };
  }

  return {
    value: dateValue.toISOString(),
    valueNumber: null,
    valueDate: dateValue,
  };
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
  value: TRawValue,
  dataType: TContactAttributeDataType
): TAttributeStorageColumns => {
  switch (dataType) {
    case "string":
      return handleStringType(value);
    case "number":
      return handleNumberType(value);
    case "date":
      return handleDateType(value);
    default:
      return {
        value: String(value),
        valueNumber: null,
        valueDate: null,
      };
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
