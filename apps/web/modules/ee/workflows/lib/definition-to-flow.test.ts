import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import { WORKFLOW_CANVAS_START_POSITION, getCanvasDirection } from "./canvas-geometry";
import {
  WORKFLOW_BRANCH_NODE_TYPE,
  haveSameNodePositions,
  reorganizeWorkflowDefinition,
  snapWorkflowNodePosition,
  updateNodePosition,
  withBranchLegOffsets,
  workflowDefinitionToFlowEdges,
  workflowDefinitionToFlowNodes,
} from "./definition-to-flow";

const t = ((key: string) => key) as unknown as TFunction;

const buildDefinition = (overrides?: Partial<TWorkflowDefinition>): TWorkflowDefinition => ({
  schemaVersion: 1,
  entryNodeId: "trigger-1",
  trigger: {
    id: "trigger-1",
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId: "u9aohwvk1n3e0gms8p2q6lwt", endingCardIds: [] },
    ui: { position: { x: 0, y: 0 } },
  },
  nodes: [
    {
      id: "action-1",
      type: "action",
      actionType: "send_email",
      label: "Send email",
      config: {
        to: "respondent@example.com",
        from: "team@example.com",
        replyTo: [],
        subject: "Thanks",
        body: "Body",
        attachResponseData: false,
      },
      ui: { position: { x: 0, y: 0 } },
    },
  ],
  edges: [{ id: "edge-1", source: "trigger-1", target: "action-1" }],
  ...overrides,
});

describe("snapWorkflowNodePosition", () => {
  test("snaps to the 20px grid", () => {
    expect(snapWorkflowNodePosition({ x: 7, y: 31 })).toEqual({ x: 0, y: 40 });
    expect(snapWorkflowNodePosition({ x: 31, y: 49 })).toEqual({ x: 40, y: 40 });
  });
});

describe("updateNodePosition", () => {
  test("updates trigger position when id matches", () => {
    const def = buildDefinition();
    const next = updateNodePosition(def, "trigger-1", { x: 100, y: 80 });
    expect(next.trigger?.ui?.position).toEqual({ x: 100, y: 80 });
    expect(next.nodes[0].ui?.position).toEqual({ x: 0, y: 0 });
  });

  test("updates child-node position when id matches", () => {
    const def = buildDefinition();
    const next = updateNodePosition(def, "action-1", { x: 220, y: 240 });
    expect(next.trigger?.ui?.position).toEqual({ x: 0, y: 0 });
    expect(next.nodes[0].ui?.position).toEqual({ x: 220, y: 240 });
  });
});

