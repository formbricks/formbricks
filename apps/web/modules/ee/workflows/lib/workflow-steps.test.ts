import { describe, expect, test } from "vitest";
import {
  type TWorkflowDefinition,
  type TWorkflowSwitchNode,
  ZWorkflowDefinitionInput,
} from "@formbricks/workflows";
import {
  countStepsOnBranches,
  countStepsOnSwitchCase,
  createDefaultWorkflowStep,
  getBranchLeg,
  getDefaultConditionPath,
  removeBranchingStepWithBranches,
  withSwitchBranchesPruned,
} from "./workflow-steps";

describe("getDefaultConditionPath", () => {
  test("starts a new If/else on the first Variable that can be picked", () => {
    expect(
      getDefaultConditionPath([
        {
          kind: "payload",
          hasSample: true,
          truncated: false,
          options: [
            { path: "payload.tags", label: "tags", typeHint: "list", isPickable: false },
            { path: "payload.channel", label: "channel", typeHint: "text", isPickable: true },
          ],
        },
      ])
    ).toBe("payload.channel");
  });

  test("falls back to a placeholder before any Variable is known", () => {
    expect(
      getDefaultConditionPath([{ kind: "payload", hasSample: false, truncated: false, options: [] }])
    ).toBe("payload.value");
  });
});

const email = (id: string) =>
  ({
    id,
    type: "action",
    actionType: "send_email",
    config: {
      to: "",
      from: "team@example.com",
      replyTo: [],
      subject: "",
      body: "",
      attachResponseData: false,
    },
  }) as TWorkflowDefinition["nodes"][number];

const route: TWorkflowSwitchNode = {
  id: "route",
  type: "switch",
  config: {
    left: { path: "payload.customer.tier" },
    cases: [
      { id: "gold", name: "Gold", operator: "equals", right: "gold" },
      { id: "silver", name: "Silver", operator: "equals", right: "silver" },
    ],
  },
};

// trigger → before → route; Gold → g → g2; Silver → s; Default → d.
const routing = (): TWorkflowDefinition => ({
  schemaVersion: 1,
  entryNodeId: "trigger",
  trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {} },
  nodes: [email("before"), route, email("g"), email("g2"), email("s"), email("d")],
  edges: [
    { id: "e0", source: "trigger", target: "before" },
    { id: "e1", source: "before", target: "route" },
    { id: "e2", source: "route", target: "g", sourceHandle: "gold" },
    { id: "e3", source: "g", target: "g2" },
    { id: "e4", source: "route", target: "s", sourceHandle: "silver" },
    { id: "e5", source: "route", target: "d", sourceHandle: "default" },
  ],
});

describe("a new Switch", () => {
  test("starts with two named cases on the given Variable and saves as a draft", () => {
    const node = createDefaultWorkflowStep(
      "switch",
      { x: 0, y: 0 },
      { conditionPath: "payload.customer.tier", caseName: (number) => `Case ${number}` }
    );
    const definition: TWorkflowDefinition = {
      ...routing(),
      nodes: [node],
      edges: [{ id: "e", source: "trigger", target: node.id }],
    };

    expect(node).toMatchObject({
      type: "switch",
      config: {
        left: { path: "payload.customer.tier" },
        cases: [{ name: "Case 1" }, { name: "Case 2" }],
      },
    });
    expect(ZWorkflowDefinitionInput.safeParse(definition).success).toBe(true);
  });
});

describe("deleting a Switch", () => {
  test("counts and removes every step on its branches, keeping the steps before it", () => {
    expect(countStepsOnBranches(routing(), "route")).toBe(4);
    expect(countStepsOnBranches(routing(), "before")).toBe(0);

    const remaining = removeBranchingStepWithBranches(routing(), "route");
    expect(remaining.nodes.map((node) => node.id)).toEqual(["before"]);
    expect(remaining.edges.map((edge) => edge.id)).toEqual(["e0"]);
  });
});

describe("removing a case", () => {
  test("counts the steps on that case's branch only", () => {
    expect(countStepsOnSwitchCase(routing(), "route", "gold")).toBe(2);
    expect(countStepsOnSwitchCase(routing(), "route", "silver")).toBe(1);
  });

  test("drops the branch of a case the Switch no longer has, with its steps, and keeps Default", () => {
    const withoutGold: TWorkflowSwitchNode = {
      ...route,
      config: { ...route.config, cases: route.config.cases.filter((switchCase) => switchCase.id !== "gold") },
    };
    const definition = routing();
    definition.nodes = definition.nodes.map((node) => (node.id === "route" ? withoutGold : node));

    const next = withSwitchBranchesPruned(definition, withoutGold);
    expect(next.nodes.map((node) => node.id)).toEqual(["before", "route", "s", "d"]);
    expect(next.edges.map((edge) => edge.id)).toEqual(["e0", "e1", "e4", "e5"]);
  });
});

describe("getBranchLeg", () => {
  test("places each branch one column apart, centered under its step", () => {
    expect(getBranchLeg(route, "gold")).toEqual({ index: 0, count: 3 });
    expect(getBranchLeg(route, "default")).toEqual({ index: 2, count: 3 });
    expect(
      getBranchLeg({ id: "x", type: "if_else" } as TWorkflowDefinition["nodes"][number], "else")
    ).toEqual({
      index: 1,
      count: 2,
    });
    expect(getBranchLeg(email("e"), "then")).toBeNull();
  });
});
