import { createId } from "@paralleldrive/cuid2";
import { type TWorkflowDefinition, WORKFLOW_ACTIONS } from "@formbricks/workflows";
import type { TWorkflowVariableGroup } from "@/modules/ee/workflows/lib/variable-picker";

/** The step types the add-step menu offers (ENG-7182): Logic, then Actions. */
export type TAddableWorkflowStepType = "if_else" | "send_email" | "http_request";

type TStepNode = TWorkflowDefinition["nodes"][number];
type TPosition = { x: number; y: number };

/**
 * A new If/else compares one Variable. A condition needs a valid path to save, so the editor passes
 * the first Variable it can offer; the author changes it in the panel.
 */
export const DEFAULT_IF_ELSE_CONDITION_PATH = "payload.value";

/**
 * A fresh step of the given type. No label: titles fall back to the translated type name. Every
 * default saves (the persisted schema accepts it) but does not run until the author fills it in.
 */
export const createDefaultWorkflowStep = (
  stepType: TAddableWorkflowStepType,
  position: TPosition,
  options: { conditionPath?: string } = {}
): TStepNode => {
  // Cloned so no two nodes ever share one mutable position object.
  const ui = { position: { ...position } };
  switch (stepType) {
    case "send_email":
      return {
        id: createId(),
        type: "action",
        actionType: WORKFLOW_ACTIONS.SEND_EMAIL,
        config: {
          to: "",
          from: "team@example.com",
          replyTo: [],
          subject: "",
          body: "",
          attachResponseData: false,
        },
        ui,
      };
    case "http_request":
      return {
        id: createId(),
        type: "action",
        actionType: WORKFLOW_ACTIONS.HTTP_REQUEST,
        config: {
          method: "POST",
          url: "",
          queryParameters: [],
          headers: [],
          body: null,
          responseMode: "wait",
          continueOnError: false,
        },
        ui,
      };
    case "if_else":
      return {
        id: createId(),
        type: "if_else",
        config: {
          condition: {
            id: createId(),
            connector: "and",
            conditions: [
              {
                id: createId(),
                left: { path: options.conditionPath ?? DEFAULT_IF_ELSE_CONDITION_PATH },
                operator: "isSet",
              },
            ],
          },
        },
        ui,
      };
  }
};

/**
 * What a new If/else first compares: the first Variable the step after `sourceNodeId` could pick
 * (a payload field, an earlier step's output, a survey answer), else a placeholder the author
 * replaces.
 */
export const getDefaultConditionPath = (
  groups: readonly TWorkflowVariableGroup[],
  fallback: string = DEFAULT_IF_ELSE_CONDITION_PATH
): string => groups.flatMap((group) => group.options).find((option) => option.isPickable)?.path ?? fallback;

/**
 * Every step on an If/else's branches. Branches never join (ADR 0047), so everything reachable from
 * the If/else belongs to it. Guarded against cycles a hand-written definition could hold.
 */
export const getIfElseBranchStepIds = (definition: TWorkflowDefinition, ifElseId: string): Set<string> => {
  const ids = new Set<string>();
  const queue = definition.edges.filter((edge) => edge.source === ifElseId).map((edge) => edge.target);
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (ids.has(nodeId) || nodeId === ifElseId) continue;
    ids.add(nodeId);
    for (const edge of definition.edges) {
      if (edge.source === nodeId) queue.push(edge.target);
    }
  }
  return ids;
};

/** How many steps deleting this If/else removes with it; 0 for any other step. */
export const countIfElseBranchSteps = (definition: TWorkflowDefinition, nodeId: string): number => {
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  return node?.type === "if_else" ? getIfElseBranchStepIds(definition, nodeId).size : 0;
};

/**
 * Deletes an If/else together with its branches (spec §2 "Shape rules"): the step before it becomes
 * the end of the workflow again. The caller confirms first.
 */
export const removeIfElseWithBranches = (
  definition: TWorkflowDefinition,
  ifElseId: string
): TWorkflowDefinition => {
  const removed = getIfElseBranchStepIds(definition, ifElseId);
  removed.add(ifElseId);
  return {
    ...definition,
    nodes: definition.nodes.filter((node) => !removed.has(node.id)),
    edges: definition.edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)),
  };
};
