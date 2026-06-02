import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { validateNPS, validateRating } from "./validators";

describe("prefill validators", () => {
  test("rejects JSON literals for NPS values", () => {
    expect(validateNPS("true").isValid).toBe(false);
    expect(validateNPS("null").isValid).toBe(false);
  });

  test("rejects JSON literals for rating values", () => {
    const ratingElement = {
      type: TSurveyElementTypeEnum.Rating,
      range: 5,
    };

    expect(validateRating(ratingElement as any, "true").isValid).toBe(false);
    expect(validateRating(ratingElement as any, "null").isValid).toBe(false);
  });
});
