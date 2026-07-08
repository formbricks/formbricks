import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import {
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
    expect(next.trigger.ui?.position).toEqual({ x: 100, y: 80 });
    expect(next.nodes[0].ui?.position).toEqual({ x: 0, y: 0 });
  });

  test("updates child-node position when id matches", () => {
    const def = buildDefinition();
    const next = updateNodePosition(def, "action-1", { x: 220, y: 240 });
    expect(next.trigger.ui?.position).toEqual({ x: 0, y: 0 });
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

  test("marks every node valid by default (survey resolution unknown)", () => {
    const nodes = workflowDefinitionToFlowNodes(buildDefinition(), t);
    expect(nodes.map((node) => node.data.isInvalid)).toEqual([false, false]);
  });

  test("flags the trigger and email node when the bound survey doesn't resolve", () => {
    const nodes = workflowDefinitionToFlowNodes(buildDefinition(), t, { hasBoundSurvey: false });
    expect(nodes.map((node) => node.data.isInvalid)).toEqual([true, true]);
  });

  test("flags an email node without recipient or body even with a bound survey", () => {
    const def = buildDefinition();
    (def.nodes[0] as { config: { to: string; body: string } }).config.to = "";
    const nodes = workflowDefinitionToFlowNodes(def, t, { hasBoundSurvey: true });
    expect(nodes[0].data.isInvalid).toBe(false);
    expect(nodes[1].data.isInvalid).toBe(true);
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
    const triggerY = next.trigger.ui?.position?.y ?? 0;
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

describe("workflowDefinitionToFlowNodes fallback", () => {
  test("falls back to a derived position when ui.position is missing", () => {
    const base = buildDefinition();
    const triggerWithoutUi = { ...base.trigger, ui: undefined };
    const def = { ...base, trigger: triggerWithoutUi } as TWorkflowDefinition;
    const nodes = workflowDefinitionToFlowNodes(def, t);
    expect(nodes[0].position).toEqual({ x: 120, y: 80 });
  });
});
