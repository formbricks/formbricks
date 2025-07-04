import { describe, test, expect } from "vitest";
import {
  ZActionClassNoCodeConfig,
  ZActionClassPageUrlRule,
  ZActionClassInput
} from "./action-classes";

describe("ZActionClassNoCodeConfig (click type)", () => {
  test("fails when both cssSelector and innerHtml are missing", () => {
    const result = ZActionClassNoCodeConfig.safeParse({
      type: "click",
      urlFilters: [],
      elementSelector: {}
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain(
      "Either cssSelector or innerHtml"
    );
  });

  test("passes when cssSelector is provided", () => {
    const result = ZActionClassNoCodeConfig.safeParse({
      type: "click",
      urlFilters: [],
      elementSelector: { cssSelector: ".btn" }
    });

    expect(result.success).toBe(true);
  });

  test("passes when innerHtml is provided", () => {
    const result = ZActionClassNoCodeConfig.safeParse({
      type: "click",
      urlFilters: [],
      elementSelector: { innerHtml: "Click me" }
    });

    expect(result.success).toBe(true);
  });
});

describe("ZActionClassPageUrlRule", () => {
  test("accepts all valid rules", () => {
    const validRules = [
      "exactMatch",
      "contains",
      "startsWith",
      "endsWith",
      "notMatch",
      "notContains"
    ];

    for (const rule of validRules) {
      const result = ZActionClassPageUrlRule.safeParse(rule);
      expect(result.success).toBe(true);
    }
  });

  test("rejects an invalid rule", () => {
    const result = ZActionClassPageUrlRule.safeParse("invalidRule");
    expect(result.success).toBe(false);
  });
});

describe("ZActionClassInput (discriminated union)", () => {
  test("passes for code type input with required fields", () => {
    const result = ZActionClassInput.safeParse({
      name: "Test Action",
      type: "code",
      environmentId: "cklb2xk1g0000z6x78j2n1e3w",
      key: "abc"
    });

    expect(result.success).toBe(true);
  });

  test("fails for code type input without key", () => {
    const result = ZActionClassInput.safeParse({
      name: "Test Action",
      type: "code",
      environmentId: "cklb2xk1g0000z6x78j2n1e3w"
    });

    expect(result.success).toBe(false);
  });

  test("passes for noCode type input with valid config", () => {
    const result = ZActionClassInput.safeParse({
      name: "NoCode Action",
      type: "noCode",
      environmentId: "cklb2xk1g0000z6x78j2n1e3w",
      noCodeConfig: {
        type: "click",
        urlFilters: [
          {
            value: "page",
            rule: "contains"
          }
        ],
        elementSelector: {
          cssSelector: "#element"
        }
      }
    });

    expect(result.success).toBe(true);
  });
});
