import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

type TRawValue = string | number | Date;

/**
 * Structured validation error with code and params for i18n
 */
export interface TAttributeValidationError {
  code: string;
  params: Record<string, string>;
}

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
      error: TAttributeValidationError;
    };

/**
 * Gets a human-readable type name for error messages
 */
const getTypeName = (value: TRawValue): string => {
  if (value instanceof Date) return "Date";
  return typeof value;
};

/**
 * Validates and parses a string type attribute.
 */
const validateStringType = (value: TRawValue, attributeKey: string): TAttributeValidationResult => {
  if (typeof value === "string") {
    return {
      valid: true,
      parsedValue: {
        value,
        valueNumber: null,
        valueDate: null,
      },
    };
  }

  return {
    valid: false,
    error: {
      code: "string_type_mismatch",
      params: { key: attributeKey, type: getTypeName(value) },
    },
  };
};

/**
 * Validates and parses a number type attribute.
 * STRICT: Only accepts JS numbers, NOT numeric strings.
 * This ensures SDK users pass actual numbers for number attributes.
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

  // Strings are NOT accepted for number attributes (even if they look like numbers)
  return {
    valid: false,
    error: {
      code: "number_type_mismatch",
      params: { key: attributeKey },
    },
  };
};

/**
 * Checks if a string is a valid ISO 8601 date format
 */
const isIsoDateString = (value: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(value.trim());
};

/**
 * Validates and parses a date type attribute.
 * STRICT for SDK: Only accepts Date objects or ISO 8601 strings.
 * Does NOT accept other date formats like DD-MM-YYYY (use CSV upload for that).
 */
const validateDateType = (value: TRawValue, attributeKey: string): TAttributeValidationResult => {
  // Handle Date objects
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return {
        valid: false,
        error: {
          code: "date_invalid",
          params: { key: attributeKey },
        },
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

  // Handle string values - only accept ISO 8601 format
  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (isIsoDateString(trimmedValue)) {
      const dateValue = new Date(trimmedValue);
      if (!Number.isNaN(dateValue.getTime())) {
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

    // String is not in ISO format
    return {
      valid: false,
      error: {
        code: "date_format_invalid",
        params: { key: attributeKey, value: trimmedValue },
      },
    };
  }

  return {
    valid: false,
    error: {
      code: "date_unexpected_type",
      params: { key: attributeKey, type: getTypeName(value), value: String(value) },
    },
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
      return validateStringType(value, attributeKey);
    case "number":
      return validateNumberType(value, attributeKey);
    case "date":
      return validateDateType(value, attributeKey);
    default:
      return validateStringType(value, attributeKey);
  }
};

/**
 * Formats a structured validation error to a human-readable English string.
 * Used for API/SDK responses.
 */
const VALIDATION_ERROR_TEMPLATES: Record<string, string> = {
  string_type_mismatch:
    "Attribute '{key}' expects a string but received a {type}. Pass an actual string value.",
  number_type_mismatch:
    "Attribute '{key}' expects a number but received a string. Pass an actual number value (e.g., 123 instead of \"123\").",
  date_invalid: "Attribute '{key}' expects a valid date. Received: Invalid Date",
  date_format_invalid:
    'Attribute \'{key}\' expects a date in ISO 8601 format (e.g., "2024-01-15" or "2024-01-15T10:30:00.000Z") or a Date object. Received: "{value}"',
  date_unexpected_type: "Attribute '{key}' expects a valid date. Received: {type} value '{value}'",
};

export const formatValidationError = (error: TAttributeValidationError): string => {
  let template = VALIDATION_ERROR_TEMPLATES[error.code] || error.code;
  for (const [key, value] of Object.entries(error.params)) {
    template = template.replaceAll(`{${key}}`, value);
  }
  return template;
};
