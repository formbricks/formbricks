import { describe, expect, test } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import { getMoveTargetKey, getMoveTargets, getMovingStepIds, moveStep } from "./step-move";

type TNode = TWorkflowDefinition["nodes"][number];

const at = (y: number, x = 0) => ({ ui: { position: { x, y } } });

const email = (id: string, y: number, body = "Hi"): TNode =>
  ({
    id,
    type: "action",
    actionType: "send_email",
    config: { to: "team@example.com", from: "noreply@example.com", replyTo: [], subject: "S", body },
    ...at(y),
  }) as unknown as TNode;

const http = (id: string, y: number): TNode =>
  ({
    id,
    type: "action",
    actionType: "http_request",
    config: {
      method: "POST",
      url: "https://api.example.com/visits",
      queryParameters: [],
      headers: [],
      body: null,
      responseMode: "wait",
      continueOnError: false,
    },
    ...at(y),
  }) as unknown as TNode;

const condition = (id: string, type: "if_else" | "filter", y: number): TNode =>
  ({
    id,
    type,
    config: {
      condition: {
        id: `${id}-g`,
        connector: "and",
        conditions: [{ id: `${id}-c`, left: { path: "payload.plan" }, operator: "equals", right: "pro" }],
      },
    },
    ...at(y),
  }) as unknown as TNode;

// trigger → crm → branch (If/else): Then → a1 → a2; Else → b1. a1 reads the CRM call's status.
const definition = (): TWorkflowDefinition =>
  ({
    schemaVersion: 1,
    entryNodeId: "trigger",
    trigger: { id: "trigger", type: "trigger", triggerType: "webhook", config: {}, ...at(0) },
    nodes: [
      http("crm", 100),
      condition("branch", "if_else", 200),
      email("a1", 300, "Status #recall:steps.crm.status/fallback:#"),
      email("a2", 400),
      email("b1", 300),
    ],
    edges: [
      { id: "e1", source: "trigger", target: "crm" },
      { id: "e2", source: "crm", target: "branch" },
      { id: "e3", source: "branch", target: "a1", sourceHandle: "then" },
      { id: "e4", source: "a1", target: "a2" },
      { id: "e5", source: "branch", target: "b1", sourceHandle: "else" },
    ],
  }) as unknown as TWorkflowDefinition;

const move = (def: TWorkflowDefinition, stepId: string, target: Parameters<typeof getMoveTargetKey>[0]) =>
  moveStep({ definition: def, stepId, target, direction: "vertical" });

const hasEdge = (def: TWorkflowDefinition, source: string, target: string, sourceHandle?: string) =>
  def.edges.some(
    (edge) =>
      edge.source === source && edge.target === target && (edge.sourceHandle ?? undefined) === sourceHandle
  );

const positionOf = (def: TWorkflowDefinition, id: string) =>
  [def.trigger, ...def.nodes].find((node) => node?.id === id)!.ui!.position!;

describe("getMovingStepIds", () => {
  test("a plain step moves alone", () => {
    expect(getMovingStepIds(definition(), "a1")).toEqual(["a1"]);
  });

  test("an If/else moves with its branches", () => {
    expect(getMovingStepIds(definition(), "branch").sort()).toEqual(["a1", "a2", "b1", "branch"]);
  });

  test("a Filter moves with the steps it lets through", () => {
    const def = definition();
    def.nodes.push(condition("gate", "filter", 500), email("after", 600));
    def.edges.push({ id: "e6", source: "a2", target: "gate" }, { id: "e7", source: "gate", target: "after" });
    expect(getMovingStepIds(def, "gate")).toEqual(["gate", "after"]);
  });

  test("the trigger never moves", () => {
    expect(getMovingStepIds(definition(), "trigger")).toEqual([]);
  });
});

