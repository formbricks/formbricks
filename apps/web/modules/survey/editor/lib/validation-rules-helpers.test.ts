import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type {
  TSurveyElement,
  TSurveyMultipleChoiceElement,
  TSurveyRankingElement,
} from "@formbricks/types/surveys/elements";
import { RULE_TYPE_CONFIG } from "./validation-rules-config";
import {
  getAddressFields,
  getContactInfoFields,
  getDefaultRuleValue,
  getRuleLabels,
  normalizeFileExtension,
  parseRuleValue,
} from "./validation-rules-helpers";

// Mock translation function
const mockT = (key: string): string => key;

describe("getAddressFields", () => {
  test("should return all address fields with correct labels", () => {
    const fields = getAddressFields(mockT);
    expect(fields).toHaveLength(6);
    expect(fields.map((f) => f.value)).toEqual([
      "addressLine1",
      "addressLine2",
      "city",
      "state",
      "zip",
      "country",
    ]);
    expect(fields[0].label).toBe("environments.surveys.edit.address_line_1");
  });
});

describe("getContactInfoFields", () => {
  test("should return all contact info fields with correct labels", () => {
    const fields = getContactInfoFields(mockT);
    expect(fields).toHaveLength(5);
    expect(fields.map((f) => f.value)).toEqual(["firstName", "lastName", "email", "phone", "company"]);
    expect(fields[0].label).toBe("environments.surveys.edit.first_name");
  });
});

describe("getRuleLabels", () => {
  test("should return all rule labels", () => {
    const labels = getRuleLabels(mockT);
    expect(labels).toHaveProperty("min_length");
    expect(labels).toHaveProperty("max_length");
    expect(labels).toHaveProperty("pattern");
    expect(labels).toHaveProperty("email");
    expect(labels).toHaveProperty("url");
    expect(labels).toHaveProperty("phone");
    expect(labels).toHaveProperty("min_value");
    expect(labels).toHaveProperty("max_value");
    expect(labels).toHaveProperty("min_selections");
    expect(labels).toHaveProperty("max_selections");
    expect(labels).toHaveProperty("characters");
    expect(labels).toHaveProperty("options_selected");
    expect(labels).toHaveProperty("is");
    expect(labels).toHaveProperty("is_not");
    expect(labels).toHaveProperty("contains");
    expect(labels).toHaveProperty("does_not_contain");
    expect(labels).toHaveProperty("is_greater_than");
    expect(labels).toHaveProperty("is_less_than");
    expect(labels).toHaveProperty("is_later_than");
    expect(labels).toHaveProperty("is_earlier_than");
    expect(labels).toHaveProperty("is_between");
    expect(labels).toHaveProperty("is_not_between");
    expect(labels).toHaveProperty("minimum_options_ranked");
    expect(labels).toHaveProperty("rank_all_options");
    expect(labels).toHaveProperty("minimum_rows_answered");
    expect(labels).toHaveProperty("file_extension_is");
    expect(labels).toHaveProperty("file_extension_is_not");
    expect(labels).toHaveProperty("kb");
    expect(labels).toHaveProperty("mb");
  });

  test("should return correct translation keys", () => {
    const labels = getRuleLabels(mockT);
    expect(labels.min_length).toBe("environments.surveys.edit.validation.min_length");
    expect(labels.email).toBe("environments.surveys.edit.validation.email");
    expect(labels.rank_all_options).toBe("environments.surveys.edit.validation.rank_all_options");
  });
});

