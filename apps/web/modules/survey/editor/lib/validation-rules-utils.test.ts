import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TValidationRule } from "@formbricks/types/surveys/validation-rules";
import { createRuleParams, getAvailableRuleTypes, getRuleValue } from "./validation-rules-utils";

describe("getAvailableRuleTypes", () => {
  test("should return text rules for openText element with text inputType when no rules exist", () => {
    const elementType = TSurveyElementTypeEnum.OpenText;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules, "text");

    expect(available).toContain("minLength");
    expect(available).toContain("maxLength");
    expect(available).toContain("pattern");
    expect(available).not.toContain("email"); // Excluded - redundant
    expect(available).not.toContain("url"); // Excluded - redundant
    expect(available).not.toContain("phone"); // Excluded - redundant
    expect(available).not.toContain("minValue"); // Only for number inputType
  });

  test("should return text rules for openText element with email inputType", () => {
    const elementType = TSurveyElementTypeEnum.OpenText;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules, "email");

    expect(available).toContain("minLength");
    expect(available).toContain("maxLength");
    expect(available).not.toContain("email"); // Excluded - redundant when inputType=email
    expect(available).not.toContain("minValue"); // Only for number inputType
  });

  test("should return numeric rules for openText element with number inputType", () => {
    const elementType = TSurveyElementTypeEnum.OpenText;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules, "number");

    expect(available).toContain("minValue");
    expect(available).toContain("maxValue");
    expect(available).toContain("isGreaterThan");
    expect(available).toContain("isLessThan");
    expect(available).not.toContain("minLength"); // Only for text inputType
    expect(available).not.toContain("email"); // Excluded
  });

  test("should filter out already added rules", () => {
    const elementType = TSurveyElementTypeEnum.OpenText;
    const existingRules: TValidationRule[] = [
      {
        id: "rule2",
        type: "minLength",
        params: { min: 10 },
      },
    ];

    const available = getAvailableRuleTypes(elementType, existingRules, "text");

    expect(available).not.toContain("minLength");
    expect(available).toContain("maxLength");
    expect(available).toContain("pattern");
  });

  test("should return empty array for multipleChoiceSingle element (no validation rules)", () => {
    const elementType = TSurveyElementTypeEnum.MultipleChoiceSingle;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toEqual([]);
  });

  test("should return minSelections, maxSelections for multipleChoiceMulti element", () => {
    const elementType = TSurveyElementTypeEnum.MultipleChoiceMulti;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toContain("minSelections");
    expect(available).toContain("maxSelections");
    expect(available.length).toBe(2);
  });

  test("should return empty array for rating element (no validation rules)", () => {
    const elementType = TSurveyElementTypeEnum.Rating;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toEqual([]);
  });

  test("should return empty array for nps element (no validation rules)", () => {
    const elementType = TSurveyElementTypeEnum.NPS;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toEqual([]);
  });

  test("should return date validation rules for date element", () => {
    const elementType = TSurveyElementTypeEnum.Date;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toContain("isLaterThan");
    expect(available).toContain("isEarlierThan");
    expect(available).toContain("isBetween");
    expect(available).toContain("isNotBetween");
  });

  test("should return empty array for consent element (no validation rules)", () => {
    const elementType = TSurveyElementTypeEnum.Consent;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toEqual([]);
  });

  test("should return matrix validation rules for matrix element", () => {
    const elementType = TSurveyElementTypeEnum.Matrix;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toContain("minRowsAnswered");
    expect(available.length).toBe(1);
  });

  test("should return ranking validation rules for ranking element", () => {
    const elementType = TSurveyElementTypeEnum.Ranking;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toContain("minRanked");
    expect(available.length).toBe(1);
  });

  test("should return file validation rules for fileUpload element", () => {
    const elementType = TSurveyElementTypeEnum.FileUpload;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toContain("fileSizeAtLeast");
    expect(available).toContain("fileSizeAtMost");
    expect(available).toContain("fileExtensionIs");
    expect(available).toContain("fileExtensionIsNot");
  });

  test("should return minSelections and maxSelections for pictureSelection element", () => {
    const elementType = TSurveyElementTypeEnum.PictureSelection;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toContain("minSelections");
    expect(available).toContain("maxSelections");
    expect(available.length).toBe(2);
  });

  test("should return empty array for address element (no validation rules)", () => {
    const elementType = TSurveyElementTypeEnum.Address;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toEqual([]);
  });

  test("should return empty array for contactInfo element (no validation rules)", () => {
    const elementType = TSurveyElementTypeEnum.ContactInfo;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toEqual([]);
  });

  test("should return empty array for cal element (no validation rules)", () => {
    const elementType = TSurveyElementTypeEnum.Cal;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toEqual([]);
  });

  test("should return empty array for cta element", () => {
    const elementType = TSurveyElementTypeEnum.CTA;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toEqual([]);
  });

  test("should handle unknown element type gracefully", () => {
    const elementType = "unknown" as TSurveyElementTypeEnum;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toEqual([]);
  });
});

