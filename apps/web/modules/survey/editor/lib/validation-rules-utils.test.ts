import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
  MAX_RELATIVE_DATE_AMOUNT,
  TValidationRule,
  ZRelativeDateBound,
} from "@formbricks/types/surveys/validation-rules";
import {
  clampRelativeAmount,
  createRelativeDateParams,
  createRuleParams,
  describeRelativeDateRule,
  getAvailableRuleTypes,
  getRuleValue,
  isRelativeDateParams,
  parseDateRangeRuleValue,
  parseDateRuleValue,
} from "./validation-rules-utils";

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
    expect(available).not.toContain("isGreaterThan"); // Removed - redundant with minValue
    expect(available).not.toContain("isLessThan"); // Removed - redundant with maxValue
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
    expect(available).toContain("answerAllRows");
    expect(available.length).toBe(2);
  });

  test("should return ranking validation rules for ranking element", () => {
    const elementType = TSurveyElementTypeEnum.Ranking;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toContain("minRanked");
    expect(available).toContain("rankAll");
    expect(available.length).toBe(2);
  });

  test("should return file validation rules for fileUpload element", () => {
    const elementType = TSurveyElementTypeEnum.FileUpload;
    const existingRules: TValidationRule[] = [];

    const available = getAvailableRuleTypes(elementType, existingRules);

    expect(available).toContain("fileExtensionIs");
    expect(available).toContain("fileExtensionIsNot");
  });

  test("should return minSelections, maxSelections for pictureSelection element", () => {
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

describe("relative date params", () => {
  test("isRelativeDateParams distinguishes relative bounds from fixed dates", () => {
    expect(isRelativeDateParams({ date: "2026-03-01" })).toBe(false);
    expect(isRelativeDateParams({ startDate: "2026-03-01", endDate: "2026-03-10" })).toBe(false);
    expect(isRelativeDateParams({ relative: { amount: 3, unit: "calendarDays", direction: "before" } })).toBe(
      true
    );
    expect(
      isRelativeDateParams({
        relativeStart: { amount: 3, unit: "calendarDays", direction: "before" },
        relativeEnd: { amount: 4, unit: "calendarDays", direction: "after" },
      })
    ).toBe(true);
  });

  test("createRelativeDateParams returns a single bound for single-bound rules", () => {
    expect(createRelativeDateParams("isLaterThan")).toEqual({
      relative: { amount: 0, unit: "calendarDays", direction: "before" },
    });
  });

  test("createRelativeDateParams returns a window straddling the response date for range rules", () => {
    expect(createRelativeDateParams("isBetween")).toEqual({
      relativeStart: { amount: 0, unit: "calendarDays", direction: "before" },
      relativeEnd: { amount: 0, unit: "calendarDays", direction: "after" },
    });
  });

  test("getRuleValue returns undefined for relative params so they do not leak into the text input", () => {
    const singleBound: TValidationRule = {
      id: "1",
      type: "isLaterThan",
      params: { relative: { amount: 3, unit: "calendarDays", direction: "before" } },
    };
    const range: TValidationRule = {
      id: "2",
      type: "isBetween",
      params: {
        relativeStart: { amount: 3, unit: "workingDays", direction: "before" },
        relativeEnd: { amount: 4, unit: "workingDays", direction: "after" },
      },
    };

    expect(getRuleValue(singleBound)).toBeUndefined();
    expect(getRuleValue(range)).toBeUndefined();
  });

  test("getRuleValue still reads fixed date params", () => {
    const fixed: TValidationRule = {
      id: "1",
      type: "isBetween",
      params: { startDate: "2026-03-01", endDate: "2026-03-10" },
    };

    expect(getRuleValue(fixed)).toBe("2026-03-01,2026-03-10");
  });
});

describe("parseDateRuleValue", () => {
  test("parses a stored day to local midnight, so the picker shows the day that was saved", () => {
    const parsed = parseDateRuleValue("2026-03-01");

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(1);
    expect(parsed?.getHours()).toBe(0);
  });

  test.each([undefined, "", "not-a-date", "2026-3-1", "2026-02-30"])(
    "returns null for %s rather than an invalid or rolled-over Date",
    (value) => {
      expect(parseDateRuleValue(value)).toBeNull();
    }
  );
});

describe("parseDateRangeRuleValue", () => {
  test("splits the stored start,end pair", () => {
    const { from, to } = parseDateRangeRuleValue("2026-03-01,2026-03-10");

    expect(from?.getDate()).toBe(1);
    expect(to?.getDate()).toBe(10);
  });

  test("leaves a half-set or empty range unparsed instead of guessing a bound", () => {
    expect(parseDateRangeRuleValue("2026-03-01,")).toEqual({
      from: new Date(2026, 2, 1),
      to: null,
    });
    expect(parseDateRangeRuleValue("")).toEqual({ from: null, to: null });
    expect(parseDateRangeRuleValue(undefined)).toEqual({ from: null, to: null });
  });
});

describe("describeRelativeDateRule", () => {
  // Mirrors the en-US strings closely enough to read the sentences (plural forms flattened);
  // interpolates {name} placeholders and records which key each call used.
  const strings: Record<string, string> = {
    relative_bound_calendar_days_after: "{count} calendar days after submission",
    relative_bound_calendar_days_before: "{count} calendar days before submission",
    relative_bound_submission_day: "the submission day",
    relative_bound_working_days_after: "{count} working days after submission",
    relative_bound_working_days_before: "{count} working days before submission",
    relative_summary_between: "Earliest accepted date: {start}. Latest accepted date: {end}.",
    relative_summary_earlier_than: "Latest accepted date: {bound}.",
    relative_summary_later_than: "Earliest accepted date: {bound}.",
    relative_summary_not_between: "First rejected date: {start}. Last rejected date: {end}.",
    relative_summary_working_days_note: "Working days skip Saturdays and Sundays.",
  };
  const calls: [string, Record<string, string | number> | undefined][] = [];
  const t = (key: string, options?: Record<string, string | number>) => {
    const short = key.replace("workspace.surveys.edit.validation.", "");
    const template = strings[short];
    if (!template) throw new Error(`missing key ${key}`);
    calls.push([short, options]);
    return template.replaceAll(/\{(\w+)\}/g, (_, name: string) => String(options?.[name]));
  };

  test("returns null for fixed dates and non-date rules", () => {
    expect(describeRelativeDateRule("isLaterThan", { date: "2026-03-01" }, t)).toBeNull();
    expect(describeRelativeDateRule("minLength", { min: 3 }, t)).toBeNull();
  });

  test("reads a single bound as an inclusive edge counted from submission", () => {
    expect(
      describeRelativeDateRule(
        "isLaterThan",
        { relative: { amount: 3, unit: "calendarDays", direction: "before" } },
        t
      )
    ).toBe("Earliest accepted date: 3 calendar days before submission.");
    expect(
      describeRelativeDateRule(
        "isEarlierThan",
        { relative: { amount: 2, unit: "calendarDays", direction: "after" } },
        t
      )
    ).toBe("Latest accepted date: 2 calendar days after submission.");
  });

  test("hands the amount to one whole-phrase key as its ICU count, never as a nested fragment", () => {
    calls.length = 0;
    describeRelativeDateRule(
      "isLaterThan",
      { relative: { amount: 1, unit: "calendarDays", direction: "before" } },
      t
    );

    expect(calls).toEqual([
      ["relative_bound_calendar_days_before", { count: 1 }],
      ["relative_summary_later_than", { bound: "1 calendar days before submission" }],
    ]);
  });

  test("names the submission day itself when the amount is 0", () => {
    expect(
      describeRelativeDateRule(
        "isLaterThan",
        { relative: { amount: 0, unit: "workingDays", direction: "after" } },
        t
      )
    ).toBe("Earliest accepted date: the submission day.");
    expect(
      describeRelativeDateRule(
        "isEarlierThan",
        { relative: { amount: 0, unit: "calendarDays", direction: "before" } },
        t
      )
    ).toBe("Latest accepted date: the submission day.");
  });

  test("describes both bounds of a range and adds the working-day note only when it applies", () => {
    expect(
      describeRelativeDateRule(
        "isBetween",
        {
          relativeStart: { amount: 0, unit: "calendarDays", direction: "before" },
          relativeEnd: { amount: 10, unit: "workingDays", direction: "after" },
        },
        t
      )
    ).toBe(
      "Earliest accepted date: the submission day. Latest accepted date: 10 working days after submission. Working days skip Saturdays and Sundays."
    );
    expect(
      describeRelativeDateRule(
        "isNotBetween",
        {
          relativeStart: { amount: 2, unit: "calendarDays", direction: "before" },
          relativeEnd: { amount: 0, unit: "workingDays", direction: "after" },
        },
        t
      )
    ).toBe("First rejected date: 2 calendar days before submission. Last rejected date: the submission day.");
  });
});

describe("clampRelativeAmount", () => {
  test("keeps a whole number inside the schema's range", () => {
    expect(clampRelativeAmount("3")).toBe(3);
    expect(clampRelativeAmount("0")).toBe(0);
    expect(clampRelativeAmount(String(MAX_RELATIVE_DATE_AMOUNT))).toBe(MAX_RELATIVE_DATE_AMOUNT);
  });

  test("caps an amount the schema would reject", () => {
    expect(clampRelativeAmount("5000000")).toBe(MAX_RELATIVE_DATE_AMOUNT);
    expect(clampRelativeAmount(String(MAX_RELATIVE_DATE_AMOUNT + 1))).toBe(MAX_RELATIVE_DATE_AMOUNT);
  });

  test("floors a negative amount to zero", () => {
    expect(clampRelativeAmount("-7")).toBe(0);
  });

  test("truncates a fractional amount rather than rounding", () => {
    expect(clampRelativeAmount("2.9")).toBe(2);
  });

  test("reads an unparseable field as zero", () => {
    expect(clampRelativeAmount("")).toBe(0);
    expect(clampRelativeAmount("abc")).toBe(0);
    expect(clampRelativeAmount("Infinity")).toBe(0);
  });

  test("every clamped amount parses against ZRelativeDateBound", () => {
    for (const raw of ["-7", "", "abc", "2.9", "5000000", "3", String(MAX_RELATIVE_DATE_AMOUNT + 1)]) {
      const result = ZRelativeDateBound.safeParse({
        amount: clampRelativeAmount(raw),
        unit: "calendarDays",
        direction: "before",
      });
      expect(result.success, `raw input ${JSON.stringify(raw)} should clamp to a valid amount`).toBe(true);
    }
  });
});
