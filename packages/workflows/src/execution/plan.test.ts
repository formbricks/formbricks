import { describe, expect, test } from "vitest";
import type { TWorkflowExecutableDefinition } from "../types/document";
import { WorkflowPlanError, planExecutableSteps } from "./plan";

const sendEmailNode = (id: string): TWorkflowExecutableDefinition["nodes"][number] => ({
  id,
  type: "action",
  actionType: "send_email",
  label: "Send email",
  config: {
    to: "{{response.email}}",
    from: "noreply@example.com",
    replyTo: ["support@example.com"],
    subject: "Thanks",
    body: "Body",
    attachResponseData: false,
  },
});

const baseDefinition = (
  overrides: Partial<TWorkflowExecutableDefinition> = {}
): TWorkflowExecutableDefinition =>
  ({
    schemaVersion: 1,
    entryNodeId: "trigger",
    trigger: {
      id: "trigger",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId: "cm9zr4mps000008l8btfy1vtz", endingCardIds: [] },
    },
    nodes: [sendEmailNode("send-email")],
    edges: [{ id: "e1", source: "trigger", target: "send-email" }],
    ...overrides,
  }) as TWorkflowExecutableDefinition;

describe("planExecutableSteps", () => {
  test("returns the single send_email step for a linear trigger -> action graph", () => {
    const steps = planExecutableSteps(baseDefinition());
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ stepId: "send-email", stepType: "send_email" });
  });

  test("walks a chain of send_email actions in run order", () => {
    const definition = baseDefinition({
      nodes: [sendEmailNode("a"), sendEmailNode("b")],
      edges: [
        { id: "e1", source: "trigger", target: "a" },
        { id: "e2", source: "a", target: "b" },
      ],
    });

    const steps = planExecutableSteps(definition);
    expect(steps.map((step) => step.stepId)).toEqual(["a", "b"]);
  });

  test("returns no steps for a trigger with no outgoing edge", () => {
    const definition = baseDefinition({ nodes: [], edges: [] });
    expect(planExecutableSteps(definition)).toEqual([]);
  });

  test("throws when an edge targets a missing node", () => {
    const definition = baseDefinition({
      nodes: [],
      edges: [{ id: "e1", source: "trigger", target: "ghost" }],
    });
    expect(() => planExecutableSteps(definition)).toThrow(WorkflowPlanError);
  });

  test("throws when a node has more than one outgoing edge", () => {
    const definition = baseDefinition({
      nodes: [sendEmailNode("a"), sendEmailNode("b")],
      edges: [
        { id: "e1", source: "trigger", target: "a" },
        { id: "e2", source: "trigger", target: "b" },
      ],
    });
    expect(() => planExecutableSteps(definition)).toThrow(/more than one outgoing edge/);
  });

  test("throws when a reachable node is not a send_email action", () => {
    const definition = baseDefinition({
      nodes: [
        { id: "x", type: "if_else", config: {} } as unknown as TWorkflowExecutableDefinition["nodes"][number],
      ],
      edges: [{ id: "e1", source: "trigger", target: "x" }],
    });
    expect(() => planExecutableSteps(definition)).toThrow(/not an executable send_email action/);
  });
});