describe("getRuleValue", () => {
  test("should return min value for minLength rule", () => {
    const rule: TValidationRule = {
      id: "rule1",
      type: "minLength",
      params: { min: 10 },
    };

    expect(getRuleValue(rule)).toBe(10);
  });

  test("should return max value for maxLength rule", () => {
    const rule: TValidationRule = {
      id: "rule2",
      type: "maxLength",
      params: { max: 100 },
    };

    expect(getRuleValue(rule)).toBe(100);
  });

  test("should return pattern string for pattern rule", () => {
    const rule: TValidationRule = {
      id: "rule3",
      type: "pattern",
      params: { pattern: "^[A-Z].*" },
    };

    expect(getRuleValue(rule)).toBe("^[A-Z].*");
  });

  test("should return pattern string with flags for pattern rule", () => {
    const rule: TValidationRule = {
      id: "rule3",
      type: "pattern",
      params: { pattern: "^[A-Z].*", flags: "i" },
    };

    expect(getRuleValue(rule)).toBe("^[A-Z].*");
  });

  test("should return min value for minValue rule", () => {
    const rule: TValidationRule = {
      id: "rule4",
      type: "minValue",
      params: { min: 5 },
    };

    expect(getRuleValue(rule)).toBe(5);
  });

  test("should return max value for maxValue rule", () => {
    const rule: TValidationRule = {
      id: "rule5",
      type: "maxValue",
      params: { max: 50 },
    };

    expect(getRuleValue(rule)).toBe(50);
  });

  test("should return min value for minSelections rule", () => {
    const rule: TValidationRule = {
      id: "rule6",
      type: "minSelections",
      params: { min: 2 },
    };

    expect(getRuleValue(rule)).toBe(2);
  });

  test("should return max value for maxSelections rule", () => {
    const rule: TValidationRule = {
      id: "rule7",
      type: "maxSelections",
      params: { max: 5 },
    };

    expect(getRuleValue(rule)).toBe(5);
  });

  test("should return undefined for email rule", () => {
    const rule: TValidationRule = {
      id: "rule9",
      type: "email",
      params: {},
    };

    expect(getRuleValue(rule)).toBeUndefined();
  });

  test("should return undefined for url rule", () => {
    const rule: TValidationRule = {
      id: "rule10",
      type: "url",
      params: {},
    };

    expect(getRuleValue(rule)).toBeUndefined();
  });

  test("should return undefined for phone rule", () => {
    const rule: TValidationRule = {
      id: "rule11",
      type: "phone",
      params: {},
    };

    expect(getRuleValue(rule)).toBeUndefined();
  });

  test("should return empty string for pattern rule with empty pattern", () => {
    const rule: TValidationRule = {
      id: "rule12",
      type: "pattern",
      params: { pattern: "" },
    };

    expect(getRuleValue(rule)).toBe("");
  });
});

