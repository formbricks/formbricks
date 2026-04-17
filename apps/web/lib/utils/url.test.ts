import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TActionClassPageUrlRule } from "@formbricks/types/action-classes";
import { getValidatedCallbackUrl, isStringUrl, testURLmatch } from "./url";

afterEach(() => {
  cleanup();
});

describe("testURLmatch", () => {
  // Mock translation function
  const mockT = (key: string): string => {
    const translations: Record<string, string> = {
      "environments.actions.invalid_regex": "Please use a valid regular expression.",
      "environments.actions.invalid_match_type": "The option selected is not available.",
    };
    return translations[key] || key;
  };

  const testCases: [string, string, TActionClassPageUrlRule, boolean][] = [
    ["https://example.com", "https://example.com", "exactMatch", true],
    ["https://example.com", "https://different.com", "exactMatch", false],
    ["https://example.com/page", "example.com", "contains", true],
    ["https://example.com", "different.com", "contains", false],
    ["https://example.com/page", "https://example.com", "startsWith", true],
    ["https://example.com", "https://different.com", "startsWith", false],
    ["https://example.com/page", "page", "endsWith", true],
    ["https://example.com/page", "different", "endsWith", false],
    ["https://example.com", "https://different.com", "notMatch", true],
    ["https://example.com", "https://example.com", "notMatch", false],
    ["https://example.com", "different", "notContains", true],
    ["https://example.com", "example", "notContains", false],
  ];

  test.each(testCases)("returns %s for %s with rule %s", (testUrl, pageUrlValue, pageUrlRule, expected) => {
    expect(testURLmatch(testUrl, pageUrlValue, pageUrlRule, mockT)).toBe(expected);
  });

  describe("matchesRegex rule", () => {
    test("returns true when URL matches regex pattern", () => {
      expect(testURLmatch("https://example.com/user/123", "user/\\d+", "matchesRegex", mockT)).toBe(true);
      expect(testURLmatch("https://example.com/dashboard", "dashboard$", "matchesRegex", mockT)).toBe(true);
      expect(testURLmatch("https://app.example.com", "^https://app", "matchesRegex", mockT)).toBe(true);
    });

    test("returns false when URL does not match regex pattern", () => {
      expect(testURLmatch("https://example.com/user/abc", "user/\\d+", "matchesRegex", mockT)).toBe(false);
      expect(testURLmatch("https://example.com/settings", "dashboard$", "matchesRegex", mockT)).toBe(false);
      expect(testURLmatch("https://api.example.com", "^https://app", "matchesRegex", mockT)).toBe(false);
    });

    test("throws error for invalid regex pattern", () => {
      expect(() => testURLmatch("https://example.com", "[invalid-regex", "matchesRegex", mockT)).toThrow(
        "Please use a valid regular expression."
      );

      expect(() => testURLmatch("https://example.com", "*invalid", "matchesRegex", mockT)).toThrow(
        "Please use a valid regular expression."
      );
    });
  });

  test("throws an error for invalid match type", () => {
    expect(() =>
      testURLmatch(
        "https://example.com",
        "https://example.com",
        "invalidRule" as TActionClassPageUrlRule,
        mockT
      )
    ).toThrow("The option selected is not available.");
  });
});

describe("getValidatedCallbackUrl", () => {
  const WEBAPP_URL = "https://webapp.example.com";

  test("returns the normalized callback URL for a valid callback", () => {
    expect(getValidatedCallbackUrl("https://webapp.example.com/callback", WEBAPP_URL)).toBe(
      "https://webapp.example.com/callback"
    );
  });

  test("returns null for invalid scheme", () => {
    expect(getValidatedCallbackUrl("ftp://webapp.example.com/callback", WEBAPP_URL)).toBeNull();
  });

  test("returns null for invalid domain", () => {
    expect(getValidatedCallbackUrl("https://malicious.com/callback", WEBAPP_URL)).toBeNull();
  });

  test("returns null for malformed URL", () => {
    expect(getValidatedCallbackUrl("not-a-valid-url", WEBAPP_URL)).toBeNull();
  });
});

describe("isStringUrl", () => {
  test("returns true for valid URL", () => {
    expect(isStringUrl("https://example.com")).toBe(true);
  });

  test("returns false for invalid URL", () => {
    expect(isStringUrl("not-a-valid-url")).toBe(false);
  });
});
