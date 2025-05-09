import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TActionClassPageUrlRule } from "@formbricks/types/action-classes";
import { isValidCallbackUrl, testURLmatch } from "./url";

afterEach(() => {
  cleanup();
});

describe("testURLmatch", () => {
  const testCases: [string, string, TActionClassPageUrlRule, string][] = [
    ["https://example.com", "https://example.com", "exactMatch", "yes"],
    ["https://example.com", "https://example.com/page", "contains", "no"],
    ["https://example.com/page", "https://example.com", "startsWith", "yes"],
    ["https://example.com/page", "page", "endsWith", "yes"],
    ["https://example.com", "https://other.com", "notMatch", "yes"],
    ["https://example.com", "other", "notContains", "yes"],
  ];

  test.each(testCases)("returns %s for %s with rule %s", (testUrl, pageUrlValue, pageUrlRule, expected) => {
    expect(testURLmatch(testUrl, pageUrlValue, pageUrlRule)).toBe(expected);
  });

  test("throws an error for invalid match type", () => {
    expect(() =>
      testURLmatch("https://example.com", "https://example.com", "invalidRule" as TActionClassPageUrlRule)
    ).toThrow("Invalid match type");
  });
});

describe("isValidCallbackUrl", () => {
  const WEBAPP_URL = "https://webapp.example.com";

  test("returns true for valid callback URL", () => {
    expect(isValidCallbackUrl("https://webapp.example.com/callback", WEBAPP_URL)).toBe(true);
  });

  test("returns false for invalid scheme", () => {
    expect(isValidCallbackUrl("ftp://webapp.example.com/callback", WEBAPP_URL)).toBe(false);
  });

  test("returns false for invalid domain", () => {
    expect(isValidCallbackUrl("https://malicious.com/callback", WEBAPP_URL)).toBe(false);
  });

  test("returns false for malformed URL", () => {
    expect(isValidCallbackUrl("not-a-valid-url", WEBAPP_URL)).toBe(false);
  });
});
