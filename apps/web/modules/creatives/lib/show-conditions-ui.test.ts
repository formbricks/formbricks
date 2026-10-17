import { describe, expect, test } from "vitest";
import {
  canEditInCard,
  createCondition,
  getValueKind,
  hasIncompleteConditions,
  setTopLevelConditions,
  testUrl,
  withOperator,
} from "./show-conditions-ui";

describe("createCondition", () => {
  test("starts on the operand's first operator with a value of the right kind", () => {
    expect(createCondition("currentUrl", "a")).toEqual({
      id: "a",
      leftOperand: { type: "page", value: "currentUrl" },
      operator: "equals",
      rightOperand: { type: "static", value: "" },
    });
    expect(createCondition("screenWidth", "b").rightOperand).toEqual({ type: "static", value: 0 });
    expect(createCondition("queryParam", "c").leftOperand.meta).toEqual({ key: "" });
    expect(createCondition("deviceType", "d").leftOperand.type).toBe("device");
  });
});

describe("withOperator", () => {
  test("keeps a value of the same kind and resets one that no longer fits", () => {
    const condition = {
      ...createCondition("currentUrl", "a"),
      rightOperand: { type: "static" as const, value: "/plans" },
    };
    expect(withOperator(condition, "contains").rightOperand?.value).toBe("/plans");
    expect(withOperator(condition, "containsAnyOf").rightOperand?.value).toEqual([]);
    expect(withOperator(createCondition("queryParam", "q"), "isSet").rightOperand).toBeUndefined();
  });
});

describe("getValueKind", () => {
  test("maps operands and operators to the input the editor shows", () => {
    expect(getValueKind("queryParam", "isNotSet")).toBe("none");
    expect(getValueKind("timeOnSite", "isGreaterThan")).toBe("number");
    expect(getValueKind("pageReferrer", "containsNoneOf")).toBe("list");
    expect(getValueKind("browser", "equals")).toBe("browser");
  });
});

describe("setTopLevelConditions / hasIncompleteConditions", () => {
  test("an empty list prunes to null, and blanks are flagged", () => {
    expect(setTopLevelConditions(null, [], "g")).toBeNull();
    const group = setTopLevelConditions(null, [createCondition("currentUrl", "a")], "g");
    expect(group).toMatchObject({ id: "g", connector: "and" });
    expect(hasIncompleteConditions(group)).toBe(true);
    expect(hasIncompleteConditions(null)).toBe(false);
  });
});

describe("canEditInCard", () => {
  test("no conditions, or one flat group of them, is edited in the card", () => {
    expect(canEditInCard(null)).toBe(true);
    expect(canEditInCard(setTopLevelConditions(null, [createCondition("currentUrl", "a")], "g"))).toBe(true);
  });

  test("a group nested inside (only the API and MCP make one) is shown read-only instead", () => {
    const nested = {
      id: "g",
      connector: "or" as const,
      conditions: [
        createCondition("currentUrl", "a"),
        { id: "sub", connector: "and" as const, conditions: [createCondition("deviceType", "b")] },
      ],
    };

    expect(canEditInCard(nested)).toBe(false);
  });
});

describe("testUrl", () => {
  test("runs the shared evaluator and leaves visit conditions undecided", () => {
    const url = {
      ...createCondition("currentUrl", "url"),
      operator: "contains" as const,
      rightOperand: { type: "static" as const, value: "/plans" },
    };
    const visit = { ...createCondition("pagesViewed", "visit"), operator: "isGreaterThan" as const };
    const conditions = setTopLevelConditions(null, [url, visit], "g");

    const result = testUrl(conditions, "https://site.example/PLANS/compare");
    expect(result.byCondition).toEqual({ url: true, visit: null });
    expect(result.passed).toBe(false);
    expect(testUrl(null, "https://site.example/").passed).toBe(true);
  });
});
