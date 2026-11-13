import { describe, expect, test } from "vitest";
import {
  type TWorkflowDefinitionBase,
  ZWorkflowDefinition,
  ZWorkflowDefinitionInput,
  ZWorkflowEnableDefinition,
  ZWorkflowExecutableDefinition,
} from ".";

const email = (id: string) => ({
  id,
  type: "action" as const,
  actionType: "send_email" as const,
  config: {
    from: "noreply@example.com",
    to: "jane@example.com",
    replyTo: [],
    subject: "Thanks",
    body: "We received your call.",
    attachResponseData: false,
  },
});

type TCaseInput = Record<string, unknown>;

const goldCase: TCaseInput = { id: "gold", name: "Gold", operator: "equals", right: "gold" };
const silverCase: TCaseInput = { id: "silver", name: "Silver", operator: "equals", right: "silver" };

const switchNode = (
  cases: TCaseInput[],
  left: Record<string, unknown> = { path: "payload.customer.tier" }
) => ({
  id: "route",
  type: "switch" as const,
  config: { left, cases },
});

type TEdgeInput = { id: string; source: string; target: string; sourceHandle?: string };

/** webhook → route → (gold: gold-email | silver: silver-email | default: default-email) */
const routing = (
  cases: TCaseInput[] = [goldCase, silverCase],
  edges?: TEdgeInput[],
  left?: Record<string, unknown>
): TWorkflowDefinitionBase =>
  ({
    schemaVersion: 1,
    trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {} },
    nodes: [switchNode(cases, left), email("gold-email"), email("silver-email"), email("default-email")],
    edges: edges ?? [
      { id: "e1", source: "trigger", target: "route" },
      { id: "e2", source: "route", target: "gold-email", sourceHandle: "gold" },
      { id: "e3", source: "route", target: "silver-email", sourceHandle: "silver" },
      { id: "e4", source: "route", target: "default-email", sourceHandle: "default" },
    ],
    entryNodeId: "trigger",
  }) as TWorkflowDefinitionBase;

const issues = (result: { success: boolean; error?: { issues: { message: string }[] } }): string =>
  result.success ? "" : (result.error?.issues.map((issue) => issue.message).join(" | ") ?? "");

