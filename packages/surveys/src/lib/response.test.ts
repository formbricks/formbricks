import { describe, expect, it } from "vitest";
import { processResponseData } from "./response";

describe("processResponseData", () => {
  it("should return the same string if input is a string", () => {
    expect(processResponseData("hello world")).toBe("hello world");
    expect(processResponseData("")).toBe("");
  });

  it("should convert number to string", () => {
    expect(processResponseData(123)).toBe("123");
    expect(processResponseData(0)).toBe("0");
    expect(processResponseData(-42.5)).toBe("-42.5");
  });

  describe("when input is an array", () => {
    it('should join array elements with "; "', () => {
      expect(processResponseData(["apple", "banana", "cherry"])).toBe("apple; banana; cherry");
    });

    it("should filter out null, undefined, and empty strings from array", () => {
      expect(processResponseData(["one", null, "two", undefined, "", "three"] as any)).toBe(
        "one; two; three"
      );
    });

    it("should return an empty string if array is empty after filtering", () => {
      expect(processResponseData([null, undefined, ""] as any)).toBe("");
    });

    it("should return an empty string for an empty array", () => {
      expect(processResponseData([])).toBe("");
    });

    it("should handle an array with a single element", () => {
      expect(processResponseData(["single"])).toBe("single");
    });
  });

  describe("when input is an object", () => {
    it('should format object entries as "key: value" pairs, joined by newline', () => {
      // Assuming Object.entries preserves insertion order for string keys here
      expect(processResponseData({ name: "John Doe", age: "30" })).toBe("name: John Doe\nage: 30");
      // Test with different order to confirm typical Object.entries behavior
      expect(processResponseData({ age: "30", name: "John Doe" })).toBe("age: 30\nname: John Doe");
    });

    it("should filter out entries with empty string values", () => {
      expect(processResponseData({ fruit: "apple", taste: "", color: "red" })).toBe(
        "fruit: apple\ncolor: red"
      );
    });

    it("should return an empty string if object is empty after filtering", () => {
      expect(processResponseData({ a: "", b: "" })).toBe("");
    });

    it("should return an empty string for an empty object", () => {
      expect(processResponseData({})).toBe("");
    });
  });

  it("should return an empty string for undefined input (default case)", () => {
    // This tests the default case of the switch statement.
    // Need to cast to 'any' to bypass TypeScript's stricter typing for the function signature.
    expect(processResponseData(undefined as any)).toBe("");
  });
});
