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
});