describe("createRuleParams", () => {
  test("should create params for minLength rule with value", () => {
    const params = createRuleParams("minLength", 10);
    expect(params).toEqual({ min: 10 });
  });

  test("should create params for minLength rule without value (defaults to 0)", () => {
    const params = createRuleParams("minLength");
    expect(params).toEqual({ min: 0 });
  });

  test("should create params for maxLength rule with value", () => {
    const params = createRuleParams("maxLength", 100);
    expect(params).toEqual({ max: 100 });
  });

  test("should create params for maxLength rule without value (defaults to 100)", () => {
    const params = createRuleParams("maxLength");
    expect(params).toEqual({ max: 100 });
  });

  test("should create params for pattern rule with string value", () => {
    const params = createRuleParams("pattern", "^[A-Z].*");
    expect(params).toEqual({ pattern: "^[A-Z].*" });
  });

  test("should create params for pattern rule without value (defaults to empty string)", () => {
    const params = createRuleParams("pattern");
    expect(params).toEqual({ pattern: "" });
  });

  test("should create empty params for email rule", () => {
    const params = createRuleParams("email");
    expect(params).toEqual({});
  });

  test("should create empty params for url rule", () => {
    const params = createRuleParams("url");
    expect(params).toEqual({});
  });

  test("should create empty params for phone rule", () => {
    const params = createRuleParams("phone");
    expect(params).toEqual({});
  });

  test("should create params for minValue rule with value", () => {
    const params = createRuleParams("minValue", 5);
    expect(params).toEqual({ min: 5 });
  });

  test("should create params for minValue rule without value (defaults to 0)", () => {
    const params = createRuleParams("minValue");
    expect(params).toEqual({ min: 0 });
  });

  test("should create params for maxValue rule with value", () => {
    const params = createRuleParams("maxValue", 50);
    expect(params).toEqual({ max: 50 });
  });

  test("should create params for maxValue rule without value (defaults to 100)", () => {
    const params = createRuleParams("maxValue");
    expect(params).toEqual({ max: 100 });
  });

  test("should create params for minSelections rule with value", () => {
    const params = createRuleParams("minSelections", 2);
    expect(params).toEqual({ min: 2 });
  });

  test("should create params for minSelections rule without value (defaults to 1)", () => {
    const params = createRuleParams("minSelections");
    expect(params).toEqual({ min: 1 });
  });

  test("should create params for maxSelections rule with value", () => {
    const params = createRuleParams("maxSelections", 5);
    expect(params).toEqual({ max: 5 });
  });

  test("should create params for maxSelections rule without value (defaults to 3)", () => {
    const params = createRuleParams("maxSelections");
    expect(params).toEqual({ max: 3 });
  });

  test("should convert string number to number for minLength", () => {
    const params = createRuleParams("minLength", "10");
    expect(params).toEqual({ min: 10 });
  });

  test("should convert string number to number for maxLength", () => {
    const params = createRuleParams("maxLength", "100");
    expect(params).toEqual({ max: 100 });
  });

  test("should convert string number to number for minValue", () => {
    const params = createRuleParams("minValue", "5");
    expect(params).toEqual({ min: 5 });
  });

  test("should convert string number to number for maxValue", () => {
    const params = createRuleParams("maxValue", "50");
    expect(params).toEqual({ max: 50 });
  });

  test("should convert string number to number for minSelections", () => {
    const params = createRuleParams("minSelections", "2");
    expect(params).toEqual({ min: 2 });
  });

  test("should convert string number to number for maxSelections", () => {
    const params = createRuleParams("maxSelections", "5");
    expect(params).toEqual({ max: 5 });
  });

  test("should handle invalid string number (defaults to 0 for minLength)", () => {
    const params = createRuleParams("minLength", "invalid");
    expect(params).toEqual({ min: 0 });
  });

  test("should handle invalid string number (defaults to 100 for maxLength)", () => {
    const params = createRuleParams("maxLength", "invalid");
    expect(params).toEqual({ max: 100 });
  });

  test("should handle invalid string number (defaults to 0 for minValue)", () => {
    const params = createRuleParams("minValue", "invalid");
    expect(params).toEqual({ min: 0 });
  });

  test("should handle invalid string number (defaults to 100 for maxValue)", () => {
    const params = createRuleParams("maxValue", "invalid");
    expect(params).toEqual({ max: 100 });
  });

  test("should handle invalid string number (defaults to 1 for minSelections)", () => {
    const params = createRuleParams("minSelections", "invalid");
    expect(params).toEqual({ min: 1 });
  });

  test("should handle invalid string number (defaults to 3 for maxSelections)", () => {
    const params = createRuleParams("maxSelections", "invalid");
    expect(params).toEqual({ max: 3 });
  });
});
