import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TWorkflowCondition, TWorkflowConditionGroup } from "@formbricks/workflows";
import {
  addConditionBelowInGroup,
  applyConditionEdit,
  canAddCondition,
  getConditionOperatorOptions,
  parseConditionValue,
  removeConditionFromGroup,
  toGenericConditionGroup,
  toVariableComboboxGroups,
  toggleConnectorInGroup,
  withSurveyOperatorNames,
} from "./if-else-conditions";

const t = ((key: string) => key) as unknown as TFunction;

const channelIsCall: TWorkflowCondition = {
  id: "c1",
  left: { path: "payload.channel" },
  operator: "equals",
  right: "call",
};

const group: TWorkflowConditionGroup = {
  id: "g",
  connector: "and",
  conditions: [
    channelIsCall,
    { id: "c2", left: { path: "payload.resolved" }, operator: "notEquals", right: true },
    {
      id: "g2",
      connector: "or",
      conditions: [{ id: "c3", left: { path: "payload.tier" }, operator: "exists" }],
    },
  ],
};

const hintOf = (path: string) =>
  (
    ({ "payload.handle_time_sec": "number", "payload.resolved": "boolean" }) as Record<
      string,
      "number" | "boolean"
    >
  )[path];

describe("toGenericConditionGroup", () => {
  test("shows each condition as Variable · operator · value, legacy names as the survey name they mean", () => {
    expect(toGenericConditionGroup(group)).toEqual({
      id: "g",
      connector: "and",
      conditions: [
        {
          id: "c1",
          leftOperand: { value: "payload.channel", type: "variable" },
          operator: "equals",
          rightOperand: { value: "call", type: "static" },
        },
        {
          id: "c2",
          leftOperand: { value: "payload.resolved", type: "variable" },
          operator: "doesNotEqual",
          rightOperand: { value: "true", type: "static" },
        },
        {
          id: "g2",
          connector: "or",
          conditions: [
            {
              id: "c3",
              leftOperand: { value: "payload.tier", type: "variable" },
              operator: "isSet",
              rightOperand: undefined,
            },
          ],
        },
      ],
    });
  });

  test("shows a Variable on the right as a Variable", () => {
    const generic = toGenericConditionGroup({
      id: "g",
      connector: "and",
      conditions: [
        { id: "c", left: { path: "payload.a" }, operator: "equals", right: { path: "payload.b" } },
      ],
    });
    expect(generic.conditions[0]).toMatchObject({ rightOperand: { value: "payload.b", type: "variable" } });
  });
});

describe("parseConditionValue", () => {
  test("keeps numbers and true/false typed when the Variable is one", () => {
    expect(parseConditionValue("412", "isGreaterThan", "number")).toBe(412);
    expect(parseConditionValue("false", "equals", "boolean")).toBe(false);
    expect(parseConditionValue("412", "equals", "text")).toBe("412");
  });

  test("splits a list operator's text into values", () => {
    expect(parseConditionValue("gold, silver,", "equalsOneOf", "text")).toEqual(["gold", "silver"]);
    expect(parseConditionValue(["gold"], "includesOneOf", "list")).toEqual(["gold"]);
  });
});

describe("applyConditionEdit", () => {
  test("a new Variable takes the editor's reset operator and drops the value", () => {
    expect(
      applyConditionEdit(
        channelIsCall,
        {
          leftOperand: { value: "payload.handle_time_sec", type: "variable" },
          operator: "equals",
          rightOperand: undefined,
        },
        hintOf
      )
    ).toEqual({ id: "c1", left: { path: "payload.handle_time_sec" }, operator: "equals" });
  });

  test("a typed value is stored with the Variable's type", () => {
    const condition = {
      id: "c",
      left: { path: "payload.handle_time_sec" },
      operator: "isGreaterThan",
    } as const;
    expect(applyConditionEdit(condition, { rightOperand: { value: "300", type: "static" } }, hintOf)).toEqual(
      {
        ...condition,
        right: 300,
      }
    );
  });

  test("a presence operator stores no value", () => {
    expect(applyConditionEdit(channelIsCall, { operator: "isSet", rightOperand: undefined }, hintOf)).toEqual(
      {
        id: "c1",
        left: { path: "payload.channel" },
        operator: "isSet",
      }
    );
  });

  test("an edit to a legacy condition writes the survey name, so names are never mixed", () => {
    const legacy = {
      id: "c",
      left: { path: "payload.resolved" },
      operator: "notEquals",
      right: true,
    } as const;
    expect(applyConditionEdit(legacy, { rightOperand: { value: "false", type: "static" } }, hintOf)).toEqual({
      id: "c",
      left: { path: "payload.resolved" },
      operator: "doesNotEqual",
      right: false,
    });
  });
});