describe("workflowDefinitionToFlowNodes / Edges", () => {
  test("projects trigger and child nodes with registry metadata", () => {
    const def = buildDefinition();
    const nodes = workflowDefinitionToFlowNodes(def, t);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({
      id: "trigger-1",
      data: { category: "trigger", icon: "survey", title: "workspace.workflows.response_completed" },
    });
    expect(nodes[1]).toMatchObject({
      id: "action-1",
      data: { category: "action", icon: "email" },
    });
  });

  test("flags no issues by default (survey resolution unknown)", () => {
    const nodes = workflowDefinitionToFlowNodes(buildDefinition(), t);
    expect(nodes.map((node) => node.data.issue)).toEqual([null, null]);
  });

  test("flags only the trigger when the bound survey doesn't resolve (sequential guidance)", () => {
    const nodes = workflowDefinitionToFlowNodes(buildDefinition(), t, {
      hasBoundSurvey: false,
      isDraft: true,
    });
    expect(nodes[0].data.issue).toEqual({
      severity: "setup",
      label: "workspace.workflows.node_needs_survey",
    });
    expect(nodes[1].data.issue).toBeNull();
  });

  test("a Webhook trigger has no survey to pick, so neither it nor its email waits for one", () => {
    const def = buildDefinition();
    def.trigger = { id: "trigger-1", type: "trigger", triggerType: "webhook", config: {} };
    (def.nodes[0] as { config: { subject: string } }).config.subject = "";

    const nodes = workflowDefinitionToFlowNodes(def, t, { hasBoundSurvey: false, isDraft: true });

    expect(nodes[0].data.issue).toBeNull();
    expect(nodes[1].data.issue).toEqual({
      severity: "setup",
      label: "workspace.workflows.node_needs_email_content",
    });
  });

  test("shows the trigger summary the canvas worked out from the Webhook sample", () => {
    const def = buildDefinition();
    def.trigger = { id: "trigger-1", type: "trigger", triggerType: "webhook", config: {} };

    const nodes = workflowDefinitionToFlowNodes(def, t, { triggerSummary: "Sample received · 9 Variables" });

    expect(nodes[0].data.summary).toBe("Sample received · 9 Variables");
  });

  test("flags an incomplete email node once the survey is bound, with error severity when live", () => {
    const def = buildDefinition();
    (def.nodes[0] as { config: { to: string } }).config.to = "";
    const nodes = workflowDefinitionToFlowNodes(def, t, { hasBoundSurvey: true, isDraft: false });
    expect(nodes[0].data.issue).toBeNull();
    expect(nodes[1].data.issue).toEqual({
      severity: "error",
      label: "workspace.workflows.node_needs_email_content",
    });
  });

  test("flags an email node whose subject is blank (parity with the executable schema)", () => {
    const def = buildDefinition();
    (def.nodes[0] as { config: { subject: string } }).config.subject = "   ";
    const nodes = workflowDefinitionToFlowNodes(def, t, { hasBoundSurvey: true, isDraft: true });
    expect(nodes[1].data.issue).toEqual({
      severity: "setup",
      label: "workspace.workflows.node_needs_email_content",
    });
  });

  test("flags an email node whose body is only the editor's empty markup", () => {
    // The rich-text editor keeps the enclosing block when the body is emptied, so a trim-based
    // check would clear the flag on a step that has nothing to send.
    const def = buildDefinition();
    (def.nodes[0] as { config: { body: string } }).config.body = '<p class="fb-editor-paragraph"><br></p>';
    const nodes = workflowDefinitionToFlowNodes(def, t, { hasBoundSurvey: true, isDraft: true });
    expect(nodes[1].data.issue).toEqual({
      severity: "setup",
      label: "workspace.workflows.node_needs_email_content",
    });
  });

  test("projects edges with sourceHandle preserved", () => {
    const def = buildDefinition({
      edges: [{ id: "edge-1", source: "trigger-1", target: "action-1", sourceHandle: "then" }],
    });
    const edges = workflowDefinitionToFlowEdges(def);
    expect(edges[0]).toMatchObject({
      id: "edge-1",
      source: "trigger-1",
      target: "action-1",
      sourceHandle: "then",
      type: "addButton",
    });
  });
});

describe("reorganizeWorkflowDefinition", () => {
  test("ranks reachable nodes by BFS distance from the trigger", () => {
    const def = buildDefinition();
    const next = reorganizeWorkflowDefinition(def);
    const triggerY = next.trigger?.ui?.position?.y ?? 0;
    const actionY = next.nodes[0].ui?.position?.y ?? 0;
    expect(actionY).toBeGreaterThan(triggerY);
  });

  test("places unreachable nodes below the reachable graph", () => {
    const base = buildDefinition();
    const orphan = { ...base.nodes[0], id: "orphan", ui: undefined } as (typeof base.nodes)[number];
    const def: TWorkflowDefinition = { ...base, nodes: [...base.nodes, orphan] };

    const next = reorganizeWorkflowDefinition(def);
    const reachableY = next.nodes[0].ui?.position?.y ?? 0;
    const orphanY = next.nodes[1].ui?.position?.y ?? 0;
    expect(orphanY).toBeGreaterThan(reachableY);
  });

  test("left to right, each step sits to the right of the one before it", () => {
    const next = reorganizeWorkflowDefinition(buildDefinition(), "horizontal");
    const trigger = next.trigger?.ui?.position;
    const action = next.nodes[0].ui?.position;

    expect(action?.x).toBeGreaterThan(trigger?.x ?? 0);
    expect(action?.y).toBe(trigger?.y);
  });

  test("a workflow reads the way it saved, and top to bottom when it saved none", () => {
    const definition = buildDefinition();

    expect(getCanvasDirection(definition)).toBe("vertical");
    expect(getCanvasDirection({ ...definition, ui: { direction: "horizontal" } })).toBe("horizontal");
  });

  test("arranging an arranged workflow moves nothing, which Auto layout reports as already arranged", () => {
    const arranged = reorganizeWorkflowDefinition(buildDefinition());

    expect(haveSameNodePositions(arranged, reorganizeWorkflowDefinition(arranged))).toBe(true);
    const moved = {
      ...arranged,
      nodes: arranged.nodes.map((node) => ({ ...node, ui: { position: { x: 999, y: 999 } } })),
    } as TWorkflowDefinition;
    expect(haveSameNodePositions(moved, reorganizeWorkflowDefinition(moved))).toBe(false);
  });
});

