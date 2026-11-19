import { createId } from "@paralleldrive/cuid2";
import type { TWorkflowDefinition, TWorkflowNode } from "@formbricks/workflows";
import type { TWorkflowCanvasDirection } from "@/modules/ee/workflows/lib/canvas-geometry";
import {
  type TPasteTarget,
  type TStepClipboard,
  type TStepReference,
  canPasteAt,
  findBrokenStepReferences,
  getStepAndAfter,
  pasteSteps,
} from "@/modules/ee/workflows/lib/step-clipboard";
import { getBranchHandles } from "@/modules/ee/workflows/lib/workflow-steps";

/**
 * Moving a step to another `+`: by dragging its card onto the `+`, or from its ⋮ menu ("Move to…").
 * It is the same edit as Cut, then "Paste here" on that `+`, made in one go, and places the steps as that
 * does: the step lands where a new step at that `+` would, the steps it takes along keep their shape
 * around it, and on a line the steps after the `+` shift along to make room. Every other step stays
 * where the user put it, so a hand-made arrangement survives a move (Auto layout tidies up after).
 *
 * - A plain step (Send email, HTTP request) moves alone: the step after it carries on from the step
 *   before it.
 * - An If/else, a Switch or a Filter moves with every step after it: its branches, or, for a Filter, the
 *   steps it lets through. Moving it alone would change what those steps run after.
 * - The trigger never moves.
 */

type TStepNode = TWorkflowDefinition["nodes"][number];

/** Whether a step takes the steps after it along when it moves. */
const movesWithStepsAfter = (node: TStepNode): boolean =>
  node.type === "if_else" || node.type === "switch" || node.type === "filter";

/** The steps a move of `stepId` takes along, itself first; empty for the trigger or an unknown step. */
export const getMovingStepIds = (definition: TWorkflowDefinition, stepId: string): string[] => {
  const node = definition.nodes.find((item) => item.id === stepId);
  if (!node) return [];
  return movesWithStepsAfter(node) ? getStepAndAfter(definition, stepId) : [stepId];
};

const moveClipboard = (definition: TWorkflowDefinition, stepId: string): TStepClipboard | null => {
  const stepIds = getMovingStepIds(definition, stepId);
  return stepIds.length > 0 ? { mode: "cut", workflowId: "", rootId: stepId, stepIds } : null;
};

/** A stable key for a `+`, to compare targets and find the one a drop landed on. */
export const getMoveTargetKey = (target: TPasteTarget): string =>
  "edgeId" in target ? `edge:${target.edgeId}` : `end:${target.sourceNodeId}:${target.branch ?? ""}`;

/**
 * Every `+` on the canvas, in the order the tree reads (each branch left to right, top to bottom): the
 * one on each line, at the end of each path, and at the start of each empty branch.
 */
const getAllTargets = (definition: TWorkflowDefinition): TPasteTarget[] => {
  const nodesById = new Map<string, TWorkflowNode>(
    [...(definition.trigger ? [definition.trigger] : []), ...definition.nodes].map((node) => [node.id, node])
  );
  const targets: TPasteTarget[] = [];
  const visited = new Set<string>();
  const visit = (nodeId: string) => {
    const node = nodesById.get(nodeId);
    if (!node || visited.has(nodeId)) return;
    visited.add(nodeId);
    const outgoing = definition.edges.filter((edge) => edge.source === nodeId);
    const branches = getBranchHandles(node);
    if (branches) {
      for (const branch of branches) {
        const edge = outgoing.find((item) => item.sourceHandle === branch);
        if (edge) {
          targets.push({ edgeId: edge.id });
          visit(edge.target);
        } else {
          targets.push({ sourceNodeId: nodeId, branch });
        }
      }
      return;
    }
    if (outgoing.length === 0) targets.push({ sourceNodeId: nodeId });
    for (const edge of outgoing) {
      targets.push({ edgeId: edge.id });
      visit(edge.target);
    }
  };
  const hasIncoming = new Set(definition.edges.map((edge) => edge.target));
  const roots = definition.trigger
    ? [definition.trigger.id]
    : definition.nodes.filter((node) => !hasIncoming.has(node.id)).map((node) => node.id);
  for (const root of roots) visit(root);
  return targets;
};

/**
 * Where `stepId` can move: every `+` except those inside what moves and its own place (the line into
 * it, and for a plain step the line out of it). Empty for the trigger.
 */
export const getMoveTargets = (definition: TWorkflowDefinition, stepId: string): TPasteTarget[] => {
  const clipboard = moveClipboard(definition, stepId);
  if (!clipboard) return [];
  return getAllTargets(definition).filter((target) => canPasteAt(definition, clipboard, target));
};

/** A plain step taken out of its path: the step after it carries on from the step before it. */
const detachStep = (definition: TWorkflowDefinition, stepId: string): TWorkflowDefinition => {
  const incoming = definition.edges.find((edge) => edge.target === stepId);
  const outgoing = definition.edges.find((edge) => edge.source === stepId);
  const edges = definition.edges.filter((edge) => edge !== incoming && edge !== outgoing);
  if (incoming && outgoing) {
    edges.push({
      id: createId(),
      source: incoming.source,
      target: outgoing.target,
      ...(incoming.sourceHandle ? { sourceHandle: incoming.sourceHandle } : {}),
    });
  }
  return { ...definition, edges };
};

export type TMoveStepResult = {
  definition: TWorkflowDefinition;
  /** How many steps moved: the step, plus the steps after it for an If/else, Switch or Filter. */
  stepCount: number;
  /** Reads of a step's output that the move put before that step; the move is allowed, with a warning. */
  brokenReferences: TStepReference[];
};

/**
 * The definition with `stepId` moved to `target`, or null when the step
 * can't go there (its own place, inside what moves, the trigger, an unknown `+`).
 */
export const moveStep = ({
  definition,
  stepId,
  target,
  direction,
}: {
  definition: TWorkflowDefinition;
  stepId: string;
  target: TPasteTarget;
  direction: TWorkflowCanvasDirection;
}): TMoveStepResult | null => {
  const clipboard = moveClipboard(definition, stepId);
  const key = getMoveTargetKey(target);
  if (!clipboard || !getMoveTargets(definition, stepId).some((item) => getMoveTargetKey(item) === key)) {
    return null;
  }
  const isAlone = clipboard.mode === "cut" && clipboard.stepIds.length === 1;
  const detached = isAlone ? detachStep(definition, stepId) : definition;
  const pasted = pasteSteps({
    definition: detached,
    clipboard,
    target,
    direction,
    copyLabel: (node) => node.label ?? "",
  });
  if (!pasted) return null;

  const brokenBefore = new Set(findBrokenStepReferences(definition).map(referenceKey));
  return {
    definition: pasted.definition,
    stepCount: pasted.stepCount,
    brokenReferences: findBrokenStepReferences(pasted.definition).filter(
      (reference) => !brokenBefore.has(referenceKey(reference))
    ),
  };
};

const referenceKey = (reference: TStepReference) =>
  `${reference.readerId}>${reference.sourceStepId}.${reference.field}`;
