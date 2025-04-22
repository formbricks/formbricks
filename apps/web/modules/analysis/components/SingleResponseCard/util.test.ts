import { describe, expect, test } from "vitest";
import { isSubmissionTimeMoreThan5Minutes, isValidValue } from "./util";

describe("isValidValue", () => {
  test("returns false for an empty string", () => {
    expect(isValidValue("")).toBe(false);
  });

  test("returns false for a blank string", () => {
    expect(isValidValue("   ")).toBe(false);
  });

  test("returns true for a non-empty string", () => {
    expect(isValidValue("hello")).toBe(true);
  });

  test("returns true for numbers", () => {
    expect(isValidValue(0)).toBe(true);
    expect(isValidValue(42)).toBe(true);
  });

  test("returns false for an empty array", () => {
    expect(isValidValue([])).toBe(false);
  });

  test("returns true for a non-empty array", () => {
    expect(isValidValue(["item"])).toBe(true);
  });

  test("returns false for an empty object", () => {
    expect(isValidValue({})).toBe(false);
  });

  test("returns true for a non-empty object", () => {
    expect(isValidValue({ key: "value" })).toBe(true);
  });
});

describe("isSubmissionTimeMoreThan5Minutes", () => {
  test("returns true if submission time is more than 5 minutes ago", () => {
    const currentTime = new Date();
    const oldTime = new Date(currentTime.getTime() - 6 * 60 * 1000); // 6 minutes ago
    expect(isSubmissionTimeMoreThan5Minutes(oldTime)).toBe(true);
  });

  test("returns false if submission time is less than or equal to 5 minutes ago", () => {
    const currentTime = new Date();
    const recentTime = new Date(currentTime.getTime() - 4 * 60 * 1000); // 4 minutes ago
    expect(isSubmissionTimeMoreThan5Minutes(recentTime)).toBe(false);

    const exact5Minutes = new Date(currentTime.getTime() - 5 * 60 * 1000); // exactly 5 minutes ago
    expect(isSubmissionTimeMoreThan5Minutes(exact5Minutes)).toBe(false);
  });
});
