import { TFnType } from "@tolgee/react";
import { describe, expect, test, vi } from "vitest";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { buildActionObject, buildCodeAction, buildNoCodeAction } from "./action-builder";

const mockT = vi.fn((key: string) => {
  const translations: Record<string, string> = {
    "environments.actions.invalid_action_type_no_code": "Invalid action type for noCode action",
    "environments.actions.invalid_action_type_code": "Invalid action type for code action",
  };
  return translations[key] || key;
}) as unknown as TFnType;

describe("action-builder", () => {
  describe("buildActionObject", () => {
    test("builds noCode action when type is noCode", () => {
      const data: TActionClassInput = {
        name: "Click Button",
        type: "noCode",
        environmentId: "env1",
        noCodeConfig: {
          type: "click",
          urlFilters: [],
          elementSelector: {
            cssSelector: ".button",
            innerHtml: "Click me",
          },
        },
      };

      const result = buildActionObject(data, "env1", mockT);

      expect(result).toEqual({
        name: "Click Button",
        type: "noCode",
        environmentId: "env1",
        noCodeConfig: {
          type: "click",
          urlFilters: [],
          elementSelector: {
            cssSelector: ".button",
            innerHtml: "Click me",
          },
        },
      });
    });

    test("builds code action when type is code", () => {
      const data: TActionClassInput = {
        name: "Track Event",
        type: "code",
        key: "track_event",
        environmentId: "env1",
      };

      const result = buildActionObject(data, "env1", mockT);

      expect(result).toEqual({
        name: "Track Event",
        type: "code",
        key: "track_event",
        environmentId: "env1",
      });
    });
  });

  describe("buildNoCodeAction", () => {
    test("builds noCode action with click config", () => {
      const data: TActionClassInput = {
        name: "Click Button",
        type: "noCode",
        environmentId: "env1",
        noCodeConfig: {
          type: "click",
          urlFilters: [{ rule: "exactMatch", value: "https://example.com" }],
          elementSelector: {
            cssSelector: ".button",
            innerHtml: "Click me",
          },
        },
      };

      const result = buildNoCodeAction(data, "env1", mockT);

      expect(result).toEqual({
        name: "Click Button",
        type: "noCode",
        environmentId: "env1",
        noCodeConfig: {
          type: "click",
          urlFilters: [{ rule: "exactMatch", value: "https://example.com" }],
          elementSelector: {
            cssSelector: ".button",
            innerHtml: "Click me",
          },
        },
      });
    });

    test("builds noCode action with pageView config", () => {
      const data: TActionClassInput = {
        name: "Page Visit",
        type: "noCode",
        environmentId: "env1",
        noCodeConfig: {
          type: "pageView",
          urlFilters: [{ rule: "contains", value: "/dashboard" }],
        },
      };

      const result = buildNoCodeAction(data, "env1", mockT);

      expect(result).toEqual({
        name: "Page Visit",
        type: "noCode",
        environmentId: "env1",
        noCodeConfig: {
          type: "pageView",
          urlFilters: [{ rule: "contains", value: "/dashboard" }],
        },
      });
    });

    test("throws error for invalid action type", () => {
      const data = {
        name: "Invalid Action",
        type: "code",
        environmentId: "env1",
      } as any;

      expect(() => buildNoCodeAction(data, "env1", mockT)).toThrow("Invalid action type for noCode action");
    });

    test("includes optional fields when provided", () => {
      const data: TActionClassInput = {
        name: "Click Button",
        description: "Click the submit button",
        type: "noCode",
        environmentId: "env1",
        noCodeConfig: {
          type: "click",
          urlFilters: [],
          elementSelector: {
            cssSelector: ".button",
            innerHtml: "Submit",
          },
        },
      };

      const result = buildNoCodeAction(data, "env1", mockT);

      expect(result).toEqual({
        name: "Click Button",
        description: "Click the submit button",
        type: "noCode",
        environmentId: "env1",
        noCodeConfig: {
          type: "click",
          urlFilters: [],
          elementSelector: {
            cssSelector: ".button",
            innerHtml: "Submit",
          },
        },
      });
    });
  });

  describe("buildCodeAction", () => {
    test("builds code action with required fields", () => {
      const data: TActionClassInput = {
        name: "Track Event",
        type: "code",
        key: "track_event",
        environmentId: "env1",
      };

      const result = buildCodeAction(data, "env1", mockT);

      expect(result).toEqual({
        name: "Track Event",
        type: "code",
        key: "track_event",
        environmentId: "env1",
      });
    });

    test("builds code action with optional description", () => {
      const data: TActionClassInput = {
        name: "Track Purchase",
        description: "Track when user makes a purchase",
        type: "code",
        key: "track_purchase",
        environmentId: "env1",
      };

      const result = buildCodeAction(data, "env1", mockT);

      expect(result).toEqual({
        name: "Track Purchase",
        description: "Track when user makes a purchase",
        type: "code",
        key: "track_purchase",
        environmentId: "env1",
      });
    });

    test("throws error for invalid action type", () => {
      const data = {
        name: "Invalid Action",
        type: "noCode",
        environmentId: "env1",
      } as any;

      expect(() => buildCodeAction(data, "env1", mockT)).toThrow("Invalid action type for code action");
    });

    test("handles null key", () => {
      const data: TActionClassInput = {
        name: "Track Event",
        type: "code",
        key: null,
        environmentId: "env1",
      };

      const result = buildCodeAction(data, "env1", mockT);

      expect(result).toEqual({
        name: "Track Event",
        type: "code",
        key: null,
        environmentId: "env1",
      });
    });
  });
});
