import { describe, expect, test } from "vitest";
import {
  TSurveyElementTypeEnum,
  TSurveyMultipleChoiceElement,
  TSurveyRatingElement,
} from "@formbricks/types/surveys/elements";
import {
  validateMultipleChoiceMulti,
  validateMultipleChoiceSingle,
  validateNPS,
  validateRating,
} from "./validators";

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

const choiceElement = (
  type: TSurveyMultipleChoiceElement["type"],
  choices: TSurveyMultipleChoiceElement["choices"]
): TSurveyMultipleChoiceElement => ({
  id: "q",
  type,
  headline: { default: "Pick" },
  required: false,
  shuffleOption: "none",
  choices,
});

describe("prefill validators: answer codes", () => {
  const withOther = [
    { id: "a", label: { default: "Red" }, code: "1" },
    { id: "b", label: { default: "Blue" }, code: "2" },
    { id: "other", label: { default: "Other" }, code: "98" },
  ];
  const noOther = withOther.slice(0, 2);

  test("single select resolves a code to its choice", () => {
    const result = validateMultipleChoiceSingle(
      choiceElement(TSurveyElementTypeEnum.MultipleChoiceSingle, noOther),
      "2",
      "default"
    );
    expect(result).toMatchObject({ isValid: true, matchedChoice: noOther[1] });
  });

  test("single select: an unknown code is invalid without Other", () => {
    const result = validateMultipleChoiceSingle(
      choiceElement(TSurveyElementTypeEnum.MultipleChoiceSingle, noOther),
      "3",
      "default"
    );
    expect(result.isValid).toBe(false);
  });

  test("single select with Other: a code selects the option, not free text", () => {
    const element = choiceElement(TSurveyElementTypeEnum.MultipleChoiceSingle, withOther);
    expect(validateMultipleChoiceSingle(element, "1", "default")).toMatchObject({
      isValid: true,
      matchedChoice: withOther[0],
    });
    expect(validateMultipleChoiceSingle(element, "98", "default")).toMatchObject({
      isValid: true,
      matchedChoice: withOther[2],
    });
  });

  test("single select with Other: an unknown value is still free text", () => {
    const result = validateMultipleChoiceSingle(
      choiceElement(TSurveyElementTypeEnum.MultipleChoiceSingle, withOther),
      "3",
      "default"
    );
    expect(result).toMatchObject({ isValid: true, matchedChoice: null });
  });

  test("a choice without codes does not match 'undefined'", () => {
    const uncoded = [
      { id: "a", label: { default: "Red" } },
      { id: "b", label: { default: "Blue" } },
    ];
    expect(
      validateMultipleChoiceSingle(
        choiceElement(TSurveyElementTypeEnum.MultipleChoiceSingle, uncoded),
        "undefined",
        "default"
      ).isValid
    ).toBe(false);
  });

  test("multi select resolves comma-separated codes to labels", () => {
    const result = validateMultipleChoiceMulti(
      choiceElement(TSurveyElementTypeEnum.MultipleChoiceMulti, noOther),
      "1,2",
      "default"
    );
    expect(result).toMatchObject({ isValid: true, matched: ["Red", "Blue"], others: [] });
  });

  test("multi select with Other: codes are options, an unknown value is the Other text", () => {
    const element = choiceElement(TSurveyElementTypeEnum.MultipleChoiceMulti, withOther);
    expect(validateMultipleChoiceMulti(element, "2,98", "default")).toMatchObject({
      matched: ["Blue", "Other"],
      others: [],
    });
    expect(validateMultipleChoiceMulti(element, "1,hello", "default")).toMatchObject({
      matched: ["Red"],
      others: ["hello"],
    });
  });

  test("multi select without Other: an unknown code makes the value invalid", () => {
    const result = validateMultipleChoiceMulti(
      choiceElement(TSurveyElementTypeEnum.MultipleChoiceMulti, noOther),
      "1,7",
      "default"
    );
    expect(result.isValid).toBe(false);
  });
});