describe("getMoveTargets", () => {
  test("every + but the step's own place, in the order the tree reads", () => {
    expect(getMoveTargets(definition(), "a1").map(getMoveTargetKey)).toEqual([
      "edge:e1",
      "edge:e2",
      "end:a2:",
      "edge:e5",
      "end:b1:",
    ]);
  });

  test("an If/else can't go inside its own branches", () => {
    expect(getMoveTargets(definition(), "branch").map(getMoveTargetKey)).toEqual(["edge:e1"]);
  });

  test("offers an empty branch's + and none for the trigger", () => {
    const def = definition();
    def.nodes = def.nodes.filter((node) => node.id !== "b1");
    def.edges = def.edges.filter((edge) => edge.id !== "e5");
    expect(getMoveTargets(def, "a2").map(getMoveTargetKey)).toContain("end:branch:else");
    expect(getMoveTargets(def, "trigger")).toEqual([]);
  });
});

describe("moveStep", () => {
  test("moves a plain step to another branch; the step after it carries on from the step before it", () => {
    const result = move(definition(), "a1", { sourceNodeId: "b1" });
    const def = result!.definition;
    expect(hasEdge(def, "branch", "a2", "then")).toBe(true);
    expect(hasEdge(def, "b1", "a1")).toBe(true);
    expect(def.edges.filter((edge) => edge.source === "a1" || edge.target === "a1")).toHaveLength(1);
    expect(result!.stepCount).toBe(1);
  });

  test("on a line, the step goes between its two ends", () => {
    const def = move(definition(), "b1", { edgeId: "e4" })!.definition;
    expect(hasEdge(def, "a1", "b1")).toBe(true);
    expect(hasEdge(def, "b1", "a2")).toBe(true);
    expect(def.edges.some((edge) => edge.source === "branch" && edge.sourceHandle === "else")).toBe(false);
  });

  test("leaves every other step where the user put it", () => {
    const before = definition();
    const def = move(before, "a1", { sourceNodeId: "b1" })!.definition;
    for (const id of ["trigger", "crm", "branch", "a2", "b1"]) {
      expect(positionOf(def, id)).toEqual(positionOf(before, id));
    }
    expect(positionOf(def, "a1").y).toBeGreaterThan(positionOf(def, "b1").y);
  });

  test("on a line, the steps after the `+` shift along to make room", () => {
    const before = definition();
    const def = move(before, "b1", { edgeId: "e4" })!.definition;
    for (const id of ["trigger", "crm", "branch", "a1"]) {
      expect(positionOf(def, id)).toEqual(positionOf(before, id));
    }
    expect(positionOf(def, "b1").y).toBeGreaterThan(positionOf(def, "a1").y);
    expect(positionOf(def, "a2").y).toBeGreaterThan(positionOf(def, "b1").y);
  });

  test("an If/else moves with its branches; the step it lands before follows its first branch", () => {
    const result = move(definition(), "branch", { edgeId: "e1" });
    const def = result!.definition;
    expect(hasEdge(def, "trigger", "branch")).toBe(true);
    expect(hasEdge(def, "branch", "a1", "then")).toBe(true);
    expect(hasEdge(def, "a2", "crm")).toBe(true);
    expect(hasEdge(def, "crm", "branch")).toBe(false);
    expect(result!.stepCount).toBe(4);
  });

  test("names a Variable the move put before the step it comes from", () => {
    expect(move(definition(), "a1", { edgeId: "e1" })!.brokenReferences).toEqual([
      { readerId: "a1", sourceStepId: "crm", field: "status" },
    ]);
    expect(move(definition(), "crm", { edgeId: "e4" })!.brokenReferences).toEqual([
      { readerId: "a1", sourceStepId: "crm", field: "status" },
    ]);
    expect(move(definition(), "a2", { sourceNodeId: "b1" })!.brokenReferences).toEqual([]);
  });

  test("refuses the step's own place, a + inside what moves, and the trigger", () => {
    expect(move(definition(), "a1", { edgeId: "e3" })).toBeNull();
    expect(move(definition(), "a1", { edgeId: "e4" })).toBeNull();
    expect(move(definition(), "branch", { sourceNodeId: "b1" })).toBeNull();
    expect(move(definition(), "trigger", { edgeId: "e4" })).toBeNull();
  });

  test("leaves the definition it was given as it was", () => {
    const def = definition();
    const before = structuredClone(def);
    move(def, "a1", { sourceNodeId: "b1" });
    expect(def).toEqual(before);
  });
});
