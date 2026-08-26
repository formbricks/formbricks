import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import type {
  TSurveyElement,
  TSurveyMultipleChoiceElement,
  TSurveyRankingElement,
} from "@formbricks/types/surveys/elements";
import type { TValidationRule } from "@formbricks/types/surveys/validation-rules";
import { RULE_TYPE_CONFIG } from "./validation-rules-config";
import {
  applyRuleDeletion,
  getAddressFields,
  getContactInfoFields,
  getDefaultRuleValue,
  getRuleLabels,
  normalizeFileExtension,
  parseRuleValue,
  shouldResetInputTypeToText,
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
    expect(fields[0].label).toBe("workspace.surveys.edit.address_line_1");
  });
});

describe("getContactInfoFields", () => {
  test("should return all contact info fields with correct labels", () => {
    const fields = getContactInfoFields(mockT);
    expect(fields).toHaveLength(5);
    expect(fields.map((f) => f.value)).toEqual(["firstName", "lastName", "email", "phone", "company"]);
    expect(fields[0].label).toBe("workspace.surveys.edit.first_name");
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
    expect(labels.min_length).toBe("workspace.surveys.edit.validation.min_length");
    expect(labels.email).toBe("workspace.surveys.edit.validation.email");
    expect(labels.rank_all_options).toBe("workspace.surveys.edit.validation.rank_all_options");
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
    } as unknown as TSurveyMultipleChoiceElement;

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
    } as unknown as TSurveyMultipleChoiceElement;

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
    } as unknown as TSurveyMultipleChoiceElement;

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
    } as unknown as TSurveyRankingElement;

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

  // Scientific notation reaches the field by paste (onKeyDown only blocks typing), and `Number()`
  // reads "1e5" as 100000 — a value the user never entered and cannot read back from the input.
  describe("number value type rejects scientific notation", () => {
    const config = RULE_TYPE_CONFIG.isGreaterThan;

    test.each([
      ["1e5", 0],
      ["1E5", 0],
      ["e", 0],
      ["-1e5", 0],
      ["1e-5", 0],
      ["0x10", 0],
      ["Infinity", 0],
    ])("parses %j as %i", (input, expected) => {
      expect(parseRuleValue("isGreaterThan", input, config)).toBe(expected);
    });

    test.each([
      ["10", 10],
      ["2.5", 2.5],
      [".5", 0.5],
      // minValue/maxValue/isGreaterThan/isLessThan are bare z.number(), so a negative threshold
      // is legitimate and must survive the guard.
      ["-3", -3],
      ["-2.5", -2.5],
      [" 7 ", 7],
    ])("still parses %j as %d", (input, expected) => {
      expect(parseRuleValue("isGreaterThan", input, config)).toBe(expected);
    });
  });
});

// The editor derives "validation is on" from the rule count, so every path that empties the list
// must reset inputType — otherwise the section reads as off while the element still carries
// inputType: "number" | "email" | "url" | "phone", the Long answer toggle stays disabled, and the
// rendered input keeps enforcing browser-native format validation for respondents.
describe("shouldResetInputTypeToText", () => {
  test.each(["number", "email", "url", "phone"] as const)(
    "resets when the last rule is removed from an OpenText element with inputType %s",
    (inputType) => {
      expect(shouldResetInputTypeToText(TSurveyElementTypeEnum.OpenText, 0, inputType)).toBe(true);
    }
  );

  test.each([1, 2, 5])("leaves inputType alone while %i rule(s) remain", (remaining) => {
    expect(shouldResetInputTypeToText(TSurveyElementTypeEnum.OpenText, remaining, "number")).toBe(false);
  });

  test("is a no-op when inputType is already text", () => {
    expect(shouldResetInputTypeToText(TSurveyElementTypeEnum.OpenText, 0, "text")).toBe(false);
  });

  test("is a no-op when the element has no inputType", () => {
    expect(shouldResetInputTypeToText(TSurveyElementTypeEnum.OpenText, 0, undefined)).toBe(false);
  });

  test.each([TSurveyElementTypeEnum.Address, TSurveyElementTypeEnum.ContactInfo] as const)(
    "does not apply to %s elements, which have no inputType to reset",
    (elementType) => {
      expect(shouldResetInputTypeToText(elementType, 0, "number")).toBe(false);
    }
  );
});

describe("applyRuleDeletion", () => {
  const rule = (id: string): TValidationRule =>
    ({ id, type: "minLength", params: { min: 1 } }) as TValidationRule;

  test("removes only the named rule", () => {
    const result = applyRuleDeletion(
      [rule("a"), rule("b"), rule("c")],
      "b",
      TSurveyElementTypeEnum.OpenText,
      "number"
    );
    expect(result.rules.map((r) => r.id)).toEqual(["a", "c"]);
  });

  test("deleting the last rule asks the caller to reset inputType", () => {
    const result = applyRuleDeletion([rule("a")], "a", TSurveyElementTypeEnum.OpenText, "number");
    expect(result.rules).toEqual([]);
    expect(result.resetInputTypeToText).toBe(true);
  });

  test("deleting one of several rules leaves inputType alone", () => {
    const result = applyRuleDeletion([rule("a"), rule("b")], "a", TSurveyElementTypeEnum.OpenText, "number");
    expect(result.rules.map((r) => r.id)).toEqual(["b"]);
    expect(result.resetInputTypeToText).toBe(false);
  });

  test.each(["email", "url", "phone"] as const)(
    "asks for the reset on inputType %s too, not just number",
    (inputType) => {
      expect(
        applyRuleDeletion([rule("a")], "a", TSurveyElementTypeEnum.OpenText, inputType).resetInputTypeToText
      ).toBe(true);
    }
  );

  test("does not ask for a reset when inputType is already text", () => {
    expect(
      applyRuleDeletion([rule("a")], "a", TSurveyElementTypeEnum.OpenText, "text").resetInputTypeToText
    ).toBe(false);
  });

  test("deleting an id that is not present is a no-op", () => {
    const rules = [rule("a"), rule("b")];
    const result = applyRuleDeletion(rules, "missing", TSurveyElementTypeEnum.OpenText, "number");
    expect(result.rules.map((r) => r.id)).toEqual(["a", "b"]);
    expect(result.resetInputTypeToText).toBe(false);
  });

  test("does not mutate the rules it was given", () => {
    const rules = [rule("a"), rule("b")];
    applyRuleDeletion(rules, "a", TSurveyElementTypeEnum.OpenText, "number");
    expect(rules.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
