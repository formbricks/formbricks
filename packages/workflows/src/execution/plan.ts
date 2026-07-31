import { WORKFLOW_ACTIONS } from "../types/actions/enum";
import type { TWorkflowSendEmailActionNode } from "../types/actions/send-email";
import type { TWorkflowExecutableDefinition } from "../types/document";

/** A single executable step in run order. Only `send_email` actions are executable in this version. */
export interface TWorkflowSendEmailStep {
  stepId: string;
  stepType: typeof WORKFLOW_ACTIONS.SEND_EMAIL;
  node: TWorkflowSendEmailActionNode;
}

export type TWorkflowExecutableStep = TWorkflowSendEmailStep;

export class WorkflowPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowPlanError";
  }
}

/**
 * Walks the linear trigger → action graph of an executable definition and returns its steps in run
 * order. The executable schema already guarantees a single outgoing trigger edge, an acyclic graph,
 * no unreachable nodes, and no `if_else` nodes — so the runtime walk is a straight chain from the
 * trigger following the single outgoing edge per node.
 *
 * Pure (no I/O) and total over a *validated* definition; it throws `WorkflowPlanError` only when the
 * graph is structurally unexecutable (e.g. a dangling/branching edge or a non-`send_email` node),
 * which the caller maps to a failed run.
 */
export const planExecutableSteps = (definition: TWorkflowExecutableDefinition): TWorkflowExecutableStep[] => {
  const nodesById = new Map<string, TWorkflowExecutableDefinition["nodes"][number]>();
  for (const node of definition.nodes) {
    nodesById.set(node.id, node);
  }

  const targetsBySource = new Map<string, string[]>();
  for (const edge of definition.edges) {
    const targets = targetsBySource.get(edge.source) ?? [];
    targets.push(edge.target);
    targetsBySource.set(edge.source, targets);
  }

  const steps: TWorkflowExecutableStep[] = [];
  const visited = new Set<string>();
  let nodeId = definition.trigger.id;

  for (;;) {
    if (visited.has(nodeId)) {
      throw new WorkflowPlanError("Workflow graph must be acyclic");
    }
    visited.add(nodeId);

    const targets = targetsBySource.get(nodeId) ?? [];
    if (targets.length === 0) {
      break;
    }
    if (targets.length > 1) {
      throw new WorkflowPlanError(`Workflow node ${nodeId} has more than one outgoing edge`);
    }

    const [nextId] = targets;
    const node = nodesById.get(nextId);
    if (!node) {
      throw new WorkflowPlanError(`Workflow edge targets a missing node: ${nextId}`);
    }

    // The definition is validated, but treated loosely here so an unexpected node type surfaces as a
    // plan error rather than a type-narrowing assumption (only send_email is executable in this version).
    const loose = node as { type: string; actionType?: string };
    if (loose.type !== "action" || loose.actionType !== WORKFLOW_ACTIONS.SEND_EMAIL) {
      throw new WorkflowPlanError(`Workflow node ${node.id} is not an executable send_email action`);
    }

    steps.push({
      stepId: node.id,
      stepType: WORKFLOW_ACTIONS.SEND_EMAIL,
      node: node as TWorkflowSendEmailStep["node"],
    });
    nodeId = nextId;
  }

  return steps;
};