describe("group operations", () => {
  test("adds a condition right below another, inside nested groups too", () => {
    const created = { id: "new", left: { path: "payload.tier" }, operator: "isSet" } as const;
    const next = addConditionBelowInGroup(group, "c3", created);
    expect((next.conditions[2] as TWorkflowConditionGroup).conditions.map((c) => c.id)).toEqual([
      "c3",
      "new",
    ]);
  });

  test("removes a condition and an emptied nested group, but never the last condition", () => {
    const next = removeConditionFromGroup(group, "c3");
    expect(next.conditions.map((c) => c.id)).toEqual(["c1", "c2"]);

    const single: TWorkflowConditionGroup = { id: "g", connector: "and", conditions: [channelIsCall] };
    expect(removeConditionFromGroup(single, "c1")).toBe(single);
  });

  test("toggles and/or on the group it was asked for", () => {
    const next = toggleConnectorInGroup(group, "g2");
    expect(next.connector).toBe("and");
    expect((next.conditions[2] as TWorkflowConditionGroup).connector).toBe("and");
  });

  test("renames legacy operators in the whole group, nested ones included", () => {
    const renamed = withSurveyOperatorNames(group);
    expect(renamed.conditions[1]).toMatchObject({ operator: "doesNotEqual" });
    expect((renamed.conditions[2] as TWorkflowConditionGroup).conditions[0]).toMatchObject({
      operator: "isSet",
    });
  });

  test("allows at most 20 conditions", () => {
    const full: TWorkflowConditionGroup = {
      id: "g",
      connector: "and",
      conditions: Array.from({ length: 20 }, (_, index) => ({ ...channelIsCall, id: `c${index}` })),
    };
    expect(canAddCondition(full)).toBe(false);
    expect(canAddCondition(group)).toBe(true);
  });
});

describe("options", () => {
  test("offers comparisons by the Variable's type", () => {
    const values = (hint: Parameters<typeof getConditionOperatorOptions>[0]) =>
      getConditionOperatorOptions(hint, t).map((option) => option.value);
    expect(values("number")).toEqual([
      "equals",
      "doesNotEqual",
      "isGreaterThan",
      "isLessThan",
      "isGreaterThanOrEqual",
      "isLessThanOrEqual",
      "isSet",
      "isNotSet",
    ]);
    expect(values("boolean")).toEqual(["equals", "doesNotEqual", "isSet", "isNotSet"]);
    expect(values("text")).toContain("startsWith");
    expect(values(undefined)).toEqual(
      expect.arrayContaining(["contains", "isLessThanOrEqual", "includesOneOf"])
    );
  });

  test("lists the picker's Variables grouped, lists greyed", () => {
    expect(
      toVariableComboboxGroups(
        [
          {
            kind: "payload",
            hasSample: true,
            truncated: false,
            options: [
              { path: "payload.channel", label: "channel", typeHint: "text", isPickable: true },
              { path: "payload.tags", label: "tags", typeHint: "list", isPickable: false },
            ],
          },
          { kind: "response", options: [] },
        ],
        t,
        () => "step"
      )
    ).toEqual([
      {
        label: "workspace.workflows.variable_group_payload",
        value: "payload",
        options: [
          { label: "channel", value: "payload.channel", disabled: false, meta: { type: "variable" } },
          { label: "tags", value: "payload.tags", disabled: true, meta: { type: "variable" } },
        ],
      },
    ]);
  });
});
