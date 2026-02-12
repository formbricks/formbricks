import { describe, expect, test } from "vitest";
import { formatValidationError, validateAndParseAttributeValue } from "./validate-attribute-type";

describe("validateAndParseAttributeValue", () => {
  describe("string type", () => {
    test("accepts any string value", () => {
      const result = validateAndParseAttributeValue("hello", "string", "testKey");
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.parsedValue.value).toBe("hello");
        expect(result.parsedValue.valueNumber).toBeNull();
        expect(result.parsedValue.valueDate).toBeNull();
      }
    });

    test("converts numbers to string", () => {
      const result = validateAndParseAttributeValue(42, "string", "testKey");
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.parsedValue.value).toBe("42");
        expect(result.parsedValue.valueNumber).toBeNull();
      }
    });

    test("converts Date to ISO string", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const result = validateAndParseAttributeValue(date, "string", "testKey");
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.parsedValue.value).toBe("2024-01-15T10:30:00.000Z");
        expect(result.parsedValue.valueDate).toBeNull();
      }
    });
  });

  describe("number type", () => {
    test("accepts number values", () => {
      const result = validateAndParseAttributeValue(42, "number", "testKey");
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.parsedValue.value).toBe("42");
        expect(result.parsedValue.valueNumber).toBe(42);
        expect(result.parsedValue.valueDate).toBeNull();
      }
    });

    test("rejects numeric string values (SDK must pass actual numbers)", () => {
      // With stricter validation, strings are NOT accepted for number attributes
      // SDK users must pass actual numbers (e.g., 3.14 instead of "3.14")
      const result = validateAndParseAttributeValue("3.14", "number", "testKey");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("number_type_mismatch");
        expect(result.error.params.key).toBe("testKey");
        expect(formatValidationError(result.error)).toContain("received a string");
      }
    });

    test("rejects any string values for number type", () => {
      const result = validateAndParseAttributeValue("hello", "number", "testKey");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("number_type_mismatch");
        expect(result.error.params.key).toBe("testKey");
      }
    });

    test("rejects Date values", () => {
      const date = new Date();
      const result = validateAndParseAttributeValue(date, "number", "testKey");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("number_type_mismatch");
      }
    });
  });

  describe("date type", () => {
    test("accepts Date objects", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const result = validateAndParseAttributeValue(date, "date", "testKey");
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.parsedValue.value).toBe("2024-01-15T10:30:00.000Z");
        expect(result.parsedValue.valueNumber).toBeNull();
        expect(result.parsedValue.valueDate).toEqual(date);
      }
    });

    test("accepts ISO date strings", () => {
      const result = validateAndParseAttributeValue("2024-01-15T10:30:00.000Z", "date", "testKey");
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.parsedValue.valueDate).toEqual(new Date("2024-01-15T10:30:00.000Z"));
      }
    });

    test("accepts date-only strings", () => {
      const result = validateAndParseAttributeValue("2024-01-15", "date", "testKey");
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.parsedValue.valueDate).not.toBeNull();
      }
    });

    test("rejects invalid date strings", () => {
      const result = validateAndParseAttributeValue("not-a-date", "date", "purchaseDate");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("date_format_invalid");
        expect(result.error.params.key).toBe("purchaseDate");
        expect(result.error.params.value).toBe("not-a-date");
      }
    });

    test("rejects number values", () => {
      const result = validateAndParseAttributeValue(42, "date", "testKey");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("date_unexpected_type");
        expect(result.error.params.key).toBe("testKey");
      }
    });

    test("rejects non-ISO date format strings", () => {
      const result = validateAndParseAttributeValue("15/06/2024", "date", "testKey");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("date_format_invalid");
      }
    });

    test("rejects invalid Date objects", () => {
      const invalidDate = new Date("invalid");
      const result = validateAndParseAttributeValue(invalidDate, "date", "testKey");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("date_invalid");
      }
    });
  });

  describe("error messages", () => {
    test("includes attribute key in error params", () => {
      const result = validateAndParseAttributeValue("hello", "number", "purchaseAmount");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.params.key).toBe("purchaseAmount");
      }
    });

    test("formatValidationError produces human-readable message", () => {
      const result = validateAndParseAttributeValue("hello", "number", "testKey");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        const formatted = formatValidationError(result.error);
        expect(formatted).toContain("testKey");
        expect(formatted).toContain("received a string");
      }
    });
  });
});
