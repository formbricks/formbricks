import { describe, expect, test } from "vitest";
import { formatAttributeValue } from "./format-attribute-value";

describe("formatAttributeValue", () => {
  describe("null/undefined/empty handling", () => {
    test("should return '-' for null value", () => {
      expect(formatAttributeValue(null, "string")).toBe("-");
      expect(formatAttributeValue(null, "number")).toBe("-");
      expect(formatAttributeValue(null, "date")).toBe("-");
    });

    test("should return '-' for undefined value", () => {
      expect(formatAttributeValue(undefined, "string")).toBe("-");
      expect(formatAttributeValue(undefined, "number")).toBe("-");
      expect(formatAttributeValue(undefined, "date")).toBe("-");
    });

    test("should return '-' for empty string", () => {
      expect(formatAttributeValue("", "string")).toBe("-");
      expect(formatAttributeValue("", "number")).toBe("-");
      expect(formatAttributeValue("", "date")).toBe("-");
    });
  });

  describe("string dataType", () => {
    test("should return string value as-is", () => {
      expect(formatAttributeValue("hello world", "string")).toBe("hello world");
    });

    test("should convert number to string", () => {
      expect(formatAttributeValue(42, "string")).toBe("42");
    });

    test("should convert Date to string", () => {
      const date = new Date("2024-06-15T10:30:00.000Z");
      const result = formatAttributeValue(date, "string");
      expect(result).toBe(date.toString());
    });

    test("should handle special characters", () => {
      expect(formatAttributeValue("test@example.com", "string")).toBe("test@example.com");
      expect(formatAttributeValue("hello\nworld", "string")).toBe("hello\nworld");
    });
  });

  describe("number dataType", () => {
    test("should format integer with locale string", () => {
      const result = formatAttributeValue(1000, "number", "en-US");
      // toLocaleString adds commas for thousands in en-US
      expect(result).toBe("1,000");
    });

    test("should format large number with locale string", () => {
      const result = formatAttributeValue(1234567, "number", "en-US");
      expect(result).toBe("1,234,567");
    });

    test("should format decimal number", () => {
      const result = formatAttributeValue(3.14159, "number");
      // toLocaleString may round decimals, so just check it's a valid number representation
      expect(Number.parseFloat(result)).toBeCloseTo(3.14159, 2);
    });

    test("should format negative number", () => {
      const result = formatAttributeValue(-500, "number");
      expect(result).toBe("-500");
    });

    test("should handle zero", () => {
      expect(formatAttributeValue(0, "number")).toBe("0");
    });

    test("should parse numeric string", () => {
      const result = formatAttributeValue("1000", "number", "en-US");
      expect(result).toBe("1,000");
    });

    test("should parse decimal string", () => {
      const result = formatAttributeValue("99.99", "number");
      expect(result).toBe("99.99");
    });

    test("should return raw value for invalid number string", () => {
      expect(formatAttributeValue("not a number", "number")).toBe("not a number");
    });

    test("should return raw value for NaN", () => {
      expect(formatAttributeValue(Number.NaN, "number")).toBe("NaN");
    });
  });

  describe("date dataType", () => {
    test("should format Date object with locale-aware formatting", () => {
      const date = new Date("2024-06-15T10:30:00.000Z");
      const result = formatAttributeValue(date, "date", "en-US");
      // Note: The exact format depends on timezone, but should contain these parts
      expect(result).toMatch(/Jun \d+, 2024/);
    });

    test("should format ISO date string", () => {
      const result = formatAttributeValue("2024-01-15", "date", "en-US");
      expect(result).toMatch(/Jan \d+, 2024/);
    });

    test("should format date string with time", () => {
      const result = formatAttributeValue("2024-12-25T00:00:00.000Z", "date", "en-US");
      expect(result).toMatch(/Dec \d+, 2024/);
    });

    test("should return raw value for invalid date string", () => {
      const result = formatAttributeValue("not a date", "date");
      expect(result).toBe("not a date");
    });

    test("should handle timestamp number", () => {
      const timestamp = new Date("2024-06-15T10:30:00.000Z").getTime();
      const result = formatAttributeValue(timestamp, "date", "en-US");
      expect(result).toMatch(/Jun \d+, 2024/);
    });

    test("should format date in different locale", () => {
      const date = new Date("2024-06-15T10:30:00.000Z");
      const result = formatAttributeValue(date, "date", "de-DE");
      // German format uses different month abbreviation
      expect(result).toMatch(/Juni?\s+\d+,?\s+2024|15\.\s*Juni?\s*2024/);
    });
  });

  describe("unknown/default dataType", () => {
    test("should return string representation for unknown type", () => {
      const result = formatAttributeValue("test value", "unknown" as "string");
      expect(result).toBe("test value");
    });

    test("should convert number to string for unknown type", () => {
      const result = formatAttributeValue(123, "unknown" as "string");
      expect(result).toBe("123");
    });
  });

  describe("edge cases", () => {
    test("should handle very large numbers", () => {
      const result = formatAttributeValue(999999999999, "number", "en-US");
      expect(result).toBe("999,999,999,999");
    });

    test("should handle very small decimals", () => {
      const result = formatAttributeValue(0.000001, "number");
      // toLocaleString may round very small decimals, just verify it's a valid number string
      expect(Number.isNaN(Number.parseFloat(result))).toBe(false);
    });

    test("should handle whitespace-only string", () => {
      expect(formatAttributeValue("   ", "string")).toBe("   ");
    });

    test("should handle string '0'", () => {
      expect(formatAttributeValue("0", "string")).toBe("0");
      expect(formatAttributeValue("0", "number")).toBe("0");
    });

    test("should handle boolean-like strings", () => {
      expect(formatAttributeValue("true", "string")).toBe("true");
      expect(formatAttributeValue("false", "string")).toBe("false");
    });
  });
});
