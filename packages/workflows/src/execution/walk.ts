import { WORKFLOW_SWITCH_DEFAULT_BRANCH } from "../types/conditions/switch";
import type { TWorkflowExecutableDefinition } from "../types/document";
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
  /**
   * A branching step's result: follow the connection whose `sourceHandle` is `branch`. An If/else
   * picks `then` or `else`; a Switch picks a case id or `default`.
   */
  | { next: "branch"; branch: string }
  /** End the walk here (a step failed, or another delivery owns the run). */
  | { next: "stop" };

const isBranchingNode = (node: TWorkflowStepNode): boolean =>
  node.type === "if_else" || node.type === "switch";

/** Only an If/else or a Switch chooses a branch, and they always do. */
const assertDecisionFitsNode = (node: TWorkflowStepNode, decision: TWorkflowWalkDecision): void => {
  const isBranching = isBranchingNode(node);
  if (isBranching !== (decision.next === "branch")) {
    throw new WorkflowWalkError(
      isBranching
        ? `${node.type} node ${node.id} must choose a branch`
        : `Only an if_else or switch node can choose a branch (${node.id})`
    );
  }
};

/**
 * Where a branch sits left to right on the canvas: Then before Else, a Switch's cases in order and
 * Default last. Any other connection keeps its place.
 */
const getBranchRank = (node: TWorkflowStepNode | undefined, handle: string | undefined): number => {
  if (node?.type === "if_else") return handle === "else" ? 1 : 0;
  if (node?.type === "switch") {
    if (handle === WORKFLOW_SWITCH_DEFAULT_BRANCH) return node.config.cases.length;
    const index = node.config.cases.findIndex((switchCase) => switchCase.id === handle);
    return index === -1 ? node.config.cases.length + 1 : index;
  }
  return 0;
};

type TEdges = TWorkflowExecutableDefinition["edges"];

/** The run's graph as the walker reads it: next steps, branches in canvas order, steps not taken. */
const createWalkGraph = (definition: TWorkflowExecutableDefinition) => {
  const nodesById = new Map<string, TWorkflowStepNode>(definition.nodes.map((node) => [node.id, node]));
  const edgesBySource = new Map<string, TEdges>();
  for (const edge of definition.edges) {
    edgesBySource.set(edge.source, [...(edgesBySource.get(edge.source) ?? []), edge]);
  }

  const nextNodeId = (sourceId: string, branch?: string): string | null => {
    const outgoing = edgesBySource.get(sourceId) ?? [];
    if (branch !== undefined) {
      // An empty branch has no edge: nothing runs on that side, so the run ends.
      return outgoing.find((candidate) => candidate.sourceHandle === branch)?.target ?? null;
    }
    if (outgoing.length > 1) {
      throw new WorkflowWalkError(`Workflow node ${sourceId} has more than one outgoing edge`);
    }
    return outgoing[0]?.target ?? null;
  };

  /** A step's outgoing connections in the order the canvas draws its branches. */
  const orderedOutgoing = (sourceId: string): TEdges => {
    const source = nodesById.get(sourceId);
    return [...(edgesBySource.get(sourceId) ?? [])].sort(
      (a, b) => getBranchRank(source, a.sourceHandle) - getBranchRank(source, b.sourceHandle)
    );
  };

  /** Every step from `startId` on, depth-first along all connections; branches never join, so each once. */
  const collectFrom = (startId: string, seen: Set<string>, into: TWorkflowStepNode[]): void => {
    if (seen.has(startId)) return;
    seen.add(startId);
    const node = nodesById.get(startId);
    if (!node) return;
    into.push(node);
    for (const edge of orderedOutgoing(startId)) collectFrom(edge.target, seen, into);
  };

  /** The steps on every branch of `nodeId` other than `taken`, in canvas order. */
  const collectNotTaken = (
    nodeId: string,
    taken: string,
    visited: ReadonlySet<string>
  ): TWorkflowStepNode[] => {
    const steps: TWorkflowStepNode[] = [];
    for (const edge of orderedOutgoing(nodeId)) {
      if (edge.sourceHandle !== taken) collectFrom(edge.target, new Set(visited), steps);
    }
    return steps;
  };

  return { nodesById, nextNodeId, collectNotTaken };
};

/**
 * Walks a run's graph from the trigger along its connections (ADR 0047), visiting one step at a
 * time: steps on a branch run in order because a later step may use an earlier output, and an
 * If/else or a Switch picks which branch comes next. Branches never join and nothing fans out, so
 * the walk is a single path and `sequence` (1-based) is the step's position on it.
 *
 * It also reports the steps on every branch a branching step did not take (`notTaken`, in the order
 * the canvas draws them, nested branches included), so run detail can show them as "Not taken"
 * (ENG-7170).
 *
 * Pure apart from the visitor; it throws `WorkflowWalkError` on a graph the executable schema
 * should have refused (a cycle, fan-out), which the caller maps to a failed run.
 */
export const walkWorkflowSteps = async (
  definition: TWorkflowExecutableDefinition,
  visit: (node: TWorkflowStepNode, sequence: number) => Promise<TWorkflowWalkDecision>
): Promise<{ stopped: boolean; notTaken: TWorkflowStepNode[] }> => {
  const { nodesById, nextNodeId, collectNotTaken } = createWalkGraph(definition);
  const notTaken: TWorkflowStepNode[] = [];
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
    if (decision.next === "branch") notTaken.push(...collectNotTaken(node.id, decision.branch, visited));

    nodeId = nextNodeId(node.id, decision.next === "branch" ? decision.branch : undefined);
  }

  return { stopped: false, notTaken };
};
