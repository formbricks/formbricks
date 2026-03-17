import { describe, expect, test } from "vitest";
import { ZActionClassNoCodeConfig, isValidActionClassUrlFilterValue } from "./action-classes";

describe("isValidActionClassUrlFilterValue", () => {
  test("accepts valid absolute URLs for URL-like rules", () => {
    expect(isValidActionClassUrlFilterValue("https://example.com/dashboard", "exactMatch")).toBe(true);
  });

  test("rejects hostnames without a valid TLD", () => {
    expect(isValidActionClassUrlFilterValue("https://ok", "exactMatch")).toBe(false);
    expect(isValidActionClassUrlFilterValue("https://ok.", "exactMatch")).toBe(false);
  });

  test("accepts localhost and root-relative paths", () => {
    expect(isValidActionClassUrlFilterValue("http://localhost:3000/dashboard", "exactMatch")).toBe(true);
    expect(isValidActionClassUrlFilterValue("/dashboard", "startsWith")).toBe(true);
  });

  test("skips URL-shape validation for free-form rules", () => {
    expect(isValidActionClassUrlFilterValue("dashboard", "contains")).toBe(true);
  });
});

describe("ZActionClassNoCodeConfig", () => {
  test("rejects invalid URL-like filters", () => {
    const result = ZActionClassNoCodeConfig.safeParse({
      type: "pageView",
      urlFilters: [{ rule: "exactMatch", value: "https://ok." }],
    });

    expect(result.success).toBe(false);
  });

  test("accepts valid URL-like filters", () => {
    const result = ZActionClassNoCodeConfig.safeParse({
      type: "pageView",
      urlFilters: [{ rule: "exactMatch", value: "https://example.com/dashboard" }],
    });

    expect(result.success).toBe(true);
  });
});