describe("Switch step", () => {
  test("a Switch with named cases and a Default branch saves, runs and enables", () => {
    const definition = routing();

    expect(issues(ZWorkflowDefinitionInput.safeParse(definition))).toBe("");
    expect(issues(ZWorkflowExecutableDefinition.safeParse(definition))).toBe("");
    expect(issues(ZWorkflowEnableDefinition.safeParse(definition))).toBe("");
  });

  test("a case compares with the If/else rules: presence operators take no value, list operators a list", () => {
    expect(
      issues(ZWorkflowDefinition.safeParse(routing([{ ...goldCase, operator: "isSet" }, silverCase])))
    ).toMatch(/must not have a right-hand value/);
    expect(
      issues(
        ZWorkflowDefinition.safeParse(
          routing([{ ...goldCase, operator: "equalsOneOf", right: ["gold", "platinum"] }, silverCase])
        )
      )
    ).toBe("");
    expect(
      issues(
        ZWorkflowDefinition.safeParse(
          routing([{ ...goldCase, operator: "equals", right: ["a"] }, silverCase])
        )
      )
    ).toMatch(/does not take a list/);
  });

  test("legacy operator names are accepted but never mixed with survey names, across If/else and Switch", () => {
    expect(
      issues(ZWorkflowDefinition.safeParse(routing([{ ...goldCase, operator: "notEquals" }, silverCase])))
    ).toBe("");
    expect(
      issues(
        ZWorkflowDefinition.safeParse(
          routing([
            { ...goldCase, operator: "notEquals" },
            { ...silverCase, operator: "doesNotEqual" },
          ])
        )
      )
    ).toMatch(/mixes/);
  });

  test("saving needs 2 to 10 cases; a stored Switch outside that still reads", () => {
    const oneCase = routing(
      [goldCase],
      [
        { id: "e1", source: "trigger", target: "route" },
        { id: "e2", source: "route", target: "gold-email", sourceHandle: "gold" },
      ]
    );
    const elevenCases = routing(
      Array.from({ length: 11 }, (_, index) => ({ ...goldCase, id: `case-${index}`, name: `Case ${index}` })),
      [{ id: "e1", source: "trigger", target: "route" }]
    );

    expect(issues(ZWorkflowDefinitionInput.safeParse(oneCase))).toMatch(/at least 2 cases/);
    expect(issues(ZWorkflowDefinitionInput.safeParse(elevenCases))).toMatch(/at most 10 cases/);
    expect(ZWorkflowDefinition.safeParse(oneCase).success).toBe(true);
    expect(ZWorkflowDefinition.safeParse(elevenCases).success).toBe(true);
  });

  test("case ids are unique and never `default`, which names the Default branch", () => {
    expect(
      issues(ZWorkflowDefinitionInput.safeParse(routing([goldCase, { ...silverCase, id: "gold" }])))
    ).toMatch(/Duplicate case id/);
    expect(
      issues(ZWorkflowDefinitionInput.safeParse(routing([goldCase, { ...silverCase, id: "default" }])))
    ).toMatch(/reserved/);
  });

  test("a draft may hold a case without a name, but enabling needs every case named", () => {
    const unnamed = routing([goldCase, { ...silverCase, name: "  " }]);

    expect(issues(ZWorkflowDefinitionInput.safeParse(unnamed))).toBe("");
    expect(issues(ZWorkflowEnableDefinition.safeParse(unnamed))).toMatch(/case 2 needs a name/);
  });

  test("the Variable follows the path rules", () => {
    expect(
      issues(ZWorkflowDefinitionInput.safeParse(routing(undefined, undefined, { path: "payload.__proto__" })))
    ).not.toBe("");
    expect(
      issues(ZWorkflowEnableDefinition.safeParse(routing(undefined, undefined, { path: "response.q1" })))
    ).toMatch(/does not provide/);
  });

  test("its edges leave by a case id or `default`, at most one per branch", () => {
    const unknownHandle = routing(undefined, [
      { id: "e1", source: "trigger", target: "route" },
      { id: "e2", source: "route", target: "gold-email", sourceHandle: "platinum" },
    ]);
    const noHandle = routing(undefined, [
      { id: "e1", source: "trigger", target: "route" },
      { id: "e2", source: "route", target: "gold-email" },
    ]);
    const twoOnOneBranch = routing(undefined, [
      { id: "e1", source: "trigger", target: "route" },
      { id: "e2", source: "route", target: "gold-email", sourceHandle: "gold" },
      { id: "e3", source: "route", target: "silver-email", sourceHandle: "gold" },
    ]);

    expect(issues(ZWorkflowDefinition.safeParse(unknownHandle))).toMatch(/case ids or default/);
    expect(issues(ZWorkflowDefinition.safeParse(noHandle))).toMatch(/case ids or default/);
    expect(issues(ZWorkflowDefinition.safeParse(twoOnOneBranch))).toMatch(/at most one edge per branch/);
  });

  test("a branch with no step is allowed: the run ends there", () => {
    const definition = routing(undefined, [
      { id: "e1", source: "trigger", target: "route" },
      { id: "e2", source: "route", target: "gold-email", sourceHandle: "gold" },
    ]);
    definition.nodes = definition.nodes.filter((node) => ["route", "gold-email"].includes(node.id));

    expect(issues(ZWorkflowEnableDefinition.safeParse(definition))).toBe("");
  });

  test("its branches never join", () => {
    const definition = routing(undefined, [
      { id: "e1", source: "trigger", target: "route" },
      { id: "e2", source: "route", target: "gold-email", sourceHandle: "gold" },
      { id: "e3", source: "route", target: "gold-email", sourceHandle: "silver" },
    ]);
    definition.nodes = definition.nodes.filter((node) => ["route", "gold-email"].includes(node.id));

    expect(issues(ZWorkflowDefinitionInput.safeParse(definition))).toMatch(/branches never join/);
  });
});
