import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition, TWorkflowSwitchNode } from "@formbricks/workflows";
import { withSurveyOperatorNamesInDefinition } from "./if-else-conditions";
import {
  addSwitchCase,
  applySwitchCaseEdit,
  canAddSwitchCase,
  canRemoveSwitchCase,
  removeSwitchCase,
} from "./switch-cases";

const route = (cases: TWorkflowSwitchNode["config"]["cases"]): TWorkflowSwitchNode => ({
  id: "route",
  type: "switch",
  config: { left: { path: "payload.customer.spend" }, cases },
});

const goldSilver = route([
  { id: "gold", name: "Gold", operator: "equals", right: "gold" },
  { id: "silver", name: "Silver", operator: "equals", right: "silver" },
]);

const numberHint = () => "number" as const;

describe("editing a Switch case", () => {
  test("a typed value takes the Variable's type: a number for a number Variable", () => {
    const next = applySwitchCaseEdit(
      goldSilver,
      "gold",
      { rightOperand: { value: "500", type: "static" } },
      numberHint
    );

    expect(next.config.cases[0]).toEqual({ id: "gold", name: "Gold", operator: "equals", right: 500 });
    expect(next.config.cases[1]).toBe(goldSilver.config.cases[1]);
  });

  test("a picked Variable becomes a Variable reference", () => {
    const next = applySwitchCaseEdit(
      goldSilver,
      "gold",
      { rightOperand: { value: "payload.threshold", type: "variable" } },
      numberHint
    );

    expect(next.config.cases[0].right).toEqual({ path: "payload.threshold" });
  });

  test("a presence operator drops the value; a list operator splits typed text", () => {
    const presence = applySwitchCaseEdit(goldSilver, "gold", { operator: "isSet" }, numberHint);
    expect(presence.config.cases[0]).toEqual({ id: "gold", name: "Gold", operator: "isSet" });

    const list = applySwitchCaseEdit(
      goldSilver,
      "gold",
      { operator: "equalsOneOf", rightOperand: { value: "gold, platinum", type: "static" } },
      () => "text"
    );
    expect(list.config.cases[0].right).toEqual(["gold", "platinum"]);
  });

  test("a new operator keeps the value, and leaving a presence check starts from an empty one", () => {
    const contains = applySwitchCaseEdit(goldSilver, "gold", { operator: "contains" }, () => "text");
    expect(contains.config.cases[0]).toMatchObject({ operator: "contains", right: "gold" });

    const presence = route([{ id: "any", name: "Any", operator: "isSet" }, goldSilver.config.cases[1]]);
    const back = applySwitchCaseEdit(presence, "any", { operator: "equals" }, () => "text");
    expect(back.config.cases[0]).toEqual({ id: "any", name: "Any", operator: "equals", right: "" });
  });
});

describe("adding and removing cases", () => {
  test("adds a named case after the last one, up to 10", () => {
    const next = addSwitchCase(goldSilver, "Case 3");
    expect(next.config.cases.map((switchCase) => switchCase.name)).toEqual(["Gold", "Silver", "Case 3"]);
    expect(next.config.cases[2]).toMatchObject({ operator: "equals", right: "" });

    const ten = route(
      Array.from({ length: 10 }, (_, index) => ({ ...goldSilver.config.cases[0], id: `c${index}` }))
    );
    expect(canAddSwitchCase(ten)).toBe(false);
    expect(addSwitchCase(ten, "Case 11")).toBe(ten);
  });

  test("removes a case but never below two", () => {
    const three = addSwitchCase(goldSilver, "Case 3");
    expect(removeSwitchCase(three, "gold").config.cases.map((switchCase) => switchCase.id)).toEqual([
      "silver",
      three.config.cases[2].id,
    ]);
    expect(canRemoveSwitchCase(goldSilver)).toBe(false);
    expect(removeSwitchCase(goldSilver, "gold")).toBe(goldSilver);
  });
});

describe("operator names across the definition", () => {
  test("an edit writes survey names, so legacy names on any If/else or Switch are renamed with it", () => {
    const legacySwitch = route([
      { id: "a", name: "A", operator: "notEquals", right: "x" },
      { id: "b", name: "B", operator: "greaterThan", right: 1 },
    ]);
    const definition = { nodes: [legacySwitch] } as Pick<TWorkflowDefinition, "nodes">;

    const renamed = withSurveyOperatorNamesInDefinition(definition).nodes[0] as TWorkflowSwitchNode;
    expect(renamed.config.cases.map((switchCase) => switchCase.operator)).toEqual([
      "doesNotEqual",
      "isGreaterThan",
    ]);
  });
});
