import { describe, expect, test } from "vitest";
import { validateAndParseAttributeValue } from "./validate-attribute-type";

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

    test("accepts numeric string values", () => {
      const result = validateAndParseAttributeValue("3.14", "number", "testKey");
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.parsedValue.valueNumber).toBe(3.14);
      }
    });

    test("accepts numeric strings with whitespace", () => {
      const result = validateAndParseAttributeValue("  123  ", "number", "testKey");
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.parsedValue.valueNumber).toBe(123);
      }
    });

    test("rejects non-numeric strings", () => {
      const result = validateAndParseAttributeValue("hello", "number", "testKey");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("testKey");
        expect(result.error).toContain("expects a number");
      }
    });

    test("rejects Date values", () => {
      const date = new Date();
      const result = validateAndParseAttributeValue(date, "number", "testKey");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("expects a number");
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
        expect(result.error).toContain("purchaseDate");
        expect(result.error).toContain("expects a valid date");
      }
    });

    test("rejects number values", () => {
      const result = validateAndParseAttributeValue(42, "date", "testKey");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("expects a valid date");
      }
    });

    test("rejects invalid Date objects", () => {
      const invalidDate = new Date("invalid");
      const result = validateAndParseAttributeValue(invalidDate, "date", "testKey");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Invalid Date");
      }
    });
  });

  describe("error messages", () => {
    test("includes attribute key in error message", () => {
      const result = validateAndParseAttributeValue("hello", "number", "purchaseAmount");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("purchaseAmount");
      }
    });

    test("includes received value type in error message", () => {
      const result = validateAndParseAttributeValue("hello", "number", "testKey");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("hello");
      }
    });
  });
});
