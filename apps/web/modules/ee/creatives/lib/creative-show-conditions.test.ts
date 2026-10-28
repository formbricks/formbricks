import { describe, expect, test } from "vitest";
import type { TShowConditionSingle, TShowConditions } from "@formbricks/types/show-conditions";
import { appendShowCondition } from "@/modules/show-conditions/lib/tree";
import { hasIncompleteConditions } from "./creative-show-conditions";

const condition = (patch: Partial<TShowConditionSingle> = {}): TShowConditionSingle => ({
  id: "clcondition0000000000001",
  leftOperand: { type: "page", value: "currentUrl" },
  operator: "contains",
  rightOperand: { type: "static", value: "/plans" },
  ...patch,
});

const group = (...conditions: NonNullable<TShowConditions>["conditions"]): TShowConditions => ({
  id: "clgroup00000000000000001",
  connector: "and",
  conditions,
});

describe("hasIncompleteConditions", () => {
  test("no conditions, or complete ones, are fine", () => {
    expect(hasIncompleteConditions(null)).toBe(false);
    expect(hasIncompleteConditions(group(condition()))).toBe(false);
    expect(
      hasIncompleteConditions(
        group(
          condition({
            leftOperand: { type: "page", value: "queryParam", meta: { key: "utm_source" } },
            operator: "isSet",
            rightOperand: undefined,
          })
        )
      )
    ).toBe(false);
  });

  test("a condition the block just added has no value yet", () => {
    expect(hasIncompleteConditions(appendShowCondition(null))).toBe(true);
  });

  test("a blank value or a query parameter without its name is incomplete", () => {
    expect(hasIncompleteConditions(group(condition({ rightOperand: { type: "static", value: "  " } })))).toBe(
      true
    );
    expect(
      hasIncompleteConditions(
        group(condition({ leftOperand: { type: "page", value: "queryParam", meta: { key: "" } } }))
      )
    ).toBe(true);
  });

  test("a blank inside a group is caught too, since the block edits groups", () => {
    const nested = group(condition(), {
      id: "clgroup00000000000000002",
      connector: "or",
      conditions: [condition({ id: "clcondition0000000000002", rightOperand: undefined })],
    });

    expect(hasIncompleteConditions(nested)).toBe(true);
  });
});
