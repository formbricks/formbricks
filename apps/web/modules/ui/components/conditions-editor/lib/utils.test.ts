import { describe, expect, test } from "vitest";
import { TGenericCondition, TGenericConditionGroup } from "../types";
import { isConditionGroup } from "./utils";

describe("isConditionGroup", () => {
  test("should return true for a valid condition group", () => {
    const conditionGroup: TGenericConditionGroup = {
      id: "group1",
      connector: "and",
      conditions: [],
    };
    expect(isConditionGroup(conditionGroup)).toBe(true);
  });

  test("should return false for a valid condition", () => {
    const condition: TGenericCondition = {
      id: "condition1",
      leftOperand: { value: "val1", type: "type1" },
      operator: "equals",
    };
    expect(isConditionGroup(condition)).toBe(false);
  });

  test("should return true for a nested condition group", () => {
    const nestedConditionGroup: TGenericConditionGroup = {
      id: "group2",
      connector: "or",
      conditions: [
        {
          id: "group3",
          connector: "and",
          conditions: [],
        },
      ],
    };
    expect(isConditionGroup(nestedConditionGroup)).toBe(true);
  });

  test("should return false for an object that looks like a condition group but is missing 'conditions' property", () => {
    const invalidGroup = {
      id: "invalidGroup",
      connector: "and",
    };
    // @ts-expect-error
    expect(isConditionGroup(invalidGroup)).toBe(false);
  });

  test("should return false for an object with 'conditions' property that is not an array", () => {
    const invalidGroup = {
      id: "invalidGroup",
      connector: "and",
      conditions: "not-an-array",
    };
    // @ts-expect-error
    expect(isConditionGroup(invalidGroup)).toBe(false);
  });
});
