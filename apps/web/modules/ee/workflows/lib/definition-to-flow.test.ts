import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import {
  WORKFLOW_BRANCH_NODE_TYPE,
  reorganizeWorkflowDefinition,
  snapWorkflowNodePosition,
  updateNodePosition,
  workflowDefinitionToFlowEdges,
  workflowDefinitionToFlowNodes,
} from "./definition-to-flow";

const t = ((key: string) => key) as unknown as TFunction;

const buildDefinition = (overrides?: Partial<TWorkflowDefinition>): TWorkflowDefinition =>
  ({
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
  }) as TWorkflowDefinition;

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
      data: { category: "trigger", icon: "trigger", title: "workspace.workflows.response_completed" },
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

  test("offers a + under the last step of a branch, and still only under a leaf trigger outside one", () => {
    const linear = workflowDefinitionToFlowNodes(buildDefinition(), t);
    expect(linear.map((node) => node.data.canAppendStep)).toEqual([false, false]);

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

describe("workflowDefinitionToFlowNodes fallback", () => {
  test("falls back to a derived position when ui.position is missing", () => {
    const base = buildDefinition();
    const triggerWithoutUi = { ...base.trigger, ui: undefined };
    const def = { ...base, trigger: triggerWithoutUi } as TWorkflowDefinition;
    const nodes = workflowDefinitionToFlowNodes(def, t);
    expect(nodes[0].position).toEqual({ x: 120, y: 80 });
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
