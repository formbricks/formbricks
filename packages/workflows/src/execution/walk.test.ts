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

const switchNode = (id: string, caseIds: string[]): TWorkflowExecutableDefinition["nodes"][number] => ({
  id,
  type: "switch",
  config: {
    left: { path: "response.plan" },
    cases: caseIds.map((caseId) => ({ id: caseId, name: caseId, operator: "equals", right: caseId })),
  },
});

/** trigger → route → gold: g → g2 | silver: s → check (then: t | else: —) | default: d */
const routing = definition(
  [
    switchNode("route", ["gold", "silver"]),
    sendEmailNode("g"),
    sendEmailNode("g2"),
    sendEmailNode("s"),
    ifElseNode("check"),
    sendEmailNode("t"),
    sendEmailNode("d"),
  ],
  [
    { id: "e1", source: "trigger", target: "route" },
    // Stored out of order on purpose: not-taken steps still read in the order the canvas draws them.
    { id: "e2", source: "route", target: "d", sourceHandle: "default" },
    { id: "e3", source: "route", target: "s", sourceHandle: "silver" },
    { id: "e4", source: "route", target: "g", sourceHandle: "gold" },
    { id: "e5", source: "g", target: "g2" },
    { id: "e6", source: "s", target: "check" },
    { id: "e7", source: "check", target: "t", sourceHandle: "then" },
  ]
);

describe("walkWorkflowSteps with a Switch", () => {
  test("follows the case the Switch chose and reports every other branch as not taken, in case order", async () => {
    const { visited, result } = await walk(routing, (id) => {
      if (id === "route") return { next: "branch", branch: "silver" };
      if (id === "check") return { next: "branch", branch: "else" };
      return { next: "continue" };
    });

    expect(visited).toEqual(["route", "s", "check"]);
    // The Switch's other branches first, then the nested If/else's Then step.
    expect(result.notTaken.map((node) => node.id)).toEqual(["g", "g2", "d", "t"]);
  });

  test("Default is a branch like any case", async () => {
    const { visited, result } = await walk(routing, (id) =>
      id === "route" ? { next: "branch", branch: "default" } : { next: "continue" }
    );

    expect(visited).toEqual(["route", "d"]);
    expect(result.notTaken.map((node) => node.id)).toEqual(["g", "g2", "s", "check", "t"]);
  });

  test("a case with no step ends the run", async () => {
    const sparse = definition(
      [switchNode("route", ["gold", "silver"]), sendEmailNode("g")],
      [
        { id: "e1", source: "trigger", target: "route" },
        { id: "e2", source: "route", target: "g", sourceHandle: "gold" },
      ]
    );
    const { visited, result } = await walk(sparse, (id) =>
      id === "route" ? { next: "branch", branch: "silver" } : { next: "continue" }
    );

    expect(visited).toEqual(["route"]);
    expect(result).toEqual({ stopped: false, notTaken: [expect.objectContaining({ id: "g" })] });
  });

  test("a Switch must choose a branch", async () => {
    await expect(walk(routing, () => ({ next: "continue" }))).rejects.toThrow(/must choose a branch/);
  });
});
