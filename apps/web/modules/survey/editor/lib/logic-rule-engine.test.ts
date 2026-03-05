import { TFunction } from "i18next";
import { describe, expect, test, vi } from "vitest";
import { ZSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";
import { TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TLogicRuleOption, getLogicRules } from "./logic-rule-engine";

// Mock the translation function
const mockT = vi.fn((key: string) => `mockTranslate(${key})`);
const logicRules = getLogicRules(mockT as unknown as TFunction);

describe("getLogicRules", () => {
  test("should return correct structure for question rules", () => {
    expect(logicRules).toHaveProperty("element");
    expect(logicRules.element).toBeInstanceOf(Object);
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
      const openTextTextRules = logicRules.element[TSurveyQuestionTypeEnum.OpenText + ".text"];
      expect(openTextTextRules).toBeDefined();
      expect(openTextTextRules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.contains)",
          value: ZSurveyLogicConditionsOperator.enum.contains,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_contain)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotContain,
        },
        {
          label: "mockTranslate(environments.surveys.edit.starts_with)",
          value: ZSurveyLogicConditionsOperator.enum.startsWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_start_with)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotStartWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.ends_with)",
          value: ZSurveyLogicConditionsOperator.enum.endsWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_end_with)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotEndWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("OpenText.number", () => {
      const openTextNumberRules = logicRules.element[TSurveyQuestionTypeEnum.OpenText + ".number"];
      expect(openTextNumberRules).toBeDefined();
      expect(openTextNumberRules.options).toEqual([
        { label: "=", value: ZSurveyLogicConditionsOperator.enum.equals },
        { label: "!=", value: ZSurveyLogicConditionsOperator.enum.doesNotEqual },
        { label: ">", value: ZSurveyLogicConditionsOperator.enum.isGreaterThan },
        { label: "<", value: ZSurveyLogicConditionsOperator.enum.isLessThan },
        { label: ">=", value: ZSurveyLogicConditionsOperator.enum.isGreaterThanOrEqual },
        { label: "<=", value: ZSurveyLogicConditionsOperator.enum.isLessThanOrEqual },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("MultipleChoiceSingle", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.MultipleChoiceSingle];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.equals_one_of)",
          value: ZSurveyLogicConditionsOperator.enum.equalsOneOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("MultipleChoiceMulti", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.MultipleChoiceMulti];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_include_one_of)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotIncludeOneOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_include_all_of)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotIncludeAllOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.includes_all_of)",
          value: ZSurveyLogicConditionsOperator.enum.includesAllOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.includes_one_of)",
          value: ZSurveyLogicConditionsOperator.enum.includesOneOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("PictureSelection", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.PictureSelection];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_include_one_of)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotIncludeOneOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_include_all_of)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotIncludeAllOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.includes_all_of)",
          value: ZSurveyLogicConditionsOperator.enum.includesAllOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.includes_one_of)",
          value: ZSurveyLogicConditionsOperator.enum.includesOneOf,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("Rating", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.Rating];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        { label: "=", value: ZSurveyLogicConditionsOperator.enum.equals },
        { label: "!=", value: ZSurveyLogicConditionsOperator.enum.doesNotEqual },
        { label: ">", value: ZSurveyLogicConditionsOperator.enum.isGreaterThan },
        { label: "<", value: ZSurveyLogicConditionsOperator.enum.isLessThan },
        { label: ">=", value: ZSurveyLogicConditionsOperator.enum.isGreaterThanOrEqual },
        { label: "<=", value: ZSurveyLogicConditionsOperator.enum.isLessThanOrEqual },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("NPS", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.NPS];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        { label: "=", value: ZSurveyLogicConditionsOperator.enum.equals },
        { label: "!=", value: ZSurveyLogicConditionsOperator.enum.doesNotEqual },
        { label: ">", value: ZSurveyLogicConditionsOperator.enum.isGreaterThan },
        { label: "<", value: ZSurveyLogicConditionsOperator.enum.isLessThan },
        { label: ">=", value: ZSurveyLogicConditionsOperator.enum.isGreaterThanOrEqual },
        { label: "<=", value: ZSurveyLogicConditionsOperator.enum.isLessThanOrEqual },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("CTA", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.CTA];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_clicked)",
          value: ZSurveyLogicConditionsOperator.enum.isClicked,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_not_clicked)",
          value: ZSurveyLogicConditionsOperator.enum.isNotClicked,
        },
      ]);
    });

    test("Consent", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.Consent];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_accepted)",
          value: ZSurveyLogicConditionsOperator.enum.isAccepted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("Date", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.Date];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_before)",
          value: ZSurveyLogicConditionsOperator.enum.isBefore,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_after)",
          value: ZSurveyLogicConditionsOperator.enum.isAfter,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("FileUpload", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.FileUpload];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("Ranking", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.Ranking];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("Cal", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.Cal];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_booked)",
          value: ZSurveyLogicConditionsOperator.enum.isBooked,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("Matrix", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.Matrix];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_partially_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isPartiallySubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_completely_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isCompletelySubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("Matrix.row", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.Matrix + ".row"];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.equals)",
          value: ZSurveyLogicConditionsOperator.enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_empty)",
          value: ZSurveyLogicConditionsOperator.enum.isEmpty,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_not_empty)",
          value: ZSurveyLogicConditionsOperator.enum.isNotEmpty,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_any_of)",
          value: ZSurveyLogicConditionsOperator.enum.isAnyOf,
        },
      ]);
    });

    test("Address", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.Address];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
        },
      ]);
    });

    test("ContactInfo", () => {
      const rules = logicRules.element[TSurveyQuestionTypeEnum.ContactInfo];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        {
          label: "mockTranslate(environments.surveys.edit.is_submitted)",
          value: ZSurveyLogicConditionsOperator.enum.isSubmitted,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_skipped)",
          value: ZSurveyLogicConditionsOperator.enum.isSkipped,
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
          value: ZSurveyLogicConditionsOperator.enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.contains)",
          value: ZSurveyLogicConditionsOperator.enum.contains,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_contain)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotContain,
        },
        {
          label: "mockTranslate(environments.surveys.edit.starts_with)",
          value: ZSurveyLogicConditionsOperator.enum.startsWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_start_with)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotStartWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.ends_with)",
          value: ZSurveyLogicConditionsOperator.enum.endsWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_end_with)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotEndWith,
        },
      ]);
    });

    test("variable.number", () => {
      const rules = logicRules["variable.number"];
      expect(rules).toBeDefined();
      expect(rules.options).toEqual([
        { label: "=", value: ZSurveyLogicConditionsOperator.enum.equals },
        { label: "!=", value: ZSurveyLogicConditionsOperator.enum.doesNotEqual },
        { label: ">", value: ZSurveyLogicConditionsOperator.enum.isGreaterThan },
        { label: "<", value: ZSurveyLogicConditionsOperator.enum.isLessThan },
        { label: ">=", value: ZSurveyLogicConditionsOperator.enum.isGreaterThanOrEqual },
        { label: "<=", value: ZSurveyLogicConditionsOperator.enum.isLessThanOrEqual },
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
          value: ZSurveyLogicConditionsOperator.enum.equals,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_equal)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotEqual,
        },
        {
          label: "mockTranslate(environments.surveys.edit.contains)",
          value: ZSurveyLogicConditionsOperator.enum.contains,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_contain)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotContain,
        },
        {
          label: "mockTranslate(environments.surveys.edit.starts_with)",
          value: ZSurveyLogicConditionsOperator.enum.startsWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_start_with)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotStartWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.ends_with)",
          value: ZSurveyLogicConditionsOperator.enum.endsWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.does_not_end_with)",
          value: ZSurveyLogicConditionsOperator.enum.doesNotEndWith,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_set)",
          value: ZSurveyLogicConditionsOperator.enum.isSet,
        },
        {
          label: "mockTranslate(environments.surveys.edit.is_not_set)",
          value: ZSurveyLogicConditionsOperator.enum.isNotSet,
        },
      ]);
    });
  });
});

describe("TLogicRuleOption type", () => {
  test("should be compatible with the options structure", () => {
    const sampleOption: TLogicRuleOption[number] = {
      label: "Test Label",
      value: ZSurveyLogicConditionsOperator.enum.equals,
    };
    // This test mainly serves as a type check during compilation
    expect(sampleOption.label).toBe("Test Label");
    expect(sampleOption.value).toBe(ZSurveyLogicConditionsOperator.enum.equals);
  });
});
