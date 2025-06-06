import { describe, expect, test } from "vitest";
import {
  capitalizeFirstLetter,
  isCapitalized,
  sanitizeString,
  startsWithVowel,
  truncate,
  truncateText,
} from "./strings";

describe("String Utilities", () => {
  describe("capitalizeFirstLetter", () => {
    test("capitalizes the first letter of a string", () => {
      expect(capitalizeFirstLetter("hello")).toBe("Hello");
    });

    test("returns empty string if input is null", () => {
      expect(capitalizeFirstLetter(null)).toBe("");
    });

    test("returns empty string if input is empty string", () => {
      expect(capitalizeFirstLetter("")).toBe("");
    });

    test("doesn't change already capitalized string", () => {
      expect(capitalizeFirstLetter("Hello")).toBe("Hello");
    });

    test("handles single character string", () => {
      expect(capitalizeFirstLetter("a")).toBe("A");
    });
  });

  describe("truncate", () => {
    test("returns the string as is if length is less than the specified length", () => {
      expect(truncate("hello", 10)).toBe("hello");
    });

    test("truncates the string and adds ellipsis if length exceeds the specified length", () => {
      expect(truncate("hello world", 5)).toBe("hello...");
    });

    test("returns empty string if input is falsy", () => {
      expect(truncate("", 5)).toBe("");
    });

    test("handles exact length match correctly", () => {
      expect(truncate("hello", 5)).toBe("hello");
    });
  });

  describe("sanitizeString", () => {
    test("replaces special characters with delimiter", () => {
      expect(sanitizeString("hello@world")).toBe("hello_world");
    });

    test("keeps alphanumeric and allowed characters", () => {
      expect(sanitizeString("hello-world.123")).toBe("hello-world.123");
    });

    test("truncates string to specified length", () => {
      const longString = "a".repeat(300);
      expect(sanitizeString(longString).length).toBe(255);
    });

    test("uses custom delimiter when provided", () => {
      expect(sanitizeString("hello@world", "-")).toBe("hello-world");
    });

    test("uses custom length when provided", () => {
      expect(sanitizeString("hello world", "_", 5)).toBe("hello");
    });
  });

  describe("isCapitalized", () => {
    test("returns true for capitalized strings", () => {
      expect(isCapitalized("Hello")).toBe(true);
    });

    test("returns false for non-capitalized strings", () => {
      expect(isCapitalized("hello")).toBe(false);
    });

    test("handles single uppercase character", () => {
      expect(isCapitalized("A")).toBe(true);
    });

    test("handles single lowercase character", () => {
      expect(isCapitalized("a")).toBe(false);
    });
  });

  describe("startsWithVowel", () => {
    test("returns true for strings starting with lowercase vowels", () => {
      expect(startsWithVowel("apple")).toBe(true);
      expect(startsWithVowel("elephant")).toBe(true);
      expect(startsWithVowel("igloo")).toBe(true);
      expect(startsWithVowel("octopus")).toBe(true);
      expect(startsWithVowel("umbrella")).toBe(true);
    });

    test("returns true for strings starting with uppercase vowels", () => {
      expect(startsWithVowel("Apple")).toBe(true);
      expect(startsWithVowel("Elephant")).toBe(true);
      expect(startsWithVowel("Igloo")).toBe(true);
      expect(startsWithVowel("Octopus")).toBe(true);
      expect(startsWithVowel("Umbrella")).toBe(true);
    });

    test("returns false for strings starting with consonants", () => {
      expect(startsWithVowel("banana")).toBe(false);
      expect(startsWithVowel("Carrot")).toBe(false);
    });

    test("returns false for empty strings", () => {
      expect(startsWithVowel("")).toBe(false);
    });
  });

  describe("truncateText", () => {
    test("returns the string as is if length is less than the specified limit", () => {
      expect(truncateText("hello", 10)).toBe("hello");
    });

    test("truncates the string and adds ellipsis if length exceeds the specified limit", () => {
      expect(truncateText("hello world", 5)).toBe("hello...");
    });

    test("handles exact limit match correctly", () => {
      expect(truncateText("hello", 5)).toBe("hello");
    });
  });
});
