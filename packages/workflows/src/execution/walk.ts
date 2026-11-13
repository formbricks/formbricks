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
 * Pure apart from the visitor; it throws `WorkflowWalkError` on a graph the executable schema
 * should have refused (a cycle, fan-out), which the caller maps to a failed run.
 */
export const walkWorkflowSteps = async (
  definition: TWorkflowExecutableDefinition,
  visit: (node: TWorkflowStepNode, sequence: number) => Promise<TWorkflowWalkDecision>
): Promise<{ stopped: boolean }> => {
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

    if (decision.next === "stop") return { stopped: true };
    assertDecisionFitsNode(node, decision);

    nodeId = nextNodeId(node.id, decision.next === "branch" ? decision.branch : undefined);
  }

  return { stopped: false };
};
