import { describe, expect, test } from "vitest";
import {
  type TWorkflowDefinition,
  type TWorkflowSwitchNode,
  WORKFLOW_TRIGGERS,
  ZWorkflowDefinitionInput,
  getWorkflowNodeIdProblem,
} from "@formbricks/workflows";
import { createDefaultTrigger } from "./default-workflow";
import {
  countStepsOnBranches,
  countStepsOnSwitchCase,
  createDefaultWorkflowStep,
  getBranchLegOffset,
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

describe("getBranchLegOffset", () => {
  const at = (node: TWorkflowDefinition["nodes"][number], x: number) => ({
    ...node,
    ui: { position: { x, y: 0 } },
  });

  test("places the legs of a fork with no steps one column apart, centred under it", () => {
    const definition: TWorkflowDefinition = {
      ...routing(),
      nodes: [at(route, 220)],
      edges: [],
    };
    expect(getBranchLegOffset(definition, at(route, 220), "gold")).toBe(-360);
    expect(getBranchLegOffset(definition, at(route, 220), "default")).toBe(360);
  });

  test("puts an empty leg one column beside a neighbour's step, wherever that step was placed", () => {
    // Gold's and Default's steps sit where the user dragged them; Silver is empty.
    const definition: TWorkflowDefinition = {
      ...routing(),
      nodes: [at(route, 220), at(email("g"), -240), at(email("d"), 700)],
      edges: [
        { id: "e2", source: "route", target: "g", sourceHandle: "gold" },
        { id: "e5", source: "route", target: "d", sourceHandle: "default" },
      ],
    };
    expect(getBranchLegOffset(definition, at(route, 220), "gold")).toBe(-460);
    expect(getBranchLegOffset(definition, at(route, 220), "silver")).toBe(-100);
    expect(getBranchLegOffset(definition, at(route, 220), "default")).toBe(480);
  });

  test("is null for a step without branches or an unknown branch", () => {
    expect(getBranchLegOffset(routing(), email("e"), "then")).toBeNull();
    expect(getBranchLegOffset(routing(), route, "missing")).toBeNull();
  });
});

describe("generated node ids", () => {
  // Saving refuses an id outside letters, digits, _ and - or a reserved step id; the editor's must never be one.
  test.each(["if_else", "filter", "switch", "send_email", "http_request"] as const)(
    "a new %s step gets an id saving accepts",
    (stepType) => {
      const { id } = createDefaultWorkflowStep(stepType, { x: 0, y: 0 });
      expect(getWorkflowNodeIdProblem(id, "step")).toBeNull();
    }
  );

  test.each(Object.values(WORKFLOW_TRIGGERS))("a new %s trigger gets an id saving accepts", (triggerType) => {
    expect(getWorkflowNodeIdProblem(createDefaultTrigger(triggerType).id, "trigger")).toBeNull();
  });
});
