import "@testing-library/jest-dom/vitest";
import { describe, expect, test } from "vitest";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { buildActionObject, buildCodeAction, buildNoCodeAction } from "./action-builder";

describe("Action Builder", () => {
  describe("buildActionObject", () => {
    test("builds noCode action correctly", () => {
      const data: TActionClassInput = {
        name: "  Test NoCode Action  ",
        description: "Test Description",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: "button.test", innerHtml: undefined },
          urlFilters: [],
        },
      };

      const result = buildActionObject(data, "test-env");

      expect(result).toEqual({
        name: "Test NoCode Action", // trimmed
        description: "Test Description",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: "button.test", innerHtml: undefined },
          urlFilters: [],
        },
      });
    });

    test("builds code action correctly", () => {
      const data: TActionClassInput = {
        name: "  Test Code Action  ",
        description: "Test Description",
        environmentId: "test-env",
        type: "code",
        key: "test-key",
      };

      const result = buildActionObject(data, "test-env");

      expect(result).toEqual({
        name: "Test Code Action", // trimmed
        description: "Test Description",
        environmentId: "test-env",
        type: "code",
        key: "test-key",
      });
    });
  });

  describe("buildNoCodeAction", () => {
    test("builds click action with CSS selector", () => {
      const data: TActionClassInput = {
        name: "Click Action",
        description: "Click Description",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: "button.test", innerHtml: "Click me" },
          urlFilters: [],
        },
      };

      const result = buildNoCodeAction(data, "test-env");

      expect(result).toEqual({
        name: "Click Action",
        description: "Click Description",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: "button.test", innerHtml: "Click me" },
          urlFilters: [],
        },
      });
    });

    test("builds pageView action", () => {
      const data: TActionClassInput = {
        name: "Page View Action",
        description: "Page View Description",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "pageView",
          urlFilters: [{ value: "https://example.com", rule: "exactMatch" }],
        },
      };

      const result = buildNoCodeAction(data, "test-env");

      expect(result).toEqual({
        name: "Page View Action",
        description: "Page View Description",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "pageView",
          urlFilters: [{ value: "https://example.com", rule: "exactMatch" }],
        },
      });
    });

    test("throws error for code action type", () => {
      const data: TActionClassInput = {
        name: "Code Action",
        description: "Code Description",
        environmentId: "test-env",
        type: "code",
        key: "test-key",
      };

      expect(() => buildNoCodeAction(data, "test-env")).toThrow("Invalid action type for noCode action");
    });

    test("trims whitespace from name", () => {
      const data: TActionClassInput = {
        name: "  Whitespace Action  ",
        description: "Test Description",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "pageView",
          urlFilters: [],
        },
      };

      const result = buildNoCodeAction(data, "test-env");

      expect(result.name).toBe("Whitespace Action");
    });
  });

  describe("buildCodeAction", () => {
    test("builds code action with key", () => {
      const data: TActionClassInput = {
        name: "Code Action",
        description: "Code Description",
        environmentId: "test-env",
        type: "code",
        key: "code-action-key",
      };

      const result = buildCodeAction(data, "test-env");

      expect(result).toEqual({
        name: "Code Action",
        description: "Code Description",
        environmentId: "test-env",
        type: "code",
        key: "code-action-key",
      });
    });

    test("throws error for noCode action type", () => {
      const data: TActionClassInput = {
        name: "NoCode Action",
        description: "NoCode Description",
        environmentId: "test-env",
        type: "noCode",
        noCodeConfig: {
          type: "click",
          elementSelector: { cssSelector: undefined, innerHtml: undefined },
          urlFilters: [],
        },
      };

      expect(() => buildCodeAction(data, "test-env")).toThrow("Invalid action type for code action");
    });

    test("trims whitespace from name", () => {
      const data: TActionClassInput = {
        name: "  Whitespace Code Action  ",
        description: "Test Description",
        environmentId: "test-env",
        type: "code",
        key: "test-key",
      };

      const result = buildCodeAction(data, "test-env");

      expect(result.name).toBe("Whitespace Code Action");
    });

    test("handles undefined description", () => {
      const data: TActionClassInput = {
        name: "Code Action",
        description: undefined,
        environmentId: "test-env",
        type: "code",
        key: "test-key",
      };

      const result = buildCodeAction(data, "test-env");

      expect(result.description).toBeUndefined();
    });
  });
});
