import type { TWorkflowActionNode, TWorkflowActionType } from "./actions";
import type { TWorkflowIfElseNode } from "./conditions";

/**
 * A step's concrete type: an action's `actionType` (`send_email`), or the node type for logic steps
 * (`if_else`). The runner's executor registry, the executable checks and run logs (`stepType`) are
 * all keyed by it, so a new action type is one new key in each.
 */
export type TWorkflowStepType = TWorkflowActionType | "if_else";

export type TWorkflowStepNodeOfType<T extends TWorkflowStepType> = T extends "if_else"
  ? TWorkflowIfElseNode
  : Extract<TWorkflowActionNode, { actionType: T }>;

export type TWorkflowStepNode = TWorkflowActionNode | TWorkflowIfElseNode;

export const getWorkflowStepType = (node: TWorkflowStepNode): TWorkflowStepType =>
  node.type === "action" ? node.actionType : node.type;
