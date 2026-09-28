import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum, TSurveyRatingElement } from "@formbricks/types/surveys/elements";
import { validateNPS, validateRating } from "./validators";

const ratingElement: TSurveyRatingElement = {
  id: "rating",
  type: TSurveyElementTypeEnum.Rating,
  headline: { default: "Rate" },
  required: false,
  scale: "number",
  range: 5,
  isColorCodingEnabled: false,
};

describe("prefill validators", () => {
  test("rejects JSON literals for NPS values", () => {
    expect(validateNPS("true").isValid).toBe(false);
    expect(validateNPS("false").isValid).toBe(false);
    expect(validateNPS("null").isValid).toBe(false);
    expect(validateNPS("[]").isValid).toBe(false);
  });

  test("accepts in-range NPS numbers", () => {
    expect(validateNPS("0").isValid).toBe(true);
    expect(validateNPS("10").isValid).toBe(true);
  });

  test("rejects negative and out-of-range NPS numbers", () => {
    expect(validateNPS("-1").isValid).toBe(false);
    expect(validateNPS("-0.5").isValid).toBe(false);
    expect(validateNPS("11").isValid).toBe(false);
  });

  test("rejects decimal NPS numbers, even in range", () => {
    expect(validateNPS("5.5").isValid).toBe(false);
    expect(validateNPS("0.1").isValid).toBe(false);
    expect(validateNPS("9.99").isValid).toBe(false);
  });

  test("rejects JSON literals for rating values", () => {
    expect(validateRating(ratingElement, "true").isValid).toBe(false);
    expect(validateRating(ratingElement, "false").isValid).toBe(false);
    expect(validateRating(ratingElement, "null").isValid).toBe(false);
    expect(validateRating(ratingElement, "[1]").isValid).toBe(false);
  });

  test("accepts in-range rating numbers", () => {
    expect(validateRating(ratingElement, "1").isValid).toBe(true);
    expect(validateRating(ratingElement, "5").isValid).toBe(true);
  });

  test("rejects negative and out-of-range rating numbers", () => {
    expect(validateRating(ratingElement, "-1").isValid).toBe(false);
    expect(validateRating(ratingElement, "0").isValid).toBe(false);
    expect(validateRating(ratingElement, "6").isValid).toBe(false);
  });

  test("rejects decimal rating numbers, even in range", () => {
    expect(validateRating(ratingElement, "2.5").isValid).toBe(false);
    expect(validateRating(ratingElement, "4.999").isValid).toBe(false);
  });
});
