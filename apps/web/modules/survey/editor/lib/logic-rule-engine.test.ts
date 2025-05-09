import { TFnType } from "@tolgee/react";
import { describe, expect, test, vi } from "vitest";
import { TSurveyQuestionTypeEnum, ZSurveyLogicConditionsOperator } from "@formbricks/types/surveys/types";
import { TLogicRuleOption, getLogicRules } from "./logic-rule-engine";

// Mock the translation function
const mockT = vi.fn((key: string) => `mockTranslate(${key})`);
const logicRules = getLogicRules(mockT as unknown as TFnType);

describe("getLogicRules", () => {
  test("should return correct structure for question rules", () => {
    expect(logicRules).toHaveProperty("question");
    expect(logicRules.question).toBeInstanceOf(Object);
  });

  test("should return correct structure for variable rules", () => {
    expect(logicRules).toHaveProperty("variable.text");
    expect(logicRules["variable.text"]).toBeInstanceOf(Object);
    expect(logicRules["variable.text"]).toHaveProperty("options");
    expect(Array.isArray(logicRules["variable.text"].options)).toBe(true);

    expect(logicRules).toHaveProperty("variable.number");
    expect(logicRules["variable.number"]).toBeInstanceOf(Object);
    expect(logicRules["variable.number"]).toHaveProperty("options");
    expect(Array.isArray(logicRules["variable.number"].options)).toBe(true);
  });

  test("should return correct structure for hiddenField rules", () => {
    expect(logicRules).toHaveProperty("hiddenField");
    expect(logicRules.hiddenField).toBeInstanceOf(Object);
    expect(logicRules.hiddenField).toHaveProperty("options");
    expect(Array.isArray(logicRules.hiddenField.options)).toBe(true);
  });

  describe("Question Specific Rules", () => {
    test("OpenText.text", () => {
      const openTextTextRules = logicRules.question[TSurveyQuestionTypeEnum.OpenText + ".text"];
      expect(openTextTextRules).toBeDefined();
      expect(openTextTextRules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.contains)",
          value: ZSurveyLogicConditionsOperator.Enum.contains,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_contain)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotContain,
        },
        {
          label: "mockTranslate(environments.surveys.edit.starts_with)",
          value: ZSurveyLogicConditionsOperator.Enum.startsWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_start_with)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotStartWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.ends_with)",
          value: ZSurveyLogicConditionsOperator.Enum.endsWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_end_with)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEndWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("OpenText.number", () => {
      const openTextNumberRules = logicRules.question[TSurveyQuestionTypeEnum.OpenText + ".number"];
      expect(openTextNumberRules).toBeDefined();
      expect(openTextNumberRules.options).toEqual([
        { label: "=", value: ZSurveyLogicConditionsOperator.Enum.equals },
        { label: "!=", value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual },
        { label: ">", value: ZSurveyLogicConditionsOperator.Enum.isGreaterThan },
        { label: "<", value: ZSurveyLogicConditionsOperator.Enum.isLessThan },
        { label: ">=", value: ZSurveyLogicConditionsOperator.Enum.isGreaterThanOrEqual },
        { label: "<=", value: ZSurveyLogicConditionsOperator.Enum.isLessThanOrEqual },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("MultipleChoiceSingle", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.MultipleChoiceSingle];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.equals_one_of)",
          value: ZSurveyLogicConditionsOperator.Enum.equalsOneOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("MultipleChoiceMulti", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.MultipleChoiceMulti];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_include_one_of)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotIncludeOneOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_include_all_of)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotIncludeAllOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.includes_all_of)",
          value: ZSurveyLogicConditionsOperator.Enum.includesAllOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.includes_one_of)",
          value: ZSurveyLogicConditionsOperator.Enum.includesOneOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("PictureSelection", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.PictureSelection];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_include_one_of)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotIncludeOneOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_include_all_of)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotIncludeAllOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.includes_all_of)",
          value: ZSurveyLogicConditionsOperator.Enum.includesAllOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.includes_one_of)",
          value: ZSurveyLogicConditionsOperator.Enum.includesOneOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("Rating", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.Rating];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        { label: "=", value: ZSurveyLogicConditionsOperator.Enum.equals },
        { label: "!=", value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual },
        { label: ">", value: ZSurveyLogicConditionsOperator.Enum.isGreaterThan },
        { label: "<", value: ZSurveyLogicConditionsOperator.Enum.isLessThan },
        { label: ">=", value: ZSurveyLogicConditionsOperator.Enum.isGreaterThanOrEqual },
        { label: "<=", value: ZSurveyLogicConditionsOperator.Enum.isLessThanOrEqual },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("NPS", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.NPS];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        { label: "=", value: ZSurveyLogicConditionsOperator.Enum.equals },
        { label: "!=", value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual },
        { label: ">", value: ZSurveyLogicConditionsOperator.Enum.isGreaterThan },
        { label: "<", value: ZSurveyLogicConditionsOperator.Enum.isLessThan },
        { label: ">=", value: ZSurveyLogicConditionsOperator.Enum.isGreaterThanOrEqual },
        { label: "<=", value: ZSurveyLogicConditionsOperator.Enum.isLessThanOrEqual },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("CTA", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.CTA];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_clicked)",
          value: ZSurveyLogicConditionsOperator.Enum.isClicked,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("Consent", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.Consent];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_accepted)",
          value: ZSurveyLogicConditionsOperator.Enum.isAccepted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("Date", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.Date];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_before)",
          value: ZSurveyLogicConditionsOperator.Enum.isBefore,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_after)",
          value: ZSurveyLogicConditionsOperator.Enum.isAfter,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("FileUpload", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.FileUpload];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("Ranking", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.Ranking];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("Cal", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.Cal];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_booked)",
          value: ZSurveyLogicConditionsOperator.Enum.isBooked,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("Matrix", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.Matrix];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_partially_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isPartiallySubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_completely_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isCompletelySubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("Matrix.row", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.Matrix + ".row"];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_empty)",
          value: ZSurveyLogicConditionsOperator.Enum.isEmpty,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_not_empty)",
          value: ZSurveyLogicConditionsOperator.Enum.isNotEmpty,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_any_of)",
          value: ZSurveyLogicConditionsOperator.Enum.isAnyOf,
        },
      ]);
    });

    test("Address", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.Address];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });

    test("ContactInfo", () => {
      const rules = logicRules.question[TSurveyQuestionTypeEnum.ContactInfo];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.Enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.Enum.isSkipped,
        },
      ]);
    });
  });

  describe("Variable Specific Rules", () => {
    test("variable.text", () => {
      const rules = logicRules["variable.text"];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.contains)",
          value: ZSurveyLogicConditionsOperator.Enum.contains,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_contain)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotContain,
        },
        {
          label: "mockTranslate(environments.surveys.edit.starts_with)",
          value: ZSurveyLogicConditionsOperator.Enum.startsWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_start_with)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotStartWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.ends_with)",
          value: ZSurveyLogicConditionsOperator.Enum.endsWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_end_with)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEndWith,
        },
      ]);
    });

    test("variable.number", () => {
      const rules = logicRules["variable.number"];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        { label: "=", value: ZSurveyLogicConditionsOperator.Enum.equals },
        { label: "!=", value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual },
        { label: ">", value: ZSurveyLogicConditionsOperator.Enum.isGreaterThan },
        { label: "<", value: ZSurveyLogicConditionsOperator.Enum.isLessThan },
        { label: ">=", value: ZSurveyLogicConditionsOperator.Enum.isGreaterThanOrEqual },
        { label: "<=", value: ZSurveyLogicConditionsOperator.Enum.isLessThanOrEqual },
      ]);
    });
  });

  describe("HiddenField Rules", () => {
    test("hiddenField", () => {
      const rules = logicRules.hiddenField;
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.Enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.contains)",
          value: ZSurveyLogicConditionsOperator.Enum.contains,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_contain)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotContain,
        },
        {
          label: "mockTranslate(environments.surveys.edit.starts_with)",
          value: ZSurveyLogicConditionsOperator.Enum.startsWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_start_with)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotStartWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.ends_with)",
          value: ZSurveyLogicConditionsOperator.Enum.endsWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_end_with)",
          value: ZSurveyLogicConditionsOperator.Enum.doesNotEndWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_set)",
          value: ZSurveyLogicConditionsOperator.Enum.isSet,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_not_set)",
          value: ZSurveyLogicConditionsOperator.Enum.isNotSet,
        },
      ]);
    });
  });
});

describe("TLogicRuleOption type", () => {
  test("should be compatible with the options structure", () => {
    const sampleOption: TLogicRuleOption[number] = {
      label: "Test Label",
      value: ZSurveyLogicConditionsOperator.Enum.equals,
    };
    // This test mainly serves as a type check during compilation
    expect(sampleOption.label).toBe("Test Label");
    expect(sampleOption.value).toBe(ZSurveyLogicConditionsOperator.Enum.equals);
  });
});