const emailNode = (id: string) =>
  ({
    id,
    type: "action",
    actionType: "send_email",
    config: {
      to: "respondent@example.com",
      from: "team@example.com",
      replyTo: [],
      subject: "Thanks",
      body: "Body",
      attachResponseData: false,
    },
    ui: { position: { x: 0, y: 0 } },
  }) as TWorkflowDefinition["nodes"][number];

const ifElseNode = (id: string) =>
  ({
    id,
    type: "if_else",
    config: {
      condition: {
        id: `${id}-group`,
        connector: "and",
        conditions: [
          { id: `${id}-c1`, left: { path: "payload.channel" }, operator: "equals", right: "call" },
        ],
      },
    },
    ui: { position: { x: 0, y: 0 } },
  }) as TWorkflowDefinition["nodes"][number];

// trigger → if-1; Then → email-a; Else is empty.
const branchDefinition = () =>
  buildDefinition({
    nodes: [ifElseNode("if-1"), emailNode("email-a")],
    edges: [
      { id: "e-trigger", source: "trigger-1", target: "if-1" },
      { id: "e-then", source: "if-1", target: "email-a", sourceHandle: "then" },
    ],
  });

describe("If/else on the canvas", () => {
  test("projects an If/else as a branch node that knows which branch is still empty", () => {
    const nodes = workflowDefinitionToFlowNodes(branchDefinition(), t);
    const branchNode = nodes.find((node) => node.id === "if-1");
    expect(branchNode?.type).toBe(WORKFLOW_BRANCH_NODE_TYPE);
    expect(branchNode?.data.emptyBranches).toEqual(["else"]);
  });

  test("lays out steps saved without positions (API, MCP) as a tree, so branches sit side by side", () => {
    const withoutUi = <T extends { ui?: unknown }>(node: T): T => ({ ...node, ui: undefined });
    const definition = buildDefinition({
      nodes: [ifElseNode("if-1"), emailNode("email-a"), emailNode("email-b")].map(withoutUi),
      edges: [
        { id: "e-trigger", source: "trigger-1", target: "if-1" },
        { id: "e-then", source: "if-1", target: "email-a", sourceHandle: "then" },
        { id: "e-else", source: "if-1", target: "email-b", sourceHandle: "else" },
      ],
    });
    definition.trigger = withoutUi(definition.trigger!);

    const byId = Object.fromEntries(
      workflowDefinitionToFlowNodes(definition, t).map((node) => [node.id, node.position])
    );

    expect(byId["email-a"].y).toBe(byId["email-b"].y);
    expect(byId["email-a"].x).toBeLessThan(byId["email-b"].x);
    expect(byId["email-a"].y).toBeGreaterThan(byId["if-1"].y);
    expect(byId["if-1"].y).toBeGreaterThan(byId["trigger-1"].y);
  });

  test("offers a + under the last step of the workflow or of a branch, never mid-chain", () => {
    const linear = workflowDefinitionToFlowNodes(buildDefinition(), t);
    expect(linear.map((node) => node.data.canAppendStep)).toEqual([false, true]);

    const branched = workflowDefinitionToFlowNodes(branchDefinition(), t);
    const canAppendById = Object.fromEntries(branched.map((node) => [node.id, node.data.canAppendStep]));
    expect(canAppendById).toEqual({ "trigger-1": false, "if-1": false, "email-a": true });

    const triggerOnly = workflowDefinitionToFlowNodes(buildDefinition({ nodes: [], edges: [] }), t);
    expect(triggerOnly[0].data.canAppendStep).toBe(true);
  });

  test("draws the edges out of an If/else as branch edges and leaves other edges as they were", () => {
    const edges = workflowDefinitionToFlowEdges(branchDefinition());
    expect(edges.find((edge) => edge.id === "e-then")).toMatchObject({
      type: "branch",
      sourceHandle: "then",
    });
    expect(edges.find((edge) => edge.id === "e-trigger")).toMatchObject({ type: "addButton" });
  });

  test("auto layout keeps a linear workflow where it always was", () => {
    const next = reorganizeWorkflowDefinition(buildDefinition());
    expect(next.trigger?.ui?.position).toEqual({ x: 220, y: 80 });
    expect(next.nodes[0].ui?.position).toEqual({ x: 220, y: 200 });
  });

  test("auto layout puts Then on the left and Else on the right, widening for a nested If/else", () => {
    // trigger → if-1; Then → email-a; Else → if-2 (Then → email-b, Else → email-c).
    const def = buildDefinition({
      nodes: [
        ifElseNode("if-1"),
        emailNode("email-a"),
        ifElseNode("if-2"),
        emailNode("email-b"),
        emailNode("email-c"),
      ],
      edges: [
        { id: "e1", source: "trigger-1", target: "if-1" },
        { id: "e2", source: "if-1", target: "if-2", sourceHandle: "else" },
        { id: "e3", source: "if-1", target: "email-a", sourceHandle: "then" },
        { id: "e4", source: "if-2", target: "email-b", sourceHandle: "then" },
        { id: "e5", source: "if-2", target: "email-c", sourceHandle: "else" },
      ],
    });

    const next = reorganizeWorkflowDefinition(def);
    const positions = Object.fromEntries(next.nodes.map((node) => [node.id, node.ui?.position]));
    expect(next.trigger?.ui?.position).toEqual({ x: 220, y: 80 });
    expect(positions).toEqual({
      "if-1": { x: 220, y: 200 },
      "email-a": { x: -140, y: 400 },
      "if-2": { x: 400, y: 400 },
      "email-b": { x: 220, y: 600 },
      "email-c": { x: 580, y: 600 },
    });
  });
});

