import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TActionClassPageUrlRule } from "@formbricks/types/action-classes";
import { isStringUrl, isValidCallbackUrl, sanitizeUrlForLogging, testURLmatch } from "./url";

afterEach(() => {
  cleanup();
});

describe("testURLmatch", () => {
  const testCases: [string, string, TActionClassPageUrlRule, string][] = [
    ["https://example.com", "https://example.com", "exactMatch", "yes"],
    ["https://example.com", "https://examples.com", "exactMatch", "no"],
    ["https://example.com/page", "https://example.com", "contains", "yes"],
    ["https://example.com", "https://example.com/page", "contains", "no"],
    ["https://example.com/page", "https://example.com", "startsWith", "yes"],
    ["https://example.com", "https://example.com/page", "startsWith", "no"],
    ["https://example.com/page", "page", "endsWith", "yes"],
    ["https://example.com/page", "https://example.com", "endsWith", "no"],
    ["https://example.com", "https://other.com", "notMatch", "yes"],
    ["https://example.com", "https://example.com", "notMatch", "no"],
    ["https://example.com", "other", "notContains", "yes"],
    ["https://example.com", "example", "notContains", "no"],
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

describe("isStringUrl", () => {
  test("returns true for valid URL", () => {
    expect(isStringUrl("https://example.com")).toBe(true);
  });

  test("returns false for invalid URL", () => {
    expect(isStringUrl("not-a-valid-url")).toBe(false);
  });
});

describe("sanitizeUrlForLogging", () => {
  test("returns sanitized URL with token", () => {
    expect(sanitizeUrlForLogging("https://example.com?token=1234567890")).toBe(
      "https://example.com/?token=********"
    );
  });

  test("returns sanitized URL with code", () => {
    expect(sanitizeUrlForLogging("https://example.com?code=1234567890")).toBe(
      "https://example.com/?code=********"
    );
  });

  test("returns sanitized URL with state", () => {
    expect(sanitizeUrlForLogging("https://example.com?state=1234567890")).toBe(
      "https://example.com/?state=********"
    );
  });

  test("returns sanitized URL with multiple keys", () => {
    expect(
      sanitizeUrlForLogging("https://example.com?token=1234567890&code=1234567890&state=1234567890")
    ).toBe("https://example.com/?token=********&code=********&state=********");
  });

  test("returns sanitized URL without query params", () => {
    expect(sanitizeUrlForLogging("https://example.com")).toBe("https://example.com/");
  });

  test("returns sanitized URL with invalid URL", () => {
    expect(sanitizeUrlForLogging("not-a-valid-url")).toBe("[invalid-url]");
  });
});
