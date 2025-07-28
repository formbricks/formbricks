import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TActionClassInput } from "@formbricks/types/action-classes";
import {
  validateActionData,
  validateActionKeys,
  validateActionNames,
  validateCssSelector,
  validatePermissions,
  validateRegexPatterns,
} from "./action-validation";

// Mock CSS selector validation
vi.mock("@/app/lib/actionClass/actionClass", () => ({
  isValidCssSelector: vi.fn(() => true),
}));

// Mock translation function
const mockT = vi.fn((key: string, params?: any) => {
  const translations: Record<string, string> = {
    "common.you_are_not_authorised_to_perform_this_action": "You are not authorized",
    "environments.actions.action_with_name_already_exists": "Action with name {{name}} already exists",
    "environments.actions.action_with_key_already_exists": "Action with key {{key}} already exists.",
    "environments.actions.invalid_css_selector": "Invalid CSS Selector",
    "environments.actions.invalid_regex": "Invalid regex pattern",
  };
  let translation = translations[key] || key;
  if (params) {
    Object.keys(params).forEach((param) => {
      translation = translation.replace(`{{${param}}}`, params[param]);
    });
  }
  return translation;
});

describe("Action Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validatePermissions", () => {
    test("throws error when user is readonly", () => {
      expect(() => validatePermissions(true, mockT)).toThrow("You are not authorized");
    });

    test("passes when user is not readonly", () => {
      expect(() => validatePermissions(false, mockT)).not.toThrow();
    });
  });

  describe("validateActionNames", () => {
    test("throws error for duplicate action names", () => {
      const data: TActionClassInput = {
        name: "Existing Action",
        description: "",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: undefined, innerHtml: undefined },
          urlFilters: [],
        },
      };
      const existingNames = ["Existing Action", "Another Action"];

      expect(() => validateActionNames(data, existingNames, mockT)).toThrow(
        "Action with name Existing Action already exists"
      );
    });

    test("passes for unique action names", () => {
      const data: TActionClassInput = {
        name: "New Action",
        description: "",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: undefined, innerHtml: undefined },
          urlFilters: [],
        },
      };
      const existingNames = ["Existing Action", "Another Action"];

      expect(() => validateActionNames(data, existingNames, mockT)).not.toThrow();
    });
  });

  describe("validateActionKeys", () => {
    test("throws error for duplicate code action keys", () => {
      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "code",
        key: "existing-key",
      };
      const existingKeys = ["existing-key", "another-key"];

      expect(() => validateActionKeys(data, existingKeys, mockT)).toThrow(
        "Action with key existing-key already exists."
      );
    });

    test("passes for unique code action keys", () => {
      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "code",
        key: "new-key",
      };
      const existingKeys = ["existing-key", "another-key"];

      expect(() => validateActionKeys(data, existingKeys, mockT)).not.toThrow();
    });

    test("passes for noCode actions (no key validation)", () => {
      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: undefined, innerHtml: undefined },
          urlFilters: [],
        },
      };
      const existingKeys = ["existing-key"];

      expect(() => validateActionKeys(data, existingKeys, mockT)).not.toThrow();
    });
  });

  describe("validateCssSelector", () => {
    test("throws error for invalid CSS selector", async () => {
      const cssModule = (await vi.importMock("@/app/lib/actionClass/actionClass")) as any;
      cssModule.isValidCssSelector.mockReturnValue(false);

      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: "invalid[selector", innerHtml: undefined },
          urlFilters: [],
        },
      };

      expect(() => validateCssSelector(data, mockT)).toThrow("Invalid CSS Selector");
    });

    test("passes for valid CSS selector", async () => {
      const cssModule = (await vi.importMock("@/app/lib/actionClass/actionClass")) as any;
      cssModule.isValidCssSelector.mockReturnValue(true);

      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: "button.valid", innerHtml: undefined },
          urlFilters: [],
        },
      };

      expect(() => validateCssSelector(data, mockT)).not.toThrow();
    });

    test("passes for pageView actions (no CSS selector)", () => {
      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "pageView",
          urlFilters: [],
        },
      };

      expect(() => validateCssSelector(data, mockT)).not.toThrow();
    });

    test("passes for code actions (no CSS selector)", () => {
      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "code",
        key: "test-key",
      };

      expect(() => validateCssSelector(data, mockT)).not.toThrow();
    });
  });

  describe("validateRegexPatterns", () => {
    test("throws error for invalid regex patterns", () => {
      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: undefined, innerHtml: undefined },
          urlFilters: [{ value: "[invalid-regex", rule: "matchesRegex" }],
        },
      };

      expect(() => validateRegexPatterns(data, mockT)).toThrow("Invalid regex pattern");
    });

    test("passes for valid regex patterns", () => {
      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: undefined, innerHtml: undefined },
          urlFilters: [{ value: ".*\\.example\\.com", rule: "matchesRegex" }],
        },
      };

      expect(() => validateRegexPatterns(data, mockT)).not.toThrow();
    });

    test("passes for non-regex URL filters", () => {
      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: undefined, innerHtml: undefined },
          urlFilters: [{ value: "https://example.com", rule: "exactMatch" }],
        },
      };

      expect(() => validateRegexPatterns(data, mockT)).not.toThrow();
    });

    test("passes for code actions (no URL filters)", () => {
      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "code",
        key: "test-key",
      };

      expect(() => validateRegexPatterns(data, mockT)).not.toThrow();
    });
  });

  describe("validateActionData", () => {
    test("runs all validations in sequence", () => {
      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "pageView",
          urlFilters: [],
        },
      };

      // Should not throw for valid data
      expect(() => validateActionData(data, false, [], [], mockT)).not.toThrow();
    });

    test("throws on first validation failure", () => {
      const data: TActionClassInput = {
        name: "Test Action",
        description: "",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "pageView",
          urlFilters: [],
        },
      };

      // Should throw for readonly user
      expect(() => validateActionData(data, true, [], [], mockT)).toThrow();
    });
  });
});
