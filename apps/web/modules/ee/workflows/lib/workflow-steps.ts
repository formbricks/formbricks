import { createId } from "@paralleldrive/cuid2";
import {
  type TWorkflowDefinition,
  type TWorkflowNode,
  type TWorkflowSwitchNode,
  WORKFLOW_ACTIONS,
  getSwitchBranches,
} from "@formbricks/workflows";
import type { TWorkflowVariableGroup } from "@/modules/ee/workflows/lib/variable-picker";

/** The step types the add-step menu offers (ENG-7182, ENG-7157): Logic, then Actions. */
export type TAddableWorkflowStepType = "if_else" | "switch" | "send_email" | "http_request";

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
  options: {
    /** The Variable a new If/else or Switch first compares. */
    conditionPath?: string;
    /** A new Switch case's name ("Case 1"), translated by the caller. */
    caseName?: (number: number) => string;
  } = {}
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
    case "switch":
      // Two cases, the fewest a Switch saves with, waiting for the values the author types.
      return {
        id: createId(),
        type: "switch",
        config: {
          left: { path: options.conditionPath ?? DEFAULT_IF_ELSE_CONDITION_PATH },
          cases: [1, 2].map((number) => createSwitchCase(options.caseName?.(number) ?? "")),
        },
        ui,
      };
  }
};

/** A new Switch case comparing for equality with a value the author still types. */
export const createSwitchCase = (name: string): TWorkflowSwitchNode["config"]["cases"][number] => ({
  id: createId(),
  name,
  operator: "equals",
  right: "",
});

/**
 * What a new If/else first compares: the first Variable the step after `sourceNodeId` could pick
 * (a payload field, an earlier step's output, a survey answer), else a placeholder the author
 * replaces.
 */
export const getDefaultConditionPath = (
  groups: readonly TWorkflowVariableGroup[],
  fallback: string = DEFAULT_IF_ELSE_CONDITION_PATH
): string => groups.flatMap((group) => group.options).find((option) => option.isPickable)?.path ?? fallback;

/** Whether a step picks between branches (an If/else or a Switch) rather than having one next step. */
export const isBranchingStep = (node: { type: string } | undefined): boolean =>
  node?.type === "if_else" || node?.type === "switch";

/**
 * A branching step's branches as the canvas draws them, left to right: Then and Else, or a Switch's
 * cases and Default. Null for any other step.
 */
export const getBranchHandles = (node: TWorkflowNode): string[] | null => {
  if (node.type === "if_else") return ["then", "else"];
  if (node.type === "switch") return getSwitchBranches(node);
  return null;
};

/** Which leg of its step's fork a branch is, for placing the branch's first step under it. */
export const getBranchLeg = (
  node: TWorkflowNode,
  handle: string
): { index: number; count: number } | null => {
  const handles = getBranchHandles(node);
  const index = handles?.indexOf(handle) ?? -1;
  return handles && index !== -1 ? { index, count: handles.length } : null;
};

/**
 * Every step reachable from the given edges. Branches never join (ADR 0047), so everything after a
 * branch belongs to it. Guarded against cycles a hand-written definition could hold.
 */
const collectStepIdsAfter = (
  definition: TWorkflowDefinition,
  startEdges: TWorkflowDefinition["edges"],
  stopAt: string
): Set<string> => {
  const ids = new Set<string>();
  const queue = startEdges.map((edge) => edge.target);
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (ids.has(nodeId) || nodeId === stopAt) continue;
    ids.add(nodeId);
    for (const edge of definition.edges) {
      if (edge.source === nodeId) queue.push(edge.target);
    }
  }
  return ids;
};

/** Every step on a branching step's branches. */
const getStepIdsOnBranches = (definition: TWorkflowDefinition, nodeId: string): Set<string> =>
  collectStepIdsAfter(
    definition,
    definition.edges.filter((edge) => edge.source === nodeId),
    nodeId
  );

/** How many steps deleting this If/else or Switch removes with it; 0 for any other step. */
export const countStepsOnBranches = (definition: TWorkflowDefinition, nodeId: string): number => {
  const node = definition.nodes.find((candidate) => candidate.id === nodeId);
  return isBranchingStep(node) ? getStepIdsOnBranches(definition, nodeId).size : 0;
};

/** How many steps removing one case of a Switch removes with it: the steps on that case's branch. */
export const countStepsOnSwitchCase = (
  definition: TWorkflowDefinition,
  switchId: string,
  caseId: string
): number =>
  collectStepIdsAfter(
    definition,
    definition.edges.filter((edge) => edge.source === switchId && edge.sourceHandle === caseId),
    switchId
  ).size;

const withoutSteps = (definition: TWorkflowDefinition, removed: Set<string>): TWorkflowDefinition => ({
  ...definition,
  nodes: definition.nodes.filter((node) => !removed.has(node.id)),
  edges: definition.edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)),
});

/**
 * Deletes an If/else or a Switch together with its branches (spec §2 "Shape rules"): the step
 * before it becomes the end of the workflow again. The caller confirms first.
 */
export const removeBranchingStepWithBranches = (
  definition: TWorkflowDefinition,
  nodeId: string
): TWorkflowDefinition => {
  const removed = getStepIdsOnBranches(definition, nodeId);
  removed.add(nodeId);
  return withoutSteps(definition, removed);
};

/**
 * The definition after a Switch's cases changed: the branch of a case it no longer has goes, with
 * the steps on it, so no edge is left on a branch that doesn't exist. The panel confirms first when
 * that branch has steps.
 */
export const withSwitchBranchesPruned = (
  definition: TWorkflowDefinition,
  node: TWorkflowSwitchNode
): TWorkflowDefinition => {
  const branches = new Set(getSwitchBranches(node));
  const orphaned = definition.edges.filter(
    (edge) => edge.source === node.id && !branches.has(edge.sourceHandle ?? "")
  );
  if (orphaned.length === 0) return definition;
  const removed = collectStepIdsAfter(definition, orphaned, node.id);
  const orphanedIds = new Set(orphaned.map((edge) => edge.id));
  const pruned = withoutSteps(definition, removed);
  return { ...pruned, edges: pruned.edges.filter((edge) => !orphanedIds.has(edge.id)) };
};
