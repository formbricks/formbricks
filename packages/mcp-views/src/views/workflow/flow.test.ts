import { describe, expect, test } from "vitest";
import { buildFlow, buildStepNames } from "./flow";
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from "./model";

const trigger: WorkflowNode = {
  id: "t",
  type: "trigger",
  triggerType: "response.completed",
  config: { surveyId: "s", endingCardIds: [] },
};
const mail = (id: string, label?: string): WorkflowNode => ({
  id,
  type: "action",
  actionType: "send_email",
  label,
  config: { to: "a@b.co", subject: "S", body: "<p>B</p>" },
});
const branch = (id: string): WorkflowNode => ({
  id,
  type: "if_else",
  config: {
    condition: {
      id: "g",
      connector: "and",
      conditions: [{ id: "c", left: { path: "x" }, operator: "exists" }],
    },
  },
});
const edge = (source: string, target: string, sourceHandle?: string): WorkflowEdge => ({
  source,
  target,
  sourceHandle,
});

const flowOf = (definition: Partial<WorkflowDefinition>) =>
  buildFlow({ trigger, nodes: [], edges: [], ...definition });

describe("buildFlow", () => {
  test("follows the trigger through each step in order", () => {
    const flow = flowOf({
      nodes: [mail("a", "First"), mail("b", "Second")],
      edges: [edge("t", "a"), edge("a", "b")],
    });

    expect(flow.steps.map((step) => [step.kind, step.title])).toEqual([
      ["trigger", "Trigger"],
      ["action", "First"],
      ["action", "Second"],
    ]);
    expect(flow.unconnected).toEqual([]);
  });

  test("shows a condition's two outcomes as branches, each with its own steps", () => {
    const flow = flowOf({
      nodes: [branch("if"), mail("yes"), mail("no1"), mail("no2")],
      edges: [edge("t", "if"), edge("if", "yes", "then"), edge("if", "no1", "else"), edge("no1", "no2")],
    });

    const condition = flow.steps[1];
    expect(condition.kind).toBe("condition");
    if (condition.kind !== "condition") return;
    expect(condition.branches.map((b) => [b.label, b.steps.map((s) => s.id)])).toEqual([
      ["If the conditions match", ["yes"]],
      ["Otherwise", ["no1", "no2"]],
    ]);
  });

  test("leaves an unwired outcome empty instead of inventing a step", () => {
    const flow = flowOf({
      nodes: [branch("if"), mail("yes")],
      edges: [edge("t", "if"), edge("if", "yes", "then")],
    });
    const condition = flow.steps[1];
    if (condition.kind !== "condition") throw new Error("expected a condition");
    expect(condition.branches[1].steps).toEqual([]);
  });

  test("lists steps nothing reaches apart from the flow", () => {
    const flow = flowOf({ nodes: [mail("a"), mail("lonely", "Lonely")], edges: [edge("t", "a")] });
    expect(flow.steps.map((s) => s.id)).toEqual(["t", "a"]);
    expect(flow.unconnected.map((s) => s.title)).toEqual(["Lonely"]);
  });

  test("shows a step reached twice once, then refers back to it", () => {
    const flow = flowOf({
      nodes: [branch("if"), mail("shared"), mail("other")],
      edges: [
        edge("t", "if"),
        edge("if", "shared", "then"),
        edge("if", "other", "else"),
        edge("other", "shared"),
      ],
    });
    const condition = flow.steps[1];
    if (condition.kind !== "condition") throw new Error("expected a condition");
    expect(condition.branches[1].steps.map((s) => s.kind)).toEqual(["action", "reference"]);
  });

  test("terminates on a cycle and on an edge to a node that does not exist", () => {
    const cyclic = flowOf({
      nodes: [mail("a"), mail("b")],
      edges: [edge("t", "a"), edge("a", "b"), edge("b", "a")],
    });
    expect(cyclic.steps.map((s) => s.kind)).toEqual(["trigger", "action", "action", "reference"]);

    const dangling = flowOf({ nodes: [mail("a")], edges: [edge("t", "a"), edge("a", "gone")] });
    expect(dangling.steps.map((s) => s.id)).toEqual(["t", "a"]);
  });

  test("has no steps while the draft has no trigger, and lists its nodes as unconnected", () => {
    const flow = buildFlow({ trigger: null, nodes: [mail("a")], edges: [] });
    expect(flow.steps).toEqual([]);
    expect(flow.unconnected).toHaveLength(1);
  });
});

describe("buildStepNames", () => {
  test("names steps by label, falling back to their type", () => {
    const names = buildStepNames({ trigger, nodes: [mail("a", "Thank you"), mail("b")], edges: [] });
    expect(names.get("a")).toBe("Thank you");
    expect(names.get("b")).toBe("Send email");
    expect(names.get("t")).toBe("Trigger");
  });
});