describe("withBranchLegOffsets", () => {
  // trigger → if-1; Then → email-a; Else → if-2 (Then → email-b, Else → email-c), auto-laid out.
  const nestedFlow = () => {
    const definition = reorganizeWorkflowDefinition(
      buildDefinition({
        nodes: [
          ifElseNode("if-1"),
          emailNode("email-a"),
          ifElseNode("if-2"),
          emailNode("email-b"),
          emailNode("email-c"),
        ],
        edges: [
          { id: "e1", source: "trigger-1", target: "if-1" },
          { id: "e2", source: "if-1", target: "if-2", sourceHandle: "else" },
          { id: "e3", source: "if-1", target: "email-a", sourceHandle: "then" },
          { id: "e4", source: "if-2", target: "email-b", sourceHandle: "then" },
          { id: "e5", source: "if-2", target: "email-c", sourceHandle: "else" },
        ],
      })
    );
    return { definition, nodes: workflowDefinitionToFlowNodes(definition, t) };
  };
  const legsById = (nodes: ReturnType<typeof withBranchLegOffsets>) =>
    Object.fromEntries(nodes.map((node) => [node.id, node.data.legOffsets]));

  test("puts each leg of a fork straight above its branch's first step after auto layout", () => {
    const { definition, nodes } = nestedFlow();
    expect(legsById(withBranchLegOffsets(nodes, definition.edges))).toEqual({
      "trigger-1": undefined,
      // Then's step is one and a half columns left of the If/else: its sibling If/else is two wide.
      "if-1": [-360, 180],
      "if-2": [-180, 180],
      "email-a": undefined,
      "email-b": undefined,
      "email-c": undefined,
    });
  });

  test("follows a branch's step the user dragged, so its line stays straight", () => {
    const { definition, nodes } = nestedFlow();
    const dragged = nodes.map((node) =>
      node.id === "email-a" ? { ...node, position: { x: -300, y: 460 } } : node
    );
    expect(legsById(withBranchLegOffsets(dragged, definition.edges))["if-1"]).toEqual([-520, 180]);
  });

  test("holds a fork's legs still while a branch's step is being moved onto a `+`", () => {
    const { definition, nodes } = nestedFlow();
    const emailA = nodes.find((node) => node.id === "email-a")!;
    const dragged = nodes.map((node) =>
      node.id === "email-a" ? { ...node, position: { x: 600, y: 460 } } : node
    );
    const frozen = { id: "email-a", position: emailA.position };
    expect(legsById(withBranchLegOffsets(dragged, definition.edges, "vertical", frozen))["if-1"]).toEqual([
      -360, 180,
    ]);
  });

  test("gives an empty branch its own leg beside the other one", () => {
    const definition = branchDefinition();
    const nodes = workflowDefinitionToFlowNodes(definition, t).map((node) =>
      node.id === "email-a" ? { ...node, position: { x: -180, y: 200 } } : node
    );
    // if-1 sits at x 0; Then's step at -180; Else is empty.
    expect(legsById(withBranchLegOffsets(nodes, definition.edges))["if-1"]).toEqual([-180, 180]);
  });

  test("leaves steps without branches untouched", () => {
    const definition = buildDefinition();
    const nodes = workflowDefinitionToFlowNodes(definition, t);
    const next = withBranchLegOffsets(nodes, definition.edges);
    expect(next[0]).toBe(nodes[0]);
    expect(next[1]).toBe(nodes[1]);
  });
});

