import {
  type ActionDescription,
  type ConditionTree,
  type Detail,
  countConditions,
  describeAction,
  describeConditionGroup,
  describeTrigger,
  humanizeStepType,
} from "./describe";
import type { WorkflowDefinition, WorkflowNode } from "./model";

export interface FlowBranch {
  /** "If the conditions match" or "Otherwise". */
  label: string;
  steps: FlowStep[];
}

interface FlowStepBase {
  id: string;
  title: string;
  summary: string;
}

export type FlowStep =
  | (FlowStepBase & { kind: "trigger"; details: Detail[] })
  | (FlowStepBase & { kind: "action"; details: Detail[]; missing: string[] })
  | (FlowStepBase & { kind: "condition"; condition: ConditionTree | null; branches: FlowBranch[] })
  /** A step the flow reaches a second time (two branches merging, or a loop in a draft). Not repeated. */
  | (FlowStepBase & { kind: "reference" });

export interface FlowModel {
  /** The trigger, then everything it leads to. Empty while the draft has no trigger. */
  steps: FlowStep[];
  /** Steps no path from the trigger reaches: a draft that is still being wired up. */
  unconnected: FlowStep[];
}

const KIND_LABEL: Record<FlowStep["kind"], string> = {
  trigger: "Trigger",
  action: "Action",
  condition: "Condition",
  reference: "Step",
};

export const getStepKindLabel = (step: FlowStep): string => KIND_LABEL[step.kind];

const describeNode = (node: WorkflowNode, branches: FlowBranch[]): FlowStep => {
  if (node.type === "trigger") {
    const { summary, details } = describeTrigger(node);
    return { kind: "trigger", id: node.id, title: node.label ?? "Trigger", summary, details };
  }

  if (node.type === "if_else") {
    const condition = describeConditionGroup(node.config.condition);
    const count = countConditions(condition);
    return {
      kind: "condition",
      id: node.id,
      title: node.label ?? "Condition",
      summary:
        count === 0 ? "No conditions yet" : `Checks ${count === 1 ? "one condition" : `${count} conditions`}`,
      condition,
      branches,
    };
  }

  const action: ActionDescription = describeAction(node);
  return {
    kind: "action",
    id: node.id,
    title: node.label ?? humanizeStepType(node.actionType ?? "action"),
    summary: action.summary,
    details: action.details,
    missing: action.missing,
  };
};

const BRANCH_LABELS = { then: "If the conditions match", else: "Otherwise" } as const;

/**
 * The workflow graph as the tree a person reads: the trigger, then each step in order, with an `if_else`
 * node's two outcomes as indented branches. Nodes and edges come from a stored draft, so nothing about the
 * graph is trusted: a node reached twice is shown once and then referenced, a dangling edge ends its chain,
 * and a node nothing reaches is listed apart instead of dropped.
 */
export const buildFlow = (definition: WorkflowDefinition): FlowModel => {
  const nodesById = new Map<string, WorkflowNode>();
  if (definition.trigger) nodesById.set(definition.trigger.id, definition.trigger);
  for (const node of definition.nodes) {
    if (!nodesById.has(node.id)) nodesById.set(node.id, node);
  }

  const visited = new Set<string>();
  const outgoing = (sourceId: string, handle?: string): string | undefined =>
    definition.edges.find(
      (edge) =>
        edge.source === sourceId &&
        (handle === undefined
          ? edge.sourceHandle !== "then" && edge.sourceHandle !== "else"
          : edge.sourceHandle === handle)
    )?.target;

  const walk = (startId: string | undefined): FlowStep[] => {
    const chain: FlowStep[] = [];
    let currentId = startId;

    while (currentId !== undefined) {
      const node = nodesById.get(currentId);
      if (!node) break;

      if (visited.has(currentId)) {
        chain.push({
          kind: "reference",
          id: `${node.id}:again`,
          title: node.label ?? humanizeStepType(node.actionType ?? node.type),
          summary: "Continues with the step shown above",
        });
        break;
      }
      visited.add(currentId);

      if (node.type === "if_else") {
        const branches = (["then", "else"] as const).map((handle) => ({
          label: BRANCH_LABELS[handle],
          steps: walk(outgoing(node.id, handle)),
        }));
        chain.push(describeNode(node, branches));
        break;
      }

      chain.push(describeNode(node, []));
      currentId = outgoing(node.id);
    }
    return chain;
  };

  const steps = definition.trigger ? walk(definition.trigger.id) : [];
  const unconnected = definition.nodes
    .filter((node) => !visited.has(node.id))
    .map((node) => describeNode(node, []));

  return { steps, unconnected };
};

/** step id -> display name, so a run's step logs read "Send thank you email" instead of "send-email". */
export const buildStepNames = (definition: WorkflowDefinition): Map<string, string> => {
  const names = new Map<string, string>();
  if (definition.trigger) names.set(definition.trigger.id, definition.trigger.label ?? "Trigger");
  for (const node of definition.nodes) {
    names.set(node.id, node.label ?? humanizeStepType(node.actionType ?? node.type));
  }
  return names;
};

export const countSteps = (definition: WorkflowDefinition): number => definition.nodes.length;
