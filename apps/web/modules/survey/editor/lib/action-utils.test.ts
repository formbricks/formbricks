/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { TActionClass } from "@formbricks/types/action-classes";
import {
  createActionClassZodResolver,
  useActionClassKeys,
  validateActionKeyUniqueness,
  validateActionNameUniqueness,
  validateCssSelector,
  validatePermissions,
  validateUrlFilterRegex,
} from "./action-utils";

// Mock the CSS selector validation function
vi.mock("@/app/lib/actionClass/actionClass", () => ({
  isValidCssSelector: vi.fn(),
}));

const { isValidCssSelector } = await import("@/app/lib/actionClass/actionClass");

// Mock translation function
const mockT = vi.fn((key: string, params?: any) => {
  if (key === "environments.actions.action_with_name_already_exists") {
    return `Action with name "${params?.name}" already exists`;
  }
  if (key === "environments.actions.action_with_key_already_exists") {
    return `Action with key "${params?.key}" already exists`;
  }
  if (key === "environments.actions.invalid_css_selector") {
    return "Invalid CSS selector";
  }
  if (key === "environments.actions.invalid_regex") {
    return "Invalid regex pattern";
  }
  if (key === "common.you_are_not_authorised_to_perform_this_action") {
    return "You are not authorised to perform this action";
  }
  return key;
}) as any;

// Helper to create mock context
const createMockContext = () => {
  const issues: z.ZodIssue[] = [];
  return {
    addIssue: vi.fn((issue: z.ZodIssue) => issues.push(issue)),
    issues,
  } as any;
};

