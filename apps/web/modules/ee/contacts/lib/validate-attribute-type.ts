import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

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
 * Checks if a string value is a valid ISO 8601 date
 */
const isValidISODate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

/**
 * Checks if a string value is a valid number
 */
const isValidNumber = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed !== "" && !Number.isNaN(Number(trimmed));
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
  value: string | number | Date,
  expectedDataType: TContactAttributeDataType,
  attributeKey: string
): TAttributeValidationResult => {
  switch (expectedDataType) {
    case "string": {
      // String type accepts any value - convert to string
      let stringValue: string;

      if (value instanceof Date) {
        stringValue = value.toISOString();
      } else if (typeof value === "number") {
        stringValue = String(value);
      } else {
        stringValue = value;
      }

      return {
        valid: true,
        parsedValue: {
          value: stringValue,
          valueNumber: null,
          valueDate: null,
        },
      };
    }

    case "number": {
      // Number type expects a numeric value
      let numericValue: number;

      if (typeof value === "number") {
        numericValue = value;
      } else if (typeof value === "string" && isValidNumber(value)) {
        numericValue = Number(value.trim());
      } else {
        const receivedType = value instanceof Date ? "Date" : typeof value;
        return {
          valid: false,
          error: `Attribute '${attributeKey}' expects a number. Received: ${receivedType} value '${String(value)}'`,
        };
      }

      return {
        valid: true,
        parsedValue: {
          value: String(numericValue), // Keep string column for backwards compatibility
          valueNumber: numericValue,
          valueDate: null,
        },
      };
    }

    case "date": {
      // Date type expects a Date object or valid ISO date string
      let dateValue: Date;

      if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
          return {
            valid: false,
            error: `Attribute '${attributeKey}' expects a valid date. Received: Invalid Date`,
          };
        }
        dateValue = value;
      } else if (typeof value === "string" && isValidISODate(value)) {
        dateValue = new Date(value);
      } else {
        const receivedType = typeof value;
        return {
          valid: false,
          error: `Attribute '${attributeKey}' expects a date (ISO 8601 string or Date object). Received: ${receivedType} value '${String(value)}'`,
        };
      }

      return {
        valid: true,
        parsedValue: {
          value: dateValue.toISOString(), // Keep string column for backwards compatibility
          valueNumber: null,
          valueDate: dateValue,
        },
      };
    }

    default: {
      // Unknown type - treat as string
      return {
        valid: true,
        parsedValue: {
          value: String(value),
          valueNumber: null,
          valueDate: null,
        },
      };
    }
  }
};
