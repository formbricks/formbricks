import { describe, expect, test } from "vitest";
import { detectAttributeDataType } from "./detect-attribute-type";

describe("detectAttributeDataType", () => {
  test("detects ISO 8601 date strings", () => {
    expect(detectAttributeDataType("2024-01-15")).toBe("date");
    expect(detectAttributeDataType("2024-01-15T10:30:00Z")).toBe("date");
    expect(detectAttributeDataType("2024-01-15T10:30:00.000Z")).toBe("date");
    expect(detectAttributeDataType("2023-12-31")).toBe("date");
  });

  test("detects numeric values", () => {
    expect(detectAttributeDataType("42")).toBe("number");
    expect(detectAttributeDataType("3.14")).toBe("number");
    expect(detectAttributeDataType("-10")).toBe("number");
    expect(detectAttributeDataType("0")).toBe("number");
    expect(detectAttributeDataType("  123  ")).toBe("number");
  });

  test("detects text values", () => {
    expect(detectAttributeDataType("hello")).toBe("text");
    expect(detectAttributeDataType("john@example.com")).toBe("text");
    expect(detectAttributeDataType("123abc")).toBe("text");
    expect(detectAttributeDataType("")).toBe("text");
  });

  test("handles invalid date strings as text", () => {
    expect(detectAttributeDataType("2024-13-01")).toBe("text"); // Invalid month
    expect(detectAttributeDataType("not-a-date")).toBe("text");
    expect(detectAttributeDataType("2024/01/15")).toBe("text"); // Wrong format
  });

  test("handles edge cases", () => {
    expect(detectAttributeDataType("   ")).toBe("text"); // Whitespace only
    expect(detectAttributeDataType("NaN")).toBe("text");
    expect(detectAttributeDataType("Infinity")).toBe("number"); // Technically a number
  });
});