describe("action-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useActionClassKeys", () => {
    test("should extract keys from code-type action classes", () => {
      const actionClasses: TActionClass[] = [
        {
          id: "1",
          name: "Code Action 1",
          description: null,
          type: "code",
          key: "key1",
          noCodeConfig: null,
          environmentId: "env1",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as TActionClass,
        {
          id: "2",
          name: "NoCode Action",
          description: null,
          type: "noCode",
          key: null,
          noCodeConfig: {
            type: "click",
            elementSelector: { cssSelector: "button", innerHtml: undefined },
            urlFilters: [],
          },
          environmentId: "env1",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as TActionClass,
        {
          id: "3",
          name: "Code Action 2",
          description: null,
          type: "code",
          key: "key2",
          noCodeConfig: null,
          environmentId: "env1",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as TActionClass,
      ];

      const { result } = renderHook(() => useActionClassKeys(actionClasses));

      expect(result.current).toEqual(["key1", "key2"]);
    });

    test("should filter out null keys", () => {
      const actionClasses: TActionClass[] = [
        {
          id: "1",
          name: "Code Action 1",
          description: null,
          type: "code",
          key: "key1",
          noCodeConfig: null,
          environmentId: "env1",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as TActionClass,
        {
          id: "2",
          name: "Code Action 2",
          description: null,
          type: "code",
          key: null,
          noCodeConfig: null,
          environmentId: "env1",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as TActionClass,
      ];

      const { result } = renderHook(() => useActionClassKeys(actionClasses));

      expect(result.current).toEqual(["key1"]);
    });

    test("should return empty array when no code actions exist", () => {
      const actionClasses: TActionClass[] = [
        {
          id: "1",
          name: "NoCode Action",
          description: null,
          type: "noCode",
          key: null,
          noCodeConfig: {
            type: "click",
            elementSelector: { cssSelector: "button", innerHtml: undefined },
            urlFilters: [],
          },
          environmentId: "env1",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as TActionClass,
      ];

      const { result } = renderHook(() => useActionClassKeys(actionClasses));

      expect(result.current).toEqual([]);
    });
  });

  describe("validateActionNameUniqueness", () => {
    test("should add error when action name already exists", () => {
      const ctx = createMockContext();
      const data = { name: "existingAction" };

      validateActionNameUniqueness(data, ["existingAction"], ctx, mockT);

      expect(ctx.addIssue).toHaveBeenCalledWith({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: 'Action with name "existingAction" already exists',
      });
    });

    test("should not add error when action name is unique", () => {
      const ctx = createMockContext();
      const data = { name: "uniqueAction" };

      validateActionNameUniqueness(data, ["existingAction"], ctx, mockT);

      expect(ctx.addIssue).not.toHaveBeenCalled();
    });

    test("should not add error when name is undefined", () => {
      const ctx = createMockContext();
      const data = { name: undefined };

      validateActionNameUniqueness(data, ["existingAction"], ctx, mockT);

      expect(ctx.addIssue).not.toHaveBeenCalled();
    });
  });

  describe("validateActionKeyUniqueness", () => {
    test("should add error when code action key already exists", () => {
      const ctx = createMockContext();
      const data = { type: "code", key: "existingKey" };

      validateActionKeyUniqueness(data, ["existingKey"], ctx, mockT);

      expect(ctx.addIssue).toHaveBeenCalledWith({
        code: z.ZodIssueCode.custom,
        path: ["key"],
        message: 'Action with key "existingKey" already exists',
      });
    });

    test("should not add error when code action key is unique", () => {
      const ctx = createMockContext();
      const data = { type: "code", key: "uniqueKey" };

      validateActionKeyUniqueness(data, ["existingKey"], ctx, mockT);

      expect(ctx.addIssue).not.toHaveBeenCalled();
    });

    test("should not validate key for non-code actions", () => {
      const ctx = createMockContext();
      const data = { type: "noCode", key: "existingKey" };

      validateActionKeyUniqueness(data, ["existingKey"], ctx, mockT);

      expect(ctx.addIssue).not.toHaveBeenCalled();
    });

    test("should not add error when key is undefined", () => {
      const ctx = createMockContext();
      const data = { type: "code", key: undefined };

      validateActionKeyUniqueness(data, ["existingKey"], ctx, mockT);

      expect(ctx.addIssue).not.toHaveBeenCalled();
    });
  });

  describe("validateCssSelector", () => {
    test("should add error when CSS selector is invalid", () => {
      const ctx = createMockContext();
      const data = {
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: "invalid-selector" },
        },
      };

      vi.mocked(isValidCssSelector).mockReturnValue(false);

      validateCssSelector(data, ctx, mockT);

      expect(ctx.addIssue).toHaveBeenCalledWith({
        code: z.ZodIssueCode.custom,
        path: ["noCodeConfig", "elementSelector", "cssSelector"],
        message: "Invalid CSS selector",
      });
    });

    test("should not add error when CSS selector is valid", () => {
      const ctx = createMockContext();
      const data = {
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: "valid-selector" },
        },
      };

      vi.mocked(isValidCssSelector).mockReturnValue(true);

      validateCssSelector(data, ctx, mockT);

      expect(ctx.addIssue).not.toHaveBeenCalled();
    });

    test("should not validate CSS selector for non-click noCode actions", () => {
      const ctx = createMockContext();
      const data = {
        type: "noCode",
        noCodeConfig: { type: "pageView" },
      };

      validateCssSelector(data, ctx, mockT);

      expect(ctx.addIssue).not.toHaveBeenCalled();
    });

    test("should not validate CSS selector for code actions", () => {
      const ctx = createMockContext();
      const data = { type: "code" };

      validateCssSelector(data, ctx, mockT);

      expect(ctx.addIssue).not.toHaveBeenCalled();
    });
  });

  describe("validateUrlFilterRegex", () => {
    test("should add error when regex pattern is invalid", () => {
      const ctx = createMockContext();
      const data = {
        type: "noCode",
        noCodeConfig: {
          urlFilters: [{ rule: "matchesRegex", value: "[invalid-regex" }],
        },
      };

      validateUrlFilterRegex(data, ctx, mockT);

      expect(ctx.addIssue).toHaveBeenCalledWith({
        code: z.ZodIssueCode.custom,
        path: ["noCodeConfig", "urlFilters", 0, "value"],
        message: "Invalid regex pattern",
      });
    });

    test("should not add error when regex pattern is valid", () => {
      const ctx = createMockContext();
      const data = {
        type: "noCode",
        noCodeConfig: {
          urlFilters: [{ rule: "matchesRegex", value: "^https://.*" }],
        },
      };

      validateUrlFilterRegex(data, ctx, mockT);

      expect(ctx.addIssue).not.toHaveBeenCalled();
    });

    test("should not validate regex for non-regex URL filter rules", () => {
      const ctx = createMockContext();
      const data = {
        type: "noCode",
        noCodeConfig: {
          urlFilters: [{ rule: "exactMatch", value: "some-value" }],
        },
      };

      validateUrlFilterRegex(data, ctx, mockT);

      expect(ctx.addIssue).not.toHaveBeenCalled();
    });

    test("should not validate for code actions", () => {
      const ctx = createMockContext();
      const data = { type: "code" };

      validateUrlFilterRegex(data, ctx, mockT);

      expect(ctx.addIssue).not.toHaveBeenCalled();
    });

    test("should validate multiple URL filters", () => {
      const ctx = createMockContext();
      const data = {
        type: "noCode",
        noCodeConfig: {
          urlFilters: [
            { rule: "matchesRegex", value: "^https://.*" },
            { rule: "matchesRegex", value: "[invalid-regex" },
          ],
        },
      };

      validateUrlFilterRegex(data, ctx, mockT);

      expect(ctx.addIssue).toHaveBeenCalledTimes(1);
      expect(ctx.addIssue).toHaveBeenCalledWith({
        code: z.ZodIssueCode.custom,
        path: ["noCodeConfig", "urlFilters", 1, "value"],
        message: "Invalid regex pattern",
      });
    });
  });

  describe("createActionClassZodResolver", () => {
    test("should return a zodResolver function", () => {
      const resolver = createActionClassZodResolver([], [], mockT);
      expect(typeof resolver).toBe("function");
    });

    test("should create resolver with correct parameters", () => {
      const testResolver = createActionClassZodResolver(["testAction"], ["testKey"], mockT);
      expect(testResolver).toBeDefined();
      expect(typeof testResolver).toBe("function");
    });

    test("should handle empty arrays", () => {
      const emptyResolver = createActionClassZodResolver([], [], mockT);
      expect(emptyResolver).toBeDefined();
      expect(typeof emptyResolver).toBe("function");
    });
  });

  describe("validatePermissions", () => {
    test("should throw error when user is read-only", () => {
      expect(() => validatePermissions(true, mockT)).toThrow("You are not authorised to perform this action");
    });

    test("should not throw error when user has write permissions", () => {
      expect(() => validatePermissions(false, mockT)).not.toThrow();
    });
  });
});
