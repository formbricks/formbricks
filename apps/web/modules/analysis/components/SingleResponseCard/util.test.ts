import { describe, expect, it } from "vitest";
import { isSubmissionTimeMoreThan5Minutes, isValidValue } from "./util";

describe("isValidValue", () => {
  it("returns false for an empty string", () => {
    expect(isValidValue("")).toBe(false);
  });

  it("returns false for a blank string", () => {
    expect(isValidValue("   ")).toBe(false);
  });

  it("returns true for a non-empty string", () => {
    expect(isValidValue("hello")).toBe(true);
  });

  it("returns true for numbers", () => {
    expect(isValidValue(0)).toBe(true);
    expect(isValidValue(42)).toBe(true);
  });

  it("returns false for an empty array", () => {
    expect(isValidValue([])).toBe(false);
  });

  it("returns true for a non-empty array", () => {
    expect(isValidValue(["item"])).toBe(true);
  });

  it("returns false for an empty object", () => {
    expect(isValidValue({})).toBe(false);
  });

  it("returns true for a non-empty object", () => {
    expect(isValidValue({ key: "value" })).toBe(true);
  });
});

describe("isSubmissionTimeMoreThan5Minutes", () => {
  it("returns true if submission time is more than 5 minutes ago", () => {
    const currentTime = new Date();
    const oldTime = new Date(currentTime.getTime() - 6 * 60 * 1000); // 6 minutes ago
    expect(isSubmissionTimeMoreThan5Minutes(oldTime)).toBe(true);
  });

  it("returns false if submission time is less than or equal to 5 minutes ago", () => {
    const currentTime = new Date();
    const recentTime = new Date(currentTime.getTime() - 4 * 60 * 1000); // 4 minutes ago
    expect(isSubmissionTimeMoreThan5Minutes(recentTime)).toBe(false);

    const exact5Minutes = new Date(currentTime.getTime() - 5 * 60 * 1000); // exactly 5 minutes ago
    expect(isSubmissionTimeMoreThan5Minutes(exact5Minutes)).toBe(false);
  });
});
