import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { tryParseDate } from "@/modules/ee/contacts/lib/detect-attribute-type";

type TRawValue = string | number | Date;

/**
 * Result of attribute value validation
 */
export type TAttributeValidationResult =
  | {
      valid: true;
      parsedValue: {
        value: string;
        valueNumber: number | null;
        valueDate: Date | null;
      };
    }
  | {
      valid: false;
      error: string;
    };

/**
 * Checks if a string value is a valid number
 */
const isValidNumber = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed !== "" && !Number.isNaN(Number(trimmed));
};

/**
 * Converts any value to a string representation
 */
const convertToString = (value: TRawValue): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return String(value);
  return value;
};

/**
 * Gets a human-readable type name for error messages
 */
const getTypeName = (value: TRawValue): string => {
  if (value instanceof Date) return "Date";
  return typeof value;
};

/**
 * Validates and parses a string type attribute
 */
const validateStringType = (value: TRawValue): TAttributeValidationResult => ({
  valid: true,
  parsedValue: {
    value: convertToString(value),
    valueNumber: null,
    valueDate: null,
  },
});

/**
 * Validates and parses a number type attribute
 */
const validateNumberType = (value: TRawValue, attributeKey: string): TAttributeValidationResult => {
  if (typeof value === "number") {
    return {
      valid: true,
      parsedValue: {
        value: String(value),
        valueNumber: value,
        valueDate: null,
      },
    };
  }

  if (typeof value === "string" && isValidNumber(value)) {
    const numericValue = Number(value.trim());
    return {
      valid: true,
      parsedValue: {
        value: String(numericValue),
        valueNumber: numericValue,
        valueDate: null,
      },
    };
  }

  return {
    valid: false,
    error: `Attribute '${attributeKey}' expects a number. Received: ${getTypeName(value)} value '${String(value)}'`,
  };
};

/**
 * Validates and parses a date type attribute
 * Supports multiple formats: ISO 8601, DD-MM-YYYY, MM-DD-YYYY, etc.
 */
const validateDateType = (value: TRawValue, attributeKey: string): TAttributeValidationResult => {
  // Handle Date objects
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return {
        valid: false,
        error: `Attribute '${attributeKey}' expects a valid date. Received: Invalid Date`,
      };
    }
    return {
      valid: true,
      parsedValue: {
        value: value.toISOString(),
        valueNumber: null,
        valueDate: value,
      },
    };
  }

  // Handle string values with flexible parsing
  if (typeof value === "string") {
    const dateValue = tryParseDate(value.trim());
    if (dateValue && !Number.isNaN(dateValue.getTime())) {
      return {
        valid: true,
        parsedValue: {
          value: dateValue.toISOString(),
          valueNumber: null,
          valueDate: dateValue,
        },
      };
    }
  }

  return {
    valid: false,
    error: `Attribute '${attributeKey}' expects a valid date. Received: ${getTypeName(value)} value '${String(value)}'`,
  };
};

/**
 * Validates that a value matches the expected data type and parses it for storage.
 * Used for subsequent writes to an existing attribute key.
 *
 * @param value - The value to validate (string, number, or Date)
 * @param expectedDataType - The expected data type of the attribute key
 * @param attributeKey - The attribute key name (for error messages)
 * @returns Validation result with parsed values for storage or error message
 */
export const validateAndParseAttributeValue = (
  value: TRawValue,
  expectedDataType: TContactAttributeDataType,
  attributeKey: string
): TAttributeValidationResult => {
  switch (expectedDataType) {
    case "string":
      return validateStringType(value);
    case "number":
      return validateNumberType(value, attributeKey);
    case "date":
      return validateDateType(value, attributeKey);
    default:
      return validateStringType(value);
  }
};