const switchNode = (id: string, caseNames: string[]) =>
  ({
    id,
    type: "switch",
    config: {
      left: { path: "payload.customer.tier" },
      cases: caseNames.map((name, index) => ({
        id: `${id}-case-${index}`,
        name,
        operator: "equals",
        right: name.toLowerCase(),
      })),
    },
    ui: { position: { x: 0, y: 0 } },
  }) as TWorkflowDefinition["nodes"][number];

describe("Switch on the canvas", () => {
  // trigger → route; Gold → email-g, the unnamed case and Default empty.
  const routing = () =>
    buildDefinition({
      nodes: [switchNode("route", ["Gold", " "]), emailNode("email-g")],
      edges: [
        { id: "e-trigger", source: "trigger-1", target: "route" },
        { id: "e-gold", source: "route", target: "email-g", sourceHandle: "route-case-0" },
      ],
    });

  test("projects a Switch as a branch node with one labelled path per case and Default, in order", () => {
    const route = workflowDefinitionToFlowNodes(routing(), t).find((node) => node.id === "route");

    expect(route?.type).toBe(WORKFLOW_BRANCH_NODE_TYPE);
    expect(route?.data.branches.map(({ handle, label }) => ({ handle, label }))).toEqual([
      { handle: "route-case-0", label: "Gold" },
      // A case without a name yet reads by its number.
      { handle: "route-case-1", label: "workspace.workflows.switch_case_name_default" },
      { handle: "default", label: "workspace.workflows.switch_default" },
    ]);
    expect(route?.data.emptyBranches).toEqual(["route-case-1", "default"]);
    expect(route?.data.canAppendStep).toBe(false);
  });

  test("draws the edges out of a Switch as branch edges", () => {
    expect(workflowDefinitionToFlowEdges(routing()).find((edge) => edge.id === "e-gold")).toMatchObject({
      type: "branch",
      sourceHandle: "route-case-0",
    });
  });

  test("auto layout puts each case's branch in its own column, left to right, Default last", () => {
    const def = buildDefinition({
      nodes: [switchNode("route", ["Gold", "Silver"]), emailNode("email-d"), emailNode("email-g")],
      edges: [
        { id: "e1", source: "trigger-1", target: "route" },
        { id: "e2", source: "route", target: "email-d", sourceHandle: "default" },
        { id: "e3", source: "route", target: "email-g", sourceHandle: "route-case-0" },
      ],
    });

    const next = reorganizeWorkflowDefinition(def);
    const positions = Object.fromEntries(next.nodes.map((node) => [node.id, node.ui?.position]));
    // Three columns centered under the Switch: Gold, Silver (empty), Default.
    expect(positions).toEqual({
      route: { x: 220, y: 200 },
      "email-g": { x: -140, y: 400 },
      "email-d": { x: 580, y: 400 },
    });
  });
});

