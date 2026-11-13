import { describe, expect, test } from "vitest";
import { compareConditionValues } from "./condition-comparison";
import { TSurveyElementTypeEnum } from "./constants";

describe("compareConditionValues", () => {
  test("casts both sides to numbers for the ordering operators, so a number sent as text compares", () => {
    expect(compareConditionValues("isGreaterThan", "412", 400)).toBe(true);
    expect(compareConditionValues("isLessThanOrEqual", 412, "412")).toBe(true);
    expect(compareConditionValues("isLessThan", "412", "40")).toBe(false);
  });

  test("equals is strict apart from a one-item list against its text", () => {
    expect(compareConditionValues("equals", "412", 412)).toBe(false);
    expect(compareConditionValues("equals", ["Red"], "Red")).toBe(true);
    expect(compareConditionValues("equals", ["Red", "Blue"], "Red")).toBe(false);
    expect(compareConditionValues("doesNotEqual", ["Red"], "Red")).toBe(false);
    expect(compareConditionValues("doesNotEqual", "a", "b")).toBe(true);
  });

  test("a date element compares instants on equals and does not equal", () => {
    const context = { leftElementType: TSurveyElementTypeEnum.Date };
    expect(compareConditionValues("equals", "2026-11-04", "2026-11-04T00:00:00.000Z", context)).toBe(true);
    expect(compareConditionValues("doesNotEqual", "2026-11-04", "2026-11-05", context)).toBe(true);
    expect(compareConditionValues("equals", "2026-11-04", "2026-11-04T00:00:00.000Z")).toBe(false);
  });

  test("a precomputed date order decides equals for a date field", () => {
    expect(compareConditionValues("equals", "x", "y", { dateOrder: 0 })).toBe(true);
    expect(compareConditionValues("doesNotEqual", "x", "y", { dateOrder: 1 })).toBe(true);
  });

  test("text against a one-option multi-select element on the right compares the option", () => {
    const context = { rightElementType: TSurveyElementTypeEnum.MultipleChoiceMulti };
    expect(compareConditionValues("equals", "Red", ["Red"], context)).toBe(true);
    expect(compareConditionValues("equals", "Red", ["Red", "Blue"], context)).toBe(false);
    expect(compareConditionValues("doesNotEqual", "Blue", ["Red"], context)).toBe(true);
  });

  test("a picture selection on the left does not equal an option it does not hold", () => {
    const context = { leftElementType: TSurveyElementTypeEnum.PictureSelection };
    expect(compareConditionValues("doesNotEqual", ["a", "b"], "a", context)).toBe(false);
    expect(compareConditionValues("doesNotEqual", ["a", "b"], "c", context)).toBe(true);
  });

  test("text operators read both sides as text", () => {
    expect(compareConditionValues("contains", "hello world", "lo w")).toBe(true);
    expect(compareConditionValues("doesNotContain", 12345, 34)).toBe(false);
    expect(compareConditionValues("startsWith", "hello", "he")).toBe(true);
    expect(compareConditionValues("doesNotEndWith", "hello", "lo")).toBe(false);
  });

  test("list operators need lists on both sides", () => {
    expect(compareConditionValues("includesOneOf", ["a", "b"], ["b", "c"])).toBe(true);
    expect(compareConditionValues("includesAllOf", ["a", "b"], ["a", "c"])).toBe(false);
    expect(compareConditionValues("doesNotIncludeOneOf", ["a"], ["b"])).toBe(true);
    expect(compareConditionValues("doesNotIncludeAllOf", ["a"], ["a", "b"])).toBe(true);
    expect(compareConditionValues("includesOneOf", "a", ["a"])).toBe(false);
    expect(compareConditionValues("equalsOneOf", "a", ["a", "b"])).toBe(true);
    expect(compareConditionValues("isAnyOf", "c", ["a", "b"])).toBe(false);
  });

  test("presence operators", () => {
    expect(compareConditionValues("isSet", 0, undefined)).toBe(true);
    expect(compareConditionValues("isSet", "", undefined)).toBe(false);
    expect(compareConditionValues("isNotSet", null, undefined)).toBe(true);
    expect(compareConditionValues("isEmpty", "", undefined)).toBe(true);
    expect(compareConditionValues("isEmpty", undefined, undefined)).toBe(false);
    expect(compareConditionValues("isNotEmpty", "x", undefined)).toBe(true);
  });

  test("submitted and skipped follow the stored answer shapes", () => {
    expect(compareConditionValues("isSubmitted", "skipped", undefined)).toBe(true);
    expect(
      compareConditionValues("isSubmitted", "skipped", undefined, {
        leftElementType: TSurveyElementTypeEnum.FileUpload,
      })
    ).toBe(false);
    expect(compareConditionValues("isSubmitted", [], undefined)).toBe(false);
    expect(compareConditionValues("isSkipped", {}, undefined)).toBe(true);
  });

  test("element-state operators", () => {
    expect(compareConditionValues("isClicked", "clicked", undefined)).toBe(true);
    expect(compareConditionValues("isNotClicked", "dismissed", undefined)).toBe(true);
    expect(compareConditionValues("isAccepted", "accepted", undefined)).toBe(true);
    expect(compareConditionValues("isPartiallySubmitted", { a: "", b: "x" }, undefined)).toBe(true);
    expect(compareConditionValues("isCompletelySubmitted", { a: "y", b: "x" }, undefined)).toBe(true);
  });

  test("a comparison that throws reads as not matched", () => {
    expect(compareConditionValues("isPartiallySubmitted", null, undefined)).toBe(false);
  });

  test("before and after compare dates", () => {
    expect(compareConditionValues("isBefore", "2026-11-03", "2026-11-04")).toBe(true);
    expect(compareConditionValues("isAfter", "2026-11-03", "2026-11-04")).toBe(false);
  });
});
