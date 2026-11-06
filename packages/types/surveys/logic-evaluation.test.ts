import { describe, expect, test } from "vitest";
import type { TConditionGroup } from "./logic";
import { evaluateConditionGroup } from "./logic-evaluation";

const condition = (id: string) => ({
  id,
  leftOperand: { type: "element" as const, value: "q1" },
  operator: "isSubmitted" as const,
});

describe("evaluateConditionGroup", () => {
  test("an empty group is true whatever its connector: it reads and runs as 'Always'", () => {
    const never = () => false;

    expect(evaluateConditionGroup({ id: "g", connector: "and", conditions: [] }, never)).toBe(true);
    expect(evaluateConditionGroup({ id: "g", connector: "or", conditions: [] }, never)).toBe(true);
  });

  test("an 'any' group needs one true condition, an 'all' group every one", () => {
    const group = (connector: "and" | "or"): TConditionGroup => ({
      id: "g",
      connector,
      conditions: [condition("yes"), condition("no")],
    });
    const isYes = (item: { id: string }) => item.id === "yes";

    expect(evaluateConditionGroup(group("or"), isYes)).toBe(true);
    expect(evaluateConditionGroup(group("and"), isYes)).toBe(false);
  });
});
