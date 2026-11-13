import type { TWorkflowActionNode, TWorkflowActionType } from "./actions";
import type { TWorkflowIfElseNode, TWorkflowSwitchNode } from "./conditions";

/**
 * A step's concrete type: an action's `actionType` (`send_email`), or the node type for logic steps
 * (`if_else`, `switch`). The runner's executor registry, the executable checks and run logs (`stepType`) are
 * all keyed by it, so a new action type is one new key in each.
 */
export type TWorkflowStepType = TWorkflowActionType | "if_else" | "switch";

export type TWorkflowStepNodeOfType<T extends TWorkflowStepType> = T extends "if_else"
  ? TWorkflowIfElseNode
  : T extends "switch"
    ? TWorkflowSwitchNode
    : Extract<TWorkflowActionNode, { actionType: T }>;

export type TWorkflowStepNode = TWorkflowActionNode | TWorkflowIfElseNode | TWorkflowSwitchNode;

export const getWorkflowStepType = (node: TWorkflowStepNode): TWorkflowStepType =>
  node.type === "action" ? node.actionType : node.type;
