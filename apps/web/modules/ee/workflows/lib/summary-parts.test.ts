import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TWorkflowConditionGroup } from "@formbricks/workflows";
import { describeIfElseConditionParts, describeSwitchParts } from "./summary-parts";

// Renders templates the way i18next does: placeholders filled in, so word order comes from the template.
const templates: Record<string, string> = {
  "workspace.workflows.if_else_operator_includes_all_of": "{{variable}} includes all of {{value}}",
  "workspace.workflows.if_else_operator_equals": "{{variable}} is {{value}}",
  "workspace.workflows.switch_summary": "{{variable}} · {{count}} cases + Default",
};
const t = ((key: string, values: Record<string, unknown> = {}) =>
  (templates[key] ?? key).replace(/{{(\w+)}}/g, (_, name: string) =>
    String(values[name])
  )) as unknown as TFunction;

const group = (condition: Record<string, unknown>) =>
  ({
    id: "g",
    connector: "and",
    conditions: [{ id: "c1", ...condition }],
  }) as unknown as TWorkflowConditionGroup;

describe("describeIfElseConditionParts", () => {
  test("draws the survey answer as a question chip, the rest as words", () => {
    const refs = new Map([
      [
        "response.q1",
        { kind: "question" as const, label: "Which plan?", elementType: "multipleChoiceMulti" as never },
      ],
    ]);

    const parts = describeIfElseConditionParts(
      group({ left: { path: "response.q1" }, operator: "includesAllOf", right: ["gold"] }),
      t,
      refs
    );

    expect(parts).toEqual([
      { kind: "reference", chip: refs.get("response.q1"), plain: "Which plan?" },
      { kind: "text", text: " includes all of “gold”" },
    ]);
  });

  test("draws a payload Variable as a plain chip by its key, and a Variable value as a chip too", () => {
    const parts = describeIfElseConditionParts(
      group({ left: { path: "payload.member.tier" }, operator: "equals", right: { path: "payload.plan" } }),
      t
    );

    expect(parts).toEqual([
      { kind: "reference", chip: { kind: "reserved", label: "member.tier" }, plain: "member.tier" },
      { kind: "text", text: " is " },
      { kind: "reference", chip: { kind: "reserved", label: "plan" }, plain: "plan" },
    ]);
  });

  test("draws an answer the survey no longer has as a missing chip with its id", () => {
    const refs = new Map([["response.q1", { kind: "question" as const, label: "q1" }]]);

    const parts = describeIfElseConditionParts(
      group({ left: { path: "response.gone" }, operator: "equals", right: "yes" }),
      t,
      refs
    );

    expect(parts?.[0]).toEqual({
      kind: "reference",
      chip: { kind: "question", label: "gone", missing: true },
      plain: "gone",
    });
  });

  test("reads picked choices by their label, and a choice the survey no longer has by its id", () => {
    const choiceLabels = new Map([["response.q1", new Map([["gold", "Gold plan"]])]]);

    const parts = describeIfElseConditionParts(
      group({
        left: { path: "response.q1" },
        operator: "includesAllOf",
        right: { choiceIds: ["gold", "old"] },
      }),
      t,
      undefined,
      choiceLabels
    );

    expect(parts?.at(-1)).toEqual({ kind: "text", text: " includes all of “Gold plan”, “old”" });
  });

  test("has no parts when there is no condition", () => {
    expect(
      describeIfElseConditionParts({ id: "g", connector: "and", conditions: [] } as never, t)
    ).toBeNull();
  });
});

describe("describeSwitchParts", () => {
  test("draws the compared Variable as a chip", () => {
    expect(describeSwitchParts("payload.ticket.channel", 3, t)).toEqual([
      { kind: "reference", chip: { kind: "reserved", label: "ticket.channel" }, plain: "ticket.channel" },
      { kind: "text", text: " · 3 cases + Default" },
    ]);
  });
});