describe("getDefaultRuleValue", () => {
  test("should return undefined when config does not need value", () => {
    const config = RULE_TYPE_CONFIG.email;
    const value = getDefaultRuleValue(config);
    expect(value).toBeUndefined();
  });

  test("should return empty string for text value type", () => {
    const config = RULE_TYPE_CONFIG.pattern;
    const value = getDefaultRuleValue(config);
    expect(value).toBe("");
  });

  test("should return empty string for equals rule (has valueType: text, not option)", () => {
    const element: TSurveyElement = {
      id: "multi1",
      type: TSurveyElementTypeEnum.MultipleChoiceSingle,
      choices: [
        { id: "opt1", label: { default: "Option 1" } },
        { id: "opt2", label: { default: "Option 2" } },
        { id: "other", label: { default: "Other" } },
      ],
    } as TSurveyMultipleChoiceElement;

    const config = RULE_TYPE_CONFIG.equals;
    const value = getDefaultRuleValue(config, element);
    // equals has valueType: "text", not "option", so it returns "" (empty string for text type)
    expect(value).toBe("");
  });

  test("should return empty string when config valueType is text (not option)", () => {
    const element: TSurveyElement = {
      id: "multi1",
      type: TSurveyElementTypeEnum.MultipleChoiceSingle,
      choices: [
        { id: "other", label: { default: "Other" } },
        { id: "none", label: { default: "None" } },
        { id: "opt1", label: { default: "Option 1" } },
      ],
    } as TSurveyMultipleChoiceElement;

    const config = RULE_TYPE_CONFIG.equals;
    const value = getDefaultRuleValue(config, element);
    // equals has valueType: "text", so it returns "" regardless of element choices
    expect(value).toBe("");
  });

  test("should return empty string when no valid choices found for option value type", () => {
    const element: TSurveyElement = {
      id: "multi1",
      type: TSurveyElementTypeEnum.MultipleChoiceSingle,
      choices: [
        { id: "other", label: { default: "Other" } },
        { id: "none", label: { default: "None" } },
      ],
    } as TSurveyMultipleChoiceElement;

    const config = RULE_TYPE_CONFIG.equals;
    const value = getDefaultRuleValue(config, element);
    expect(value).toBe("");
  });

  test("should return empty string for option value type when element is not provided", () => {
    const config = RULE_TYPE_CONFIG.equals;
    const value = getDefaultRuleValue(config);
    expect(value).toBe("");
  });

  test("should return undefined for number value type (minRanked uses number, not ranking)", () => {
    const element: TSurveyElement = {
      id: "rank1",
      type: TSurveyElementTypeEnum.Ranking,
      choices: [
        { id: "opt1", label: { default: "Option 1" } },
        { id: "opt2", label: { default: "Option 2" } },
      ],
    } as TSurveyRankingElement;

    const config = RULE_TYPE_CONFIG.minRanked;
    const value = getDefaultRuleValue(config, element);
    // minRanked has valueType: "number", not "ranking", so it returns undefined
    expect(value).toBeUndefined();
  });

  test("should return undefined for number value type when element is not provided", () => {
    const config = RULE_TYPE_CONFIG.minRanked;
    const value = getDefaultRuleValue(config);
    expect(value).toBeUndefined();
  });
});

describe("normalizeFileExtension", () => {
  test("should add dot prefix when missing", () => {
    expect(normalizeFileExtension("pdf")).toBe(".pdf");
    expect(normalizeFileExtension("jpg")).toBe(".jpg");
  });

  test("should not add dot prefix when already present", () => {
    expect(normalizeFileExtension(".pdf")).toBe(".pdf");
    expect(normalizeFileExtension(".jpg")).toBe(".jpg");
  });

  test("should handle empty string", () => {
    expect(normalizeFileExtension("")).toBe(".");
  });
});

describe("parseRuleValue", () => {
  test("should normalize file extension for fileExtensionIs", () => {
    const config = RULE_TYPE_CONFIG.fileExtensionIs;
    const value = parseRuleValue("fileExtensionIs", "pdf", config);
    expect(value).toBe(".pdf");
  });

  test("should normalize file extension for fileExtensionIsNot", () => {
    const config = RULE_TYPE_CONFIG.fileExtensionIsNot;
    const value = parseRuleValue("fileExtensionIsNot", "jpg", config);
    expect(value).toBe(".jpg");
  });

  test("should not add dot if already present for file extension", () => {
    const config = RULE_TYPE_CONFIG.fileExtensionIs;
    const value = parseRuleValue("fileExtensionIs", ".pdf", config);
    expect(value).toBe(".pdf");
  });

  test("should parse number for number value type", () => {
    const config = RULE_TYPE_CONFIG.minLength;
    const value = parseRuleValue("minLength", "10", config);
    expect(value).toBe(10);
  });

  test("should return 0 for invalid number string", () => {
    const config = RULE_TYPE_CONFIG.minLength;
    const value = parseRuleValue("minLength", "invalid", config);
    expect(value).toBe(0);
  });

  test("should return string as-is for text value type", () => {
    const config = RULE_TYPE_CONFIG.pattern;
    const value = parseRuleValue("pattern", "test-pattern", config);
    expect(value).toBe("test-pattern");
  });

  test("should return string as-is for equals rule", () => {
    const config = RULE_TYPE_CONFIG.equals;
    const value = parseRuleValue("equals", "test-value", config);
    expect(value).toBe("test-value");
  });
});