describe("workflowDefinitionToFlowNodes fallback", () => {
  test("places a step without ui.position where the tree layout puts it", () => {
    const base = buildDefinition();
    const triggerWithoutUi = { ...base.trigger, ui: undefined };
    const def = { ...base, trigger: triggerWithoutUi } as TWorkflowDefinition;
    const nodes = workflowDefinitionToFlowNodes(def, t);
    expect(nodes[0].position).toEqual(snapWorkflowNodePosition(WORKFLOW_CANVAS_START_POSITION));
    // A step that has a position keeps it.
    expect(nodes[1].position).toEqual(def.nodes[0].ui?.position);
  });
});

describe("trigger-less draft definitions", () => {
  const emptyDefinition = buildDefinition({
    trigger: null,
    nodes: [],
    edges: [],
    entryNodeId: null,
  });

  test("project to zero flow nodes and edges", () => {
    expect(workflowDefinitionToFlowNodes(emptyDefinition, t)).toEqual([]);
    expect(workflowDefinitionToFlowEdges(emptyDefinition)).toEqual([]);
  });

  test("updateNodePosition and reorganize are no-op safe", () => {
    expect(updateNodePosition(emptyDefinition, "anything", { x: 1, y: 1 }).trigger).toBeNull();
    expect(reorganizeWorkflowDefinition(emptyDefinition).trigger).toBeNull();
  });
});

describe("step Variables in If/else summaries", () => {
  // Interpolates the words, so the test reads the names the summary was given.
  const tWithValues = ((key: string, values?: Record<string, unknown>) =>
    `${key} ${JSON.stringify(values ?? {})}`) as unknown as TFunction;

  const definition = () =>
    buildDefinition({
      nodes: [
        { ...emailNode("crm"), label: "Log the visit in the CRM" },
        {
          ...ifElseNode("if-1"),
          config: {
            condition: {
              id: "g",
              connector: "and",
              conditions: [
                { id: "c1", left: { path: "steps.crm.body.json.club" }, operator: "equals", right: "Mitte" },
              ],
            },
          },
        } as TWorkflowDefinition["nodes"][number],
      ],
      edges: [
        { id: "e1", source: "trigger-1", target: "crm" },
        { id: "e2", source: "crm", target: "if-1" },
      ],
    });

  test("the chip shows the field as the picker does, never the step's id", () => {
    const node = workflowDefinitionToFlowNodes(definition(), tWithValues).find((item) => item.id === "if-1");
    const chips = node?.data.summaryParts?.filter((part) => part.kind === "reference");
    expect(chips?.map((part) => (part.kind === "reference" ? part.chip.label : ""))).toEqual([
      "body.json.club",
    ]);
  });

  test("the plain summary, the card's tooltip, names the step and the field", () => {
    const node = workflowDefinitionToFlowNodes(definition(), tWithValues).find((item) => item.id === "if-1");
    expect(node?.data.summary).toContain("Log the visit in the CRM · body.json.club");
    expect(node?.data.summary).not.toContain("steps.crm");
  });
});
