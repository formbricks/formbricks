import { describe, expect, test } from "vitest";
import { detectAttributeDataType } from "./detect-attribute-type";

describe("detectAttributeDataType", () => {
  describe("Date object input", () => {
    test("detects Date objects as date type", () => {
      expect(detectAttributeDataType(new Date())).toBe("date");
      expect(detectAttributeDataType(new Date("2024-01-15"))).toBe("date");
      expect(detectAttributeDataType(new Date("2024-01-15T10:30:00Z"))).toBe("date");
    });
  });

  describe("number input", () => {
    test("detects numbers as number type", () => {
      expect(detectAttributeDataType(42)).toBe("number");
      expect(detectAttributeDataType(3.14)).toBe("number");
      expect(detectAttributeDataType(-10)).toBe("number");
      expect(detectAttributeDataType(0)).toBe("number");
    });
  });

  describe("string input", () => {
    test("detects ISO 8601 date strings", () => {
      expect(detectAttributeDataType("2024-01-15")).toBe("date");
      expect(detectAttributeDataType("2024-01-15T10:30:00Z")).toBe("date");
      expect(detectAttributeDataType("2024-01-15T10:30:00.000Z")).toBe("date");
      expect(detectAttributeDataType("2023-12-31")).toBe("date");
    });

    test("detects numeric string values", () => {
      expect(detectAttributeDataType("42")).toBe("number");
      expect(detectAttributeDataType("3.14")).toBe("number");
      expect(detectAttributeDataType("-10")).toBe("number");
      expect(detectAttributeDataType("0")).toBe("number");
      expect(detectAttributeDataType("  123  ")).toBe("number");
    });

    test("detects string values", () => {
      expect(detectAttributeDataType("hello")).toBe("string");
      expect(detectAttributeDataType("john@example.com")).toBe("string");
      expect(detectAttributeDataType("123abc")).toBe("string");
      expect(detectAttributeDataType("")).toBe("string");
    });

    test("handles invalid date strings as string", () => {
      expect(detectAttributeDataType("2024-13-01")).toBe("string"); // Invalid month
      expect(detectAttributeDataType("not-a-date")).toBe("string");
    });

    test("handles edge cases", () => {
      expect(detectAttributeDataType("   ")).toBe("string"); // Whitespace only
      expect(detectAttributeDataType("NaN")).toBe("string");
      expect(detectAttributeDataType("Infinity")).toBe("number"); // Technically a number
    });
  });
});
