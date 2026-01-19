import { describe, expect, test } from "vitest";
import { TValidationRuleType } from "@formbricks/types/surveys/validation-rules";
import { RULE_TYPE_CONFIG } from "./validation-rules-config";

describe("RULE_TYPE_CONFIG", () => {
  test("should have config for all validation rule types", () => {
    const allRuleTypes: TValidationRuleType[] = [
      "minLength",
      "maxLength",
      "pattern",
      "email",
      "url",
      "phone",
      "minValue",
      "maxValue",
      "minSelections",
      "maxSelections",
    ];

    allRuleTypes.forEach((ruleType) => {
      expect(RULE_TYPE_CONFIG[ruleType]).toBeDefined();
      expect(RULE_TYPE_CONFIG[ruleType].labelKey).toBeDefined();
      expect(typeof RULE_TYPE_CONFIG[ruleType].labelKey).toBe("string");
      expect(typeof RULE_TYPE_CONFIG[ruleType].needsValue).toBe("boolean");
    });
  });

  describe("minLength rule", () => {
    test("should have correct config", () => {
      const config = RULE_TYPE_CONFIG.minLength;
      expect(config.labelKey).toBe("min_length");
      expect(config.needsValue).toBe(true);
      expect(config.valueType).toBe("number");
      expect(config.valuePlaceholder).toBe("100");
      expect(config.unitOptions).toEqual([{ value: "characters", labelKey: "characters" }]);
    });
  });

  describe("maxLength rule", () => {
    test("should have correct config", () => {
      const config = RULE_TYPE_CONFIG.maxLength;
      expect(config.labelKey).toBe("max_length");
      expect(config.needsValue).toBe(true);
      expect(config.valueType).toBe("number");
      expect(config.valuePlaceholder).toBe("500");
      expect(config.unitOptions).toEqual([{ value: "characters", labelKey: "characters" }]);
    });
  });

  describe("pattern rule", () => {
    test("should have correct config", () => {
      const config = RULE_TYPE_CONFIG.pattern;
      expect(config.labelKey).toBe("pattern");
      expect(config.needsValue).toBe(true);
      expect(config.valueType).toBe("text");
      expect(config.valuePlaceholder).toBe("^[A-Z].*");
      expect(config.unitOptions).toBeUndefined();
    });
  });

  describe("email rule", () => {
    test("should have correct config", () => {
      const config = RULE_TYPE_CONFIG.email;
      expect(config.labelKey).toBe("email");
      expect(config.needsValue).toBe(false);
      expect(config.valueType).toBeUndefined();
      expect(config.valuePlaceholder).toBeUndefined();
      expect(config.unitOptions).toBeUndefined();
    });
  });

  describe("url rule", () => {
    test("should have correct config", () => {
      const config = RULE_TYPE_CONFIG.url;
      expect(config.labelKey).toBe("url");
      expect(config.needsValue).toBe(false);
      expect(config.valueType).toBeUndefined();
      expect(config.valuePlaceholder).toBeUndefined();
      expect(config.unitOptions).toBeUndefined();
    });
  });

  describe("phone rule", () => {
    test("should have correct config", () => {
      const config = RULE_TYPE_CONFIG.phone;
      expect(config.labelKey).toBe("phone");
      expect(config.needsValue).toBe(false);
      expect(config.valueType).toBeUndefined();
      expect(config.valuePlaceholder).toBeUndefined();
      expect(config.unitOptions).toBeUndefined();
    });
  });

  describe("minValue rule", () => {
    test("should have correct config", () => {
      const config = RULE_TYPE_CONFIG.minValue;
      expect(config.labelKey).toBe("min_value");
      expect(config.needsValue).toBe(true);
      expect(config.valueType).toBe("number");
      expect(config.valuePlaceholder).toBe("0");
      expect(config.unitOptions).toBeUndefined();
    });
  });

  describe("maxValue rule", () => {
    test("should have correct config", () => {
      const config = RULE_TYPE_CONFIG.maxValue;
      expect(config.labelKey).toBe("max_value");
      expect(config.needsValue).toBe(true);
      expect(config.valueType).toBe("number");
      expect(config.valuePlaceholder).toBe("100");
      expect(config.unitOptions).toBeUndefined();
    });
  });

  describe("minSelections rule", () => {
    test("should have correct config", () => {
      const config = RULE_TYPE_CONFIG.minSelections;
      expect(config.labelKey).toBe("min_selections");
      expect(config.needsValue).toBe(true);
      expect(config.valueType).toBe("number");
      expect(config.valuePlaceholder).toBe("1");
      expect(config.unitOptions).toEqual([{ value: "options", labelKey: "options_selected" }]);
    });
  });

  describe("maxSelections rule", () => {
    test("should have correct config", () => {
      const config = RULE_TYPE_CONFIG.maxSelections;
      expect(config.labelKey).toBe("max_selections");
      expect(config.needsValue).toBe(true);
      expect(config.valueType).toBe("number");
      expect(config.valuePlaceholder).toBe("3");
      expect(config.unitOptions).toEqual([{ value: "options", labelKey: "options_selected" }]);
    });
  });

  describe("valueType validation", () => {
    test("should have valueType 'number' for numeric rules", () => {
      expect(RULE_TYPE_CONFIG.minLength.valueType).toBe("number");
      expect(RULE_TYPE_CONFIG.maxLength.valueType).toBe("number");
      expect(RULE_TYPE_CONFIG.minValue.valueType).toBe("number");
      expect(RULE_TYPE_CONFIG.maxValue.valueType).toBe("number");
      expect(RULE_TYPE_CONFIG.minSelections.valueType).toBe("number");
      expect(RULE_TYPE_CONFIG.maxSelections.valueType).toBe("number");
    });

    test("should have valueType 'text' for text rules", () => {
      expect(RULE_TYPE_CONFIG.pattern.valueType).toBe("text");
    });

    test("should not have valueType for rules that don't need values", () => {
      expect(RULE_TYPE_CONFIG.email.valueType).toBeUndefined();
      expect(RULE_TYPE_CONFIG.url.valueType).toBeUndefined();
      expect(RULE_TYPE_CONFIG.phone.valueType).toBeUndefined();
    });
  });

  describe("unitOptions validation", () => {
    test("should have unitOptions for length and selection rules", () => {
      expect(RULE_TYPE_CONFIG.minLength.unitOptions).toBeDefined();
      expect(RULE_TYPE_CONFIG.maxLength.unitOptions).toBeDefined();
      expect(RULE_TYPE_CONFIG.minSelections.unitOptions).toBeDefined();
      expect(RULE_TYPE_CONFIG.maxSelections.unitOptions).toBeDefined();
    });

    test("should not have unitOptions for other rules", () => {
      expect(RULE_TYPE_CONFIG.pattern.unitOptions).toBeUndefined();
      expect(RULE_TYPE_CONFIG.email.unitOptions).toBeUndefined();
      expect(RULE_TYPE_CONFIG.url.unitOptions).toBeUndefined();
      expect(RULE_TYPE_CONFIG.phone.unitOptions).toBeUndefined();
      expect(RULE_TYPE_CONFIG.minValue.unitOptions).toBeUndefined();
      expect(RULE_TYPE_CONFIG.maxValue.unitOptions).toBeUndefined();
    });
  });
});
