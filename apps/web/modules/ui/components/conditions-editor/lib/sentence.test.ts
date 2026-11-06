import { describe, expect, test } from "vitest";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import { toggleGroupConnector } from "@/lib/surveyLogic/utils";
import { getOperatorForField, getSentenceLead, pickConnector, withComparisonPills } from "./sentence";

/**
 * The rule editor's sentence layout (ENG-6969 T6): "If" on the first condition, a small and/or select
 * before the second, and the choice repeated as text before the rest.
 */
describe("getSentenceLead: what stands before each condition", () => {
  test("the first condition of the rule reads If", () => {
    expect(getSentenceLead({ index: 0, depth: 0, connector: "and" })).toEqual({ kind: "if" });
  });

  test("the first condition inside a nested group has no lead: the group's own slot says it", () => {
    expect(getSentenceLead({ index: 0, depth: 1, connector: "or" })).toEqual({ kind: "none" });
  });

  test("the second condition carries the and/or select", () => {
    expect(getSentenceLead({ index: 1, depth: 0, connector: "or" })).toEqual({ kind: "select" });
  });

  test("later conditions repeat the choice as text", () => {
    expect(getSentenceLead({ index: 2, depth: 0, connector: "or" })).toEqual({
      kind: "text",
      connector: "or",
    });
    expect(getSentenceLead({ index: 5, depth: 1, connector: "and" })).toEqual({
      kind: "text",
      connector: "and",
    });
  });

  test("a locked connector is never a select", () => {
    expect(getSentenceLead({ index: 1, depth: 0, connector: "and", isConnectorLocked: true })).toEqual({
      kind: "text",
      connector: "and",
    });
  });
});

describe("withComparisonPills: a number field's comparisons read as symbol pills", () => {
  test("picked by operator value, so a translated or reworded label doesn't change them", () => {
    const options = withComparisonPills([
      { label: "is equal to", value: "equals" },
      { label: "greater", value: "isGreaterThan" },
      { label: "is submitted", value: "isSubmitted" },
    ]);

    expect(options).toEqual([
      { label: "is equal to", value: "equals", symbol: "=", symbolOnly: true },
      { label: "greater", value: "isGreaterThan", symbol: ">", symbolOnly: true },
      { label: "is submitted", value: "isSubmitted" },
    ]);
  });

  test("a text or choice field's equality keeps its words", () => {
    const options = [
      { label: "equals", value: "equals" },
      { label: "does not equal", value: "doesNotEqual" },
    ];
    expect(withComparisonPills(options)).toEqual(options);
  });
});

describe("getOperatorForField: the operator a newly picked field starts with", () => {
  const options = [
    { label: "is set", value: "isSet" },
    { label: "equals", value: "equals" },
  ];

  test("the editor's default, when the field offers it", () => {
    expect(getOperatorForField(options, "equals")).toBe("equals");
  });

  test("otherwise the field's first operator, so the condition never holds one its field can't use", () => {
    expect(getOperatorForField(options, "isSubmitted")).toBe("isSet");
  });

  test("the default, when the field offers no operators yet", () => {
    expect(getOperatorForField([], "isSubmitted")).toBe("isSubmitted");
  });
});

describe("pickConnector: the select writes the group's connector", () => {
  const group = (): TConditionGroup => ({
    id: "group",
    connector: "and",
    conditions: [
      { id: "c1", leftOperand: { type: "hiddenField", value: "panel_id" }, operator: "isSet" },
      {
        id: "nested",
        connector: "and",
        conditions: [{ id: "c2", leftOperand: { type: "hiddenField", value: "seg" }, operator: "isSet" }],
      },
    ],
  });

  // Every caller wires the toggle to `toggleGroupConnector` (shared-conditions-factory).
  const pick = (groupId: "group" | "nested", picked: "and" | "or") => {
    const next = group();
    const target = groupId === "nested" ? (next.conditions[1] as TConditionGroup) : next;
    pickConnector(target, picked, (id) => toggleGroupConnector(next, id));
    return next;
  };

  test("picking or on an and group stores or", () => {
    expect(pick("group", "or").connector).toBe("or");
  });

  test("picking the connector it already has changes nothing", () => {
    expect(pick("group", "and")).toEqual(group());
  });

  test("a nested group's select writes that group only", () => {
    const next = pick("nested", "or");

    expect((next.conditions[1] as TConditionGroup).connector).toBe("or");
    expect(next.connector).toBe("and");
  });
});
