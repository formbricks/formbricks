import type { TWorkflowExecutableDefinition, TWorkflowIfElseBranch } from "../types/document";
import type { TWorkflowStepNode } from "../types/steps";

export class WorkflowWalkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowWalkError";
  }
}

/** What the visitor tells the walker after running a step. */
export type TWorkflowWalkDecision =
  /** Follow the step's one outgoing connection (or end the run if it has none). */
  | { next: "continue" }
  /** An If/else's result: follow its Then or Else connection. */
  | { next: "branch"; branch: TWorkflowIfElseBranch }
  /** End the walk here (a step failed, or another delivery owns the run). */
  | { next: "stop" };

/** Only an If/else chooses a branch, and an If/else always does. */
const assertDecisionFitsNode = (node: TWorkflowStepNode, decision: TWorkflowWalkDecision): void => {
  const isIfElse = node.type === "if_else";
  if (isIfElse !== (decision.next === "branch")) {
    throw new WorkflowWalkError(
      isIfElse
        ? `if_else node ${node.id} must choose a branch`
        : `Only an if_else node can choose a branch (${node.id})`
    );
  }
};

/**
 * Walks a run's graph from the trigger along its connections (ADR 0047), visiting one step at a
 * time: steps on a branch run in order because a later step may use an earlier output, and an
 * If/else picks which branch comes next. Branches never join and nothing fans out, so the walk is
 * a single path and `sequence` (1-based) is the step's position on it.
 *
 * It also reports the steps on every branch an If/else did not take (`notTaken`, in graph order,
 * nested branches included), so run detail can show them as "Not taken" (ENG-7170).
 *
 * Pure apart from the visitor; it throws `WorkflowWalkError` on a graph the executable schema
 * should have refused (a cycle, fan-out), which the caller maps to a failed run.
 */
export const walkWorkflowSteps = async (
  definition: TWorkflowExecutableDefinition,
  visit: (node: TWorkflowStepNode, sequence: number) => Promise<TWorkflowWalkDecision>
): Promise<{ stopped: boolean; notTaken: TWorkflowStepNode[] }> => {
  const nodesById = new Map<string, TWorkflowStepNode>(definition.nodes.map((node) => [node.id, node]));
  const edgesBySource = new Map<string, TWorkflowExecutableDefinition["edges"]>();
  for (const edge of definition.edges) {
    edgesBySource.set(edge.source, [...(edgesBySource.get(edge.source) ?? []), edge]);
  }

  const nextNodeId = (sourceId: string, branch?: TWorkflowIfElseBranch): string | null => {
    const outgoing = edgesBySource.get(sourceId) ?? [];
    if (branch) {
      // An empty branch has no edge: nothing runs on that side, so the run ends.
      return outgoing.find((candidate) => candidate.sourceHandle === branch)?.target ?? null;
    }
    if (outgoing.length > 1) {
      throw new WorkflowWalkError(`Workflow node ${sourceId} has more than one outgoing edge`);
    }
    return outgoing[0]?.target ?? null;
  };

  const notTaken: TWorkflowStepNode[] = [];
  /** Every step from `startId` on, depth-first along all connections; branches never join, so each once. */
  const collectFrom = (startId: string | null, seen: Set<string>): void => {
    if (startId === null || seen.has(startId)) return;
    seen.add(startId);
    const node = nodesById.get(startId);
    if (!node) return;
    notTaken.push(node);
    const outgoing = [...(edgesBySource.get(startId) ?? [])].sort(
      (a, b) =>
        // Then before Else, so a nested If/else reads in the order the editor draws it.
        (a.sourceHandle === "else" ? 1 : 0) - (b.sourceHandle === "else" ? 1 : 0)
    );
    for (const edge of outgoing) collectFrom(edge.target, seen);
  };
  const otherBranch = (branch: TWorkflowIfElseBranch): TWorkflowIfElseBranch =>
    branch === "then" ? "else" : "then";

  const visited = new Set<string>();
  let nodeId = nextNodeId(definition.trigger.id);
  let sequence = 0;

  while (nodeId !== null) {
    if (visited.has(nodeId)) throw new WorkflowWalkError("Workflow graph must be acyclic");
    visited.add(nodeId);

    const node = nodesById.get(nodeId);
    if (!node) throw new WorkflowWalkError(`Workflow edge targets a missing node: ${nodeId}`);

    sequence += 1;
    const decision = await visit(node, sequence);

    if (decision.next === "stop") return { stopped: true, notTaken };
    assertDecisionFitsNode(node, decision);
    if (decision.next === "branch") {
      collectFrom(nextNodeId(node.id, otherBranch(decision.branch)), new Set(visited));
    }

    nodeId = nextNodeId(node.id, decision.next === "branch" ? decision.branch : undefined);
  }

  return { stopped: false, notTaken };
};
