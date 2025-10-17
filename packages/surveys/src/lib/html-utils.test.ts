import { describe, expect, test } from "vitest";
import { isValidHTML } from "./html-utils";

describe("html-utils", () => {
  describe("isValidHTML", () => {
    test("should return false for empty string", () => {
      expect(isValidHTML("")).toBe(false);
    });

    test("should return false for plain text", () => {
      expect(isValidHTML("Hello World")).toBe(false);
    });

    test("should return true for HTML with tags", () => {
      expect(isValidHTML("<p>Hello</p>")).toBe(true);
    });

    test("should return true for HTML with formatting", () => {
      expect(isValidHTML("<p><strong>Bold text</strong></p>")).toBe(true);
    });

    test("should return true for complex HTML", () => {
      expect(isValidHTML('<div class="test"><p>Test</p></div>')).toBe(true);
    });
  });
});
