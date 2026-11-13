import { describe, expect, test } from "vitest";
import type { TWorkflowExecutableDefinition } from "../types/document";
import { type TWorkflowWalkDecision, WorkflowWalkError, walkWorkflowSteps } from "./walk";

const sendEmailNode = (id: string): TWorkflowExecutableDefinition["nodes"][number] => ({
  id,
  type: "action",
  actionType: "send_email",
  config: {
    to: "jane@example.com",
    from: "noreply@example.com",
    replyTo: [],
    subject: "Thanks",
    body: "Body",
    attachResponseData: false,
  },
});

const ifElseNode = (id: string): TWorkflowExecutableDefinition["nodes"][number] => ({
  id,
  type: "if_else",
  config: {
    condition: {
      id: `${id}-group`,
      connector: "and",
      conditions: [{ id: "c", left: { path: "response.q1" }, operator: "isSet" }],
    },
  },
});

const definition = (
  nodes: TWorkflowExecutableDefinition["nodes"],
  edges: TWorkflowExecutableDefinition["edges"]
): TWorkflowExecutableDefinition => ({
  schemaVersion: 1,
  entryNodeId: "trigger",
  trigger: {
    id: "trigger",
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId: "cm9zr4mps000008l8btfy1vtz", endingCardIds: [] },
  },
  nodes,
  edges,
});

/** trigger → before → check → then: a → a2 | else: b */
const branching = definition(
  [sendEmailNode("before"), ifElseNode("check"), sendEmailNode("a"), sendEmailNode("a2"), sendEmailNode("b")],
  [
    { id: "e1", source: "trigger", target: "before" },
    { id: "e2", source: "before", target: "check" },
    { id: "e3", source: "check", target: "a", sourceHandle: "then" },
    { id: "e4", source: "a", target: "a2" },
    { id: "e5", source: "check", target: "b", sourceHandle: "else" },
  ]
);

const walk = async (
  workflow: TWorkflowExecutableDefinition,
  decide: (nodeId: string) => TWorkflowWalkDecision
): Promise<{
  visited: string[];
  sequences: number[];
  result: Awaited<ReturnType<typeof walkWorkflowSteps>>;
}> => {
  const visited: string[] = [];
  const sequences: number[] = [];
  const result = await walkWorkflowSteps(workflow, (node, sequence) => {
    visited.push(node.id);
    sequences.push(sequence);
    return Promise.resolve(decide(node.id));
  });
  return { visited, sequences, result };
};

describe("walkWorkflowSteps", () => {
  test("takes the Then branch and runs its steps in order", async () => {
    const { visited, sequences, result } = await walk(branching, (id) =>
      id === "check" ? { next: "branch", branch: "then" } : { next: "continue" }
    );
    expect(visited).toEqual(["before", "check", "a", "a2"]);
    expect(sequences).toEqual([1, 2, 3, 4]);
    expect(result).toEqual({ stopped: false, notTaken: [expect.objectContaining({ id: "b" })] });
  });

  test("takes the Else branch and never visits the Then steps", async () => {
    const { visited } = await walk(branching, (id) =>
      id === "check" ? { next: "branch", branch: "else" } : { next: "continue" }
    );
    expect(visited).toEqual(["before", "check", "b"]);
  });

  test("an empty branch ends the run", async () => {
    const thenOnly = definition(
      [ifElseNode("check"), sendEmailNode("a")],
      [
        { id: "e1", source: "trigger", target: "check" },
        { id: "e2", source: "check", target: "a", sourceHandle: "then" },
      ]
    );
    const { visited, result } = await walk(thenOnly, (id) =>
      id === "check" ? { next: "branch", branch: "else" } : { next: "continue" }
    );
    expect(visited).toEqual(["check"]);
    expect(result).toEqual({ stopped: false, notTaken: [expect.objectContaining({ id: "a" })] });
  });

  test("reports every step on the branch not taken, nested branches included", async () => {
    // trigger → check → then: a | else: inner → then: x → x2 | else: y
    const nested = definition(
      [
        ifElseNode("check"),
        sendEmailNode("a"),
        ifElseNode("inner"),
        sendEmailNode("x"),
        sendEmailNode("x2"),
        sendEmailNode("y"),
      ],
      [
        { id: "e1", source: "trigger", target: "check" },
        { id: "e2", source: "check", target: "a", sourceHandle: "then" },
        { id: "e3", source: "check", target: "inner", sourceHandle: "else" },
        { id: "e4", source: "inner", target: "x", sourceHandle: "then" },
        { id: "e5", source: "x", target: "x2" },
        { id: "e6", source: "inner", target: "y", sourceHandle: "else" },
      ]
    );

    const thenTaken = await walk(nested, (id) =>
      id === "check" ? { next: "branch", branch: "then" } : { next: "continue" }
    );
    expect(thenTaken.result.notTaken.map((node) => node.id)).toEqual(["inner", "x", "x2", "y"]);

    const elseThenElse = await walk(nested, (id) =>
      id === "check" || id === "inner" ? { next: "branch", branch: "else" } : { next: "continue" }
    );
    expect(elseThenElse.visited).toEqual(["check", "inner", "y"]);
    expect(elseThenElse.result.notTaken.map((node) => node.id)).toEqual(["a", "x", "x2"]);
  });

  test("stops where the visitor says so", async () => {
    const { visited, result } = await walk(branching, (id) =>
      id === "before" ? { next: "stop" } : { next: "continue" }
    );
    expect(visited).toEqual(["before"]);
    expect(result).toEqual({ stopped: true, notTaken: [] });
  });

  test("a trigger with no steps visits nothing", async () => {
    const { visited } = await walk(definition([], []), () => ({ next: "continue" }));
    expect(visited).toEqual([]);
  });

  test("an If/else must choose a branch", async () => {
    await expect(walk(branching, () => ({ next: "continue" }))).rejects.toThrow(WorkflowWalkError);
  });

  test("only an If/else can choose a branch", async () => {
    await expect(walk(branching, () => ({ next: "branch", branch: "then" }))).rejects.toThrow(
      WorkflowWalkError
    );
  });

  test("refuses a cycle instead of looping", async () => {
    const cyclic = definition(
      [sendEmailNode("a"), sendEmailNode("b")],
      [
        { id: "e1", source: "trigger", target: "a" },
        { id: "e2", source: "a", target: "b" },
        { id: "e3", source: "b", target: "a" },
      ]
    );
    await expect(walk(cyclic, () => ({ next: "continue" }))).rejects.toThrow(/acyclic/);
  });

  test("refuses fan-out from a step that is not an If/else", async () => {
    const fanOut = definition(
      [sendEmailNode("a"), sendEmailNode("b"), sendEmailNode("c")],
      [
        { id: "e1", source: "trigger", target: "a" },
        { id: "e2", source: "a", target: "b" },
        { id: "e3", source: "a", target: "c" },
      ]
    );
    await expect(walk(fanOut, () => ({ next: "continue" }))).rejects.toThrow(/more than one/);
  });
});
